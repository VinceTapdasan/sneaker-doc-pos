import { Injectable, BadRequestException } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { DrizzleService } from '../db/drizzle.service';
import { AuditService } from '../audit/audit.service';
import { auditLog, deposits, users } from '../db/schema';
import { toScaled, fromScaled } from '../utils/money';

@Injectable()
export class DepositsService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly audit: AuditService,
  ) {}

  async findByMonth(year: number, month: number, branchId?: number) {
    const conditions = [eq(deposits.year, year), eq(deposits.month, month)];
    if (branchId) conditions.push(eq(deposits.branchId, branchId));

    const rows = await this.drizzle.db
      .select()
      .from(deposits)
      .where(and(...conditions));

    const totals: Record<string, number> = {
      cash: 0,
      gcash: 0,
      card: 0,
      bank_deposit: 0,
    };
    rows.forEach((r) => {
      totals[r.method] = (totals[r.method] ?? 0) + r.amount;
    });
    return {
      cash: fromScaled(totals.cash),
      gcash: fromScaled(totals.gcash),
      card: fromScaled(totals.card),
      bank_deposit: fromScaled(totals.bank_deposit),
    };
  }

  private async upsertSingle(
    year: number,
    month: number,
    method: string,
    deltaScaled: number,
    branchId?: number,
    origin?: string,
  ) {
    const existing = await this.drizzle.db
      .select()
      .from(deposits)
      .where(
        and(
          eq(deposits.year, year),
          eq(deposits.month, month),
          eq(deposits.method, method),
          branchId ? eq(deposits.branchId, branchId) : isNull(deposits.branchId),
          origin ? eq(deposits.origin, origin) : isNull(deposits.origin),
        ),
      );

    if (existing.length > 0) {
      const newTotal = existing[0].amount + deltaScaled;
      if (newTotal < 0) {
        throw new BadRequestException(`Deposit balance for ${method} cannot go below zero.`);
      }
      const [updated] = await this.drizzle.db
        .update(deposits)
        .set({ amount: newTotal, updatedAt: new Date() })
        .where(eq(deposits.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await this.drizzle.db
        .insert(deposits)
        .values({ year, month, method, amount: Math.max(0, deltaScaled), branchId: branchId ?? null, origin: origin ?? null })
        .returning();
      return created;
    }
  }

  async upsert(year: number, month: number, method: string, amount: string, branchId?: number, performedBy?: string, origin?: string) {
    const addScaled = toScaled(amount);
    const depositOrigin = method === 'bank_deposit' ? (origin ?? 'gcash') : undefined;

    const result = await this.upsertSingle(year, month, method, addScaled, branchId, depositOrigin);

    // NOTE: Source-channel deduction rows are NOT created here.
    // The collectionsSummary endpoint handles deductions by querying bank_deposit
    // rows grouped by origin and subtracting from the corresponding collection
    // channel. This avoids the non-atomic dual-write problem and the Math.max(0)
    // clamping bug that prevented negative source-channel rows.

    await this.audit.log({
      action: `Recorded deposit: ${method} +${fromScaled(addScaled)} (total: ${fromScaled(result.amount)}) for ${year}-${String(month).padStart(2, '0')}`,
      entityType: 'deposit',
      entityId: String(result.id),
      performedBy,
      branchId,
      details: { year, month, method, added: fromScaled(addScaled), total: fromScaled(result.amount), ...(depositOrigin ? { origin: depositOrigin } : {}) },
    });

    return { ...result, amount: fromScaled(result.amount) };
  }

  async findDepositAudit(year: number, month: number, branchId?: number, method?: string) {
    const conditions = [
      eq(auditLog.entityType, 'deposit'),
      sql`${auditLog.details}->>'year' = ${String(year)}`,
      sql`${auditLog.details}->>'month' = ${String(month)}`,
    ];

    if (branchId) conditions.push(eq(auditLog.branchId, branchId));
    if (method) conditions.push(sql`${auditLog.details}->>'method' = ${method}`);

    return this.drizzle.db
      .select({
        id: auditLog.id,
        createdAt: auditLog.createdAt,
        performedBy: auditLog.performedBy,
        performedByEmail: users.email,
        branchId: auditLog.branchId,
        details: auditLog.details,
      })
      .from(auditLog)
      .leftJoin(users, eq(auditLog.performedBy, users.id))
      .where(and(...conditions))
      .orderBy(desc(auditLog.createdAt));
  }
}
