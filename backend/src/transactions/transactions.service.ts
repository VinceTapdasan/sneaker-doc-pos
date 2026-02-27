import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, desc, sql, gte, lte, and, not, inArray, ilike, or } from 'drizzle-orm';
import { DrizzleService } from '../db/drizzle.service';
import {
  transactions,
  transactionItems,
  claimPayments,
  customers,
  promos,
  services,
} from '../db/schema';
import { TRANSACTION_STATUS, AUDIT_TYPE, type AuditType } from '../db/constants';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { AddPaymentDto } from './dto/add-payment.dto';
import { UpdateItemDto } from './dto/update-item.dto';

export interface FindAllParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  from?: string;
  to?: string;
  branchId?: number;
}

@Injectable()
export class TransactionsService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly audit: AuditService,
    private readonly users: UsersService,
  ) {}

  // Generate next zero-padded transaction number using a DB sequence-safe query
  private async nextNumber(): Promise<string> {
    const [result] = await this.drizzle.db
      .select({
        max: sql<string>`COALESCE(MAX(CAST(${transactions.number} AS INTEGER)), 0)`,
      })
      .from(transactions);
    const next = parseInt(result?.max ?? '0', 10) + 1;
    return String(next).padStart(4, '0');
  }

  async findAll(params: FindAllParams = {}) {
    const { page = 1, limit = 50, status, search, from, to, branchId } = params;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [];

    if (status) conditions.push(eq(transactions.status, status));
    if (branchId) conditions.push(eq(transactions.branchId, branchId));
    if (from) conditions.push(gte(transactions.createdAt, new Date(`${from}T00:00:00`)));
    if (to) conditions.push(lte(transactions.createdAt, new Date(`${to}T23:59:59`)));
    if (search) {
      conditions.push(
        or(
          ilike(transactions.number, `%${search}%`),
          ilike(transactions.customerName, `%${search}%`),
          ilike(transactions.customerPhone, `%${search}%`),
        ) as ReturnType<typeof eq>,
      );
    }

    return this.drizzle.db
      .select()
      .from(transactions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(transactions.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async findOne(id: number) {
    const [row] = await this.drizzle.db
      .select({ txn: transactions, promo: promos })
      .from(transactions)
      .leftJoin(promos, eq(transactions.promoId, promos.id))
      .where(eq(transactions.id, id));
    if (!row) throw new NotFoundException(`Transaction ${id} not found`);

    const itemRows = await this.drizzle.db
      .select({ item: transactionItems, service: services })
      .from(transactionItems)
      .leftJoin(services, eq(transactionItems.serviceId, services.id))
      .where(eq(transactionItems.transactionId, id));

    const allAddonIds = [
      ...new Set(
        itemRows.flatMap((r) => (r.item.addonServiceIds as number[] | null) ?? []),
      ),
    ];
    const addonMap = new Map<number, { id: number; name: string; type: string }>();
    if (allAddonIds.length > 0) {
      const addonRows = await this.drizzle.db
        .select()
        .from(services)
        .where(inArray(services.id, allAddonIds));
      addonRows.forEach((s) => addonMap.set(s.id, { id: s.id, name: s.name, type: s.type }));
    }

    const items = itemRows.map((r) => ({
      ...r.item,
      service: r.service ? { id: r.service.id, name: r.service.name, type: r.service.type } : null,
      addonServices: ((r.item.addonServiceIds as number[] | null) ?? [])
        .map((id) => addonMap.get(id))
        .filter(Boolean),
    }));

    const payments = await this.drizzle.db
      .select()
      .from(claimPayments)
      .where(eq(claimPayments.transactionId, id));

    return { ...row.txn, promo: row.promo ?? null, items, payments };
  }

  async findByNumber(number: string) {
    const [txn] = await this.drizzle.db
      .select()
      .from(transactions)
      .where(eq(transactions.number, number));
    if (!txn) throw new NotFoundException(`Transaction ${number} not found`);
    return this.findOne(txn.id);
  }

  async create(
    dto: CreateTransactionDto,
    source = 'pos',
    performedBy?: string,
  ) {
    const number = await this.nextNumber();

    // Resolve branch from the performing user
    const branchId = performedBy ? await this.users.getBranchId(performedBy) : null;

    const [created] = await this.drizzle.db
      .insert(transactions)
      .values({
        number,
        customerName: dto.customerName ?? null,
        customerPhone: dto.customerPhone ?? null,
        customerEmail: dto.customerEmail ?? null,
        status: dto.status ?? 'pending',
        pickupDate: dto.pickupDate ?? null,
        total: dto.total ?? '0',
        paid: dto.paid ?? '0',
        promoId: dto.promoId ?? null,
        branchId: branchId ?? null,
        updatedAt: new Date(),
      })
      .returning();

    if (dto.items?.length) {
      await this.drizzle.db.insert(transactionItems).values(
        dto.items.map((item) => ({
          transactionId: created.id,
          shoeDescription: item.shoeDescription ?? null,
          serviceId: item.serviceId ?? null,
          addonServiceIds: item.addonServiceIds?.length ? item.addonServiceIds : null,
          status: item.status ?? 'pending',
          beforeImageUrl: item.beforeImageUrl ?? null,
          afterImageUrl: item.afterImageUrl ?? null,
          price: item.price ?? null,
        })),
      );
    }

    if (dto.customerPhone) {
      await this.drizzle.db
        .insert(customers)
        .values({
          phone: dto.customerPhone,
          name: dto.customerName ?? null,
          email: dto.customerEmail ?? null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: customers.phone,
          set: {
            name: dto.customerName ?? null,
            email: dto.customerEmail ?? null,
            updatedAt: new Date(),
          },
        });
    }

    await this.audit.log({
      action: 'create',
      auditType: AUDIT_TYPE.TRANSACTION_CREATED,
      entityType: 'transaction',
      entityId: created.number,
      source,
      performedBy,
      branchId: branchId ?? undefined,
      details: { number: created.number, customerName: created.customerName, total: created.total },
    });

    return this.findOne(created.id);
  }

  async update(
    id: number,
    dto: UpdateTransactionDto,
    source = 'pos',
    performedBy?: string,
  ) {
    const existing = await this.findOne(id);
    const prevStatus = existing.status;

    const setValues: Record<string, unknown> = {
      ...dto,
      updatedAt: new Date(),
    };
    if (
      dto.status === TRANSACTION_STATUS.CLAIMED &&
      prevStatus !== TRANSACTION_STATUS.CLAIMED
    ) {
      setValues.claimedAt = new Date();
    }

    const [updated] = await this.drizzle.db
      .update(transactions)
      .set(setValues)
      .where(eq(transactions.id, id))
      .returning();

    // Determine audit type
    let action = 'update';
    let auditType: AuditType = AUDIT_TYPE.TRANSACTION_UPDATED;
    let auditDetails: Record<string, unknown> = { fields: Object.keys(dto) };

    if (dto.status && dto.status !== prevStatus) {
      action = 'status_change';
      auditDetails = { from: prevStatus, to: dto.status };
      if (dto.status === TRANSACTION_STATUS.CLAIMED) {
        auditType = AUDIT_TYPE.TRANSACTION_CLAIMED;
      } else if (dto.status === TRANSACTION_STATUS.CANCELLED) {
        auditType = AUDIT_TYPE.TRANSACTION_CANCELLED;
      } else {
        auditType = AUDIT_TYPE.TRANSACTION_STATUS_CHANGED;
      }
    } else if (dto.newPickupDate !== undefined && dto.newPickupDate !== existing.newPickupDate) {
      auditType = AUDIT_TYPE.PICKUP_RESCHEDULED;
      auditDetails = {
        from: existing.newPickupDate ?? existing.pickupDate,
        to: dto.newPickupDate,
      };
    }

    const branchId = performedBy ? await this.users.getBranchId(performedBy) : null;

    await this.audit.log({
      action,
      auditType,
      entityType: 'transaction',
      entityId: updated.number,
      source,
      performedBy,
      branchId: branchId ?? undefined,
      details: auditDetails,
    });

    return this.findOne(id);
  }

  async findRecent(limit = 10) {
    return this.drizzle.db
      .select()
      .from(transactions)
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
  }

  async findUpcoming() {
    const today = new Date().toISOString().split('T')[0];
    const plus3 = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    return this.drizzle.db
      .select()
      .from(transactions)
      .where(
        and(
          gte(transactions.pickupDate, today),
          lte(transactions.pickupDate, plus3),
          not(inArray(transactions.status, ['claimed', 'cancelled'])),
        ),
      )
      .orderBy(transactions.pickupDate);
  }

  async todayCollections() {
    const today = new Date().toISOString().split('T')[0];
    return this.drizzle.db
      .select({
        id: claimPayments.id,
        transactionId: claimPayments.transactionId,
        method: claimPayments.method,
        amount: claimPayments.amount,
        paidAt: claimPayments.paidAt,
        txnNumber: transactions.number,
        customerName: transactions.customerName,
      })
      .from(claimPayments)
      .innerJoin(transactions, eq(claimPayments.transactionId, transactions.id))
      .where(sql`${claimPayments.paidAt}::date = ${today}::date`)
      .orderBy(desc(claimPayments.paidAt));
  }

  // Auto-sync transaction status when items change (multi-item only)
  private async syncTransactionStatus(transactionId: number): Promise<void> {
    const [txn] = await this.drizzle.db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId));
    if (!txn || txn.status === 'cancelled') return;

    const items = await this.drizzle.db
      .select()
      .from(transactionItems)
      .where(eq(transactionItems.transactionId, transactionId));

    if (items.length <= 1) return; // Only auto-sync multi-item transactions

    const nonCancelledItems = items.filter((i) => i.status !== 'cancelled');
    if (nonCancelledItems.length === 0) return;

    const allClaimed = nonCancelledItems.every((i) => i.status === 'claimed');
    if (allClaimed && txn.status !== 'claimed') {
      await this.drizzle.db
        .update(transactions)
        .set({ status: 'claimed', claimedAt: new Date(), updatedAt: new Date() })
        .where(eq(transactions.id, transactionId));
      return;
    }

    const someClaimed = nonCancelledItems.some((i) => i.status === 'claimed');
    if (someClaimed && txn.status !== 'in_progress' && txn.status !== 'claimed') {
      await this.drizzle.db
        .update(transactions)
        .set({ status: 'in_progress', updatedAt: new Date() })
        .where(eq(transactions.id, transactionId));
    }
  }

  async updateItem(
    transactionId: number,
    itemId: number,
    dto: UpdateItemDto,
    performedBy?: string,
  ) {
    const txn = await this.findOne(transactionId);

    const [existing] = await this.drizzle.db
      .select()
      .from(transactionItems)
      .where(eq(transactionItems.id, itemId));

    if (!existing) throw new NotFoundException(`Item ${itemId} not found`);

    const [updated] = await this.drizzle.db
      .update(transactionItems)
      .set(dto)
      .where(eq(transactionItems.id, itemId))
      .returning();

    if (dto.status && dto.status !== existing.status) {
      const branchId = performedBy ? await this.users.getBranchId(performedBy) : null;

      await this.audit.log({
        action: 'status_change',
        auditType: AUDIT_TYPE.ITEM_STATUS_CHANGED,
        entityType: 'transaction_item',
        entityId: String(itemId),
        source: 'pos',
        performedBy,
        branchId: branchId ?? undefined,
        details: {
          transactionNumber: txn.number,
          from: existing.status,
          to: dto.status,
          shoe: existing.shoeDescription,
        },
      });

      // Auto-sync parent transaction status
      await this.syncTransactionStatus(transactionId);
    }

    return updated;
  }

  async addPayment(id: number, dto: AddPaymentDto, performedBy?: string) {
    const txn = await this.findOne(id);

    const [payment] = await this.drizzle.db
      .insert(claimPayments)
      .values({
        transactionId: id,
        method: dto.method,
        amount: dto.amount,
      })
      .returning();

    const newPaid = (parseFloat(txn.paid) + parseFloat(dto.amount)).toFixed(2);
    await this.drizzle.db
      .update(transactions)
      .set({ paid: newPaid, updatedAt: new Date() })
      .where(eq(transactions.id, id));

    const branchId = performedBy ? await this.users.getBranchId(performedBy) : null;

    await this.audit.log({
      action: 'payment_add',
      auditType: AUDIT_TYPE.PAYMENT_ADDED,
      entityType: 'transaction',
      entityId: txn.number,
      source: 'pos',
      performedBy,
      branchId: branchId ?? undefined,
      details: { method: dto.method, amount: dto.amount, newPaid },
    });

    return payment;
  }

  async remove(id: number, performedBy?: string) {
    const txn = await this.findOne(id);

    await this.drizzle.db.delete(transactions).where(eq(transactions.id, id));

    const branchId = performedBy ? await this.users.getBranchId(performedBy) : null;

    await this.audit.log({
      action: 'delete',
      auditType: AUDIT_TYPE.TRANSACTION_CANCELLED,
      entityType: 'transaction',
      entityId: txn.number,
      source: 'admin',
      performedBy,
      branchId: branchId ?? undefined,
    });
  }
}
