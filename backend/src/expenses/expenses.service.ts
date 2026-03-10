import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql, gte, lte, and, inArray } from 'drizzle-orm';
import { DrizzleService } from '../db/drizzle.service';
import { expenses, users } from '../db/schema';
import { AuditService } from '../audit/audit.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { toScaled, fromScaled } from '../utils/money';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly audit: AuditService,
  ) {}

  private async branchStaffIds(branchId: number): Promise<string[]> {
    const rows = await this.drizzle.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.branchId, branchId));
    return rows.map((u) => u.id);
  }

  async findByMonth(year: number, month: number, branchId?: number) {
    // month=0 means full year
    const from = month === 0 ? `${year}-01-01` : `${year}-${String(month).padStart(2, '0')}-01`;
    const to = month === 0
      ? `${year}-12-31`
      : `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

    const dateRange = and(gte(expenses.dateKey, from), lte(expenses.dateKey, to));

    if (branchId) {
      const staffIds = await this.branchStaffIds(branchId);
      if (staffIds.length === 0) return [];
      const rows = await this.drizzle.db
        .select()
        .from(expenses)
        .where(and(dateRange, inArray(expenses.staffId, staffIds)));
      return rows.map((e) => ({ ...e, amount: fromScaled(e.amount) }));
    }

    const rows = await this.drizzle.db
      .select()
      .from(expenses)
      .where(dateRange);
    return rows.map((e) => ({ ...e, amount: fromScaled(e.amount) }));
  }

  async findByDate(dateKey: string, staffId?: string, branchId?: number) {
    const dateCondition = eq(expenses.dateKey, dateKey);

    if (staffId) {
      const rows = await this.drizzle.db
        .select()
        .from(expenses)
        .where(and(dateCondition, eq(expenses.staffId, staffId)));
      return rows.map((e) => ({ ...e, amount: fromScaled(e.amount) }));
    }

    if (branchId) {
      const staffIds = await this.branchStaffIds(branchId);
      if (staffIds.length === 0) return [];
      const rows = await this.drizzle.db
        .select()
        .from(expenses)
        .where(and(dateCondition, inArray(expenses.staffId, staffIds)));
      return rows.map((e) => ({ ...e, amount: fromScaled(e.amount) }));
    }

    const rows = await this.drizzle.db
      .select()
      .from(expenses)
      .where(dateCondition);
    return rows.map((e) => ({ ...e, amount: fromScaled(e.amount) }));
  }

  async summary(dateKey: string, staffId?: string, branchId?: number) {
    if (staffId) {
      const [result] = await this.drizzle.db
        .select({ total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)` })
        .from(expenses)
        .where(and(eq(expenses.dateKey, dateKey), eq(expenses.staffId, staffId)));
      return { dateKey, total: fromScaled(result?.total ?? 0) };
    }

    if (branchId) {
      const staffIds = await this.branchStaffIds(branchId);
      if (staffIds.length === 0) return { dateKey, total: '0' };
      const [result] = await this.drizzle.db
        .select({ total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)` })
        .from(expenses)
        .where(and(eq(expenses.dateKey, dateKey), inArray(expenses.staffId, staffIds)));
      return { dateKey, total: fromScaled(result?.total ?? 0) };
    }

    const [result] = await this.drizzle.db
      .select({ total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)` })
      .from(expenses)
      .where(eq(expenses.dateKey, dateKey));
    return { dateKey, total: fromScaled(result?.total ?? 0) };
  }

  async findOne(id: number) {
    const [expense] = await this.drizzle.db
      .select()
      .from(expenses)
      .where(eq(expenses.id, id));
    if (!expense) throw new NotFoundException(`Expense ${id} not found`);
    return { ...expense, amount: fromScaled(expense.amount) };
  }

  async create(dto: CreateExpenseDto, source = 'pos', performedBy?: string, branchId?: number) {
    if (!dto.method) {
      throw new BadRequestException('Payment method is required');
    }

    const [created] = await this.drizzle.db
      .insert(expenses)
      .values({
        dateKey: dto.dateKey,
        category: dto.category ?? null,
        note: dto.note ?? null,
        method: dto.method,
        amount: toScaled(dto.amount),
        staffId: performedBy ?? null,
      })
      .returning();

    await this.audit.log({
      action: 'create',
      entityType: 'expense',
      entityId: String(created.id),
      source,
      performedBy,
      branchId,
      details: { amount: created.amount, category: created.category },
    });

    return { ...created, amount: fromScaled(created.amount) };
  }

  async update(id: number, dto: UpdateExpenseDto, performedBy?: string, branchId?: number) {
    await this.findOne(id);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { amount: _amount, ...rest } = dto;
    const setValues = {
      ...rest,
      ...(dto.amount !== undefined && { amount: toScaled(dto.amount) }),
    };

    const [updated] = await this.drizzle.db
      .update(expenses)
      .set(setValues)
      .where(eq(expenses.id, id))
      .returning();

    await this.audit.log({
      action: 'update',
      entityType: 'expense',
      entityId: String(id),
      source: 'pos',
      performedBy,
      branchId,
    });

    return { ...updated, amount: fromScaled(updated.amount) };
  }

  async remove(id: number, performedBy?: string, branchId?: number) {
    await this.findOne(id);

    await this.drizzle.db.delete(expenses).where(eq(expenses.id, id));

    await this.audit.log({
      action: 'delete',
      entityType: 'expense',
      entityId: String(id),
      source: 'pos',
      performedBy,
      branchId,
    });
  }
}
