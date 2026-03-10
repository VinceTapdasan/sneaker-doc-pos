import { Injectable } from '@nestjs/common';
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

    const result: Record<string, string> = {
      cash: '0.00',
      gcash: '0.00',
      card: '0.00',
      bank_deposit: '0.00',
    };
    rows.forEach((r) => {
      result[r.method] = fromScaled(r.amount);
    });
    return result;
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
        ),
      );

    if (existing.length > 0) {
      const newTotal = existing[0].amount + deltaScaled;
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

  async upsert(year: number, month: number, method: string, amount: string, branchId?: number, performedBy?: string) {
    const addScaled = toScaled(amount);

    const result = await this.upsertSingle(year, month, method, addScaled, branchId, method === 'bank_deposit' ? 'gcash' : undefined);

    // When recording a bank deposit, subtract the same amount from GCash (owner transferred GCash funds to bank)
    if (method === 'bank_deposit') {
      await this.upsertSingle(year, month, 'gcash', -addScaled, branchId);
    }

    await this.audit.log({
      action: `Recorded deposit: ${method} +${fromScaled(addScaled)} (total: ${fromScaled(result.amount)}) for ${year}-${String(month).padStart(2, '0')}`,
      entityType: 'deposit',
      entityId: String(result.id),
      performedBy,
      branchId,
      details: { year, month, method, added: fromScaled(addScaled), total: fromScaled(result.amount), ...(method === 'bank_deposit' ? { origin: 'gcash', gcashSubtracted: fromScaled(addScaled) } : {}) },
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
