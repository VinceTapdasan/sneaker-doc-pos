import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, lte, gte, or, isNull, sql } from 'drizzle-orm';
import { DrizzleService } from '../db/drizzle.service';
import { promos, transactions } from '../db/schema';
import { AuditService } from '../audit/audit.service';
import { CreatePromoDto } from './dto/create-promo.dto';
import { UpdatePromoDto } from './dto/update-promo.dto';

@Injectable()
export class PromosService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly audit: AuditService,
  ) {}

  /** Compute current usage count for a promo (non-cancelled txns that use this promo) */
  private async getUsageCount(promoId: number): Promise<number> {
    const [row] = await this.drizzle.db
      .select({ count: sql<number>`CAST(COUNT(*) AS INT)` })
      .from(transactions)
      .where(and(eq(transactions.promoId, promoId), sql`${transactions.status} != 'cancelled'`, isNull(transactions.deletedAt)));
    return Number(row?.count ?? 0);
  }

  async findAll(activeOnly = false) {
    let rows: typeof promos.$inferSelect[];
    if (activeOnly) {
      const today = new Date().toISOString().split('T')[0];
      rows = await this.drizzle.db
        .select()
        .from(promos)
        .where(
          and(
            eq(promos.isActive, true),
            or(isNull(promos.dateFrom), lte(promos.dateFrom, today)),
            or(isNull(promos.dateTo), gte(promos.dateTo, today)),
          ),
        );
    } else {
      rows = await this.drizzle.db.select().from(promos);
    }

    // Attach usage count to each promo
    const withUsage = await Promise.all(
      rows.map(async (p) => ({
        ...p,
        usageCount: await this.getUsageCount(p.id),
      })),
    );

    // For activeOnly: also exclude promos that have hit their usage cap
    if (activeOnly) {
      return withUsage.filter((p) => p.maxUses == null || p.usageCount < p.maxUses);
    }
    return withUsage;
  }

  async findOne(id: number) {
    const [promo] = await this.drizzle.db
      .select()
      .from(promos)
      .where(eq(promos.id, id));
    if (!promo) throw new NotFoundException(`Promo ${id} not found`);
    return promo;
  }

  async findByCode(code: string) {
    const today = new Date().toISOString().split('T')[0];
    const [promo] = await this.drizzle.db
      .select()
      .from(promos)
      .where(
        and(
          eq(promos.code, code),
          eq(promos.isActive, true),
          or(isNull(promos.dateFrom), lte(promos.dateFrom, today)),
          or(isNull(promos.dateTo), gte(promos.dateTo, today)),
        ),
      );
    if (!promo) return null;
    const usageCount = await this.getUsageCount(promo.id);
    if (promo.maxUses != null && usageCount >= promo.maxUses) return null; // exhausted
    return { ...promo, usageCount };
  }

  /**
   * Validate a promo can be applied to a transaction.
   * Throws BadRequestException if the promo is exhausted.
   * Used by TransactionsService when creating or updating transactions.
   */
  async validatePromoApplicable(promoId: number): Promise<void> {
    const [promo] = await this.drizzle.db.select().from(promos).where(eq(promos.id, promoId));
    if (!promo) throw new BadRequestException(`Promo ${promoId} not found`);
    if (!promo.isActive) throw new BadRequestException('This promo is no longer active');
    if (promo.maxUses != null) {
      const usageCount = await this.getUsageCount(promoId);
      if (usageCount >= promo.maxUses) {
        throw new BadRequestException(`Promo "${promo.code}" has reached its maximum usage limit of ${promo.maxUses}`);
      }
    }
  }

  async create(dto: CreatePromoDto, performedBy?: string) {
    const [created] = await this.drizzle.db
      .insert(promos)
      .values({
        name: dto.name,
        code: dto.code.toUpperCase(),
        percent: dto.percent,
        dateFrom: dto.dateFrom ?? null,
        dateTo: dto.dateTo ?? null,
        isActive: dto.isActive ?? true,
        maxUses: dto.maxUses ?? null,
        createdById: performedBy ?? null,
      })
      .returning();

    await this.audit.log({
      action: 'create',
      entityType: 'promo',
      entityId: String(created.id),
      source: 'admin',
      performedBy,
      details: { code: created.code },
    });

    return created;
  }

  async update(id: number, dto: UpdatePromoDto, performedBy?: string) {
    const existing = await this.findOne(id);

    const [updated] = await this.drizzle.db
      .update(promos)
      .set({
        ...dto,
        code: dto.code ? dto.code.toUpperCase() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(promos.id, id))
      .returning();

    await this.audit.log({
      action: 'update',
      entityType: 'promo',
      entityId: String(id),
      source: 'admin',
      performedBy,
      details: { before: existing, after: updated },
    });

    return updated;
  }

  // Soft-delete — set isActive = false
  async remove(id: number, performedBy?: string) {
    await this.findOne(id);

    const [updated] = await this.drizzle.db
      .update(promos)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(promos.id, id))
      .returning();

    await this.audit.log({
      action: 'delete',
      entityType: 'promo',
      entityId: String(id),
      source: 'admin',
      performedBy,
    });

    return updated;
  }
}
