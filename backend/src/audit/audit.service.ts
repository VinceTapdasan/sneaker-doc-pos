import { Injectable } from '@nestjs/common';
import { and, desc, eq, gte, getTableColumns, lte } from 'drizzle-orm';
import { DrizzleService } from '../db/drizzle.service';
import { auditLog, users } from '../db/schema';
import type { AuditType } from '../db/constants';

interface LogActionParams {
  action: string;
  auditType?: AuditType;
  entityType: string;
  entityId?: string;
  source?: string;
  performedBy?: string;
  branchId?: number;
  details?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private readonly drizzle: DrizzleService) {}

  async findAll(params: { limit?: number; month?: number; year?: number; performedBy?: string; branchId?: number } = {}) {
    const { limit = 200, month, year, performedBy, branchId } = params;
    const conditions: ReturnType<typeof eq>[] = [];

    if (month && year) {
      const from = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00`);
      const lastDay = new Date(year, month, 0).getDate();
      const to = new Date(`${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59`);
      conditions.push(
        gte(auditLog.createdAt, from) as ReturnType<typeof eq>,
        lte(auditLog.createdAt, to) as ReturnType<typeof eq>,
      );
    }

    if (performedBy) {
      conditions.push(eq(auditLog.performedBy, performedBy));
    }

    if (branchId) {
      conditions.push(eq(auditLog.branchId, branchId) as ReturnType<typeof eq>);
    }

    return this.drizzle.db
      .select({
        ...getTableColumns(auditLog),
        performedByEmail: users.email,
        performedByFullName: users.fullName,
      })
      .from(auditLog)
      .leftJoin(users, eq(auditLog.performedBy, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit);
  }

  async log(params: LogActionParams): Promise<void> {
    await this.drizzle.db.insert(auditLog).values({
      action: params.action,
      auditType: params.auditType ?? null,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      source: params.source ?? null,
      performedBy: params.performedBy ?? null,
      branchId: params.branchId ?? null,
      details: params.details ?? null,
    });
  }
}
