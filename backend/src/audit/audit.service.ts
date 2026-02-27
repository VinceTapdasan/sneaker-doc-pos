import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../db/drizzle.service';
import { auditLog } from '../db/schema';
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
