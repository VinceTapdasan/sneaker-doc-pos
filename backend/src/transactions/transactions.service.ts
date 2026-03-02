import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  eq,
  desc,
  sql,
  gte,
  lte,
  and,
  not,
  inArray,
  ilike,
  or,
} from 'drizzle-orm';
import { DrizzleService } from '../db/drizzle.service';
import {
  transactions,
  transactionItems,
  claimPayments,
  customers,
  promos,
  services,
} from '../db/schema';
import {
  TRANSACTION_STATUS,
  AUDIT_TYPE,
  type AuditType,
} from '../db/constants';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { AddPaymentDto } from './dto/add-payment.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { toScaled, fromScaled } from '../utils/money';

export interface FindAllParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  from?: string;
  to?: string;
  branchId?: number;
}

// Map raw transaction row fields to unscaled money strings
function mapTxn<T extends { total: number; paid: number }>(txn: T) {
  return { ...txn, total: fromScaled(txn.total), paid: fromScaled(txn.paid) };
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
    if (from)
      conditions.push(
        gte(transactions.createdAt, new Date(`${from}T00:00:00`)),
      );
    if (to)
      conditions.push(lte(transactions.createdAt, new Date(`${to}T23:59:59`)));
    if (search) {
      conditions.push(
        or(
          ilike(transactions.number, `%${search}%`),
          ilike(transactions.customerName, `%${search}%`),
          ilike(transactions.customerPhone, `%${search}%`),
        ) as ReturnType<typeof eq>,
      );
    }

    const rows = await this.drizzle.db
      .select()
      .from(transactions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(transactions.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map(mapTxn);
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
      ...new Set(itemRows.flatMap((r) => r.item.addonServiceIds ?? [])),
    ];
    const addonMap = new Map<
      number,
      { id: number; name: string; type: string }
    >();
    if (allAddonIds.length > 0) {
      const addonRows = await this.drizzle.db
        .select()
        .from(services)
        .where(inArray(services.id, allAddonIds));
      addonRows.forEach((s) =>
        addonMap.set(s.id, { id: s.id, name: s.name, type: s.type }),
      );
    }

    const items = itemRows.map((r) => ({
      ...r.item,
      price: r.item.price !== null ? fromScaled(r.item.price) : null,
      service: r.service
        ? { id: r.service.id, name: r.service.name, type: r.service.type }
        : null,
      addonServices: (r.item.addonServiceIds ?? [])
        .map((id) => addonMap.get(id))
        .filter(Boolean),
    }));

    const payments = await this.drizzle.db
      .select()
      .from(claimPayments)
      .where(eq(claimPayments.transactionId, id));

    return {
      ...mapTxn(row.txn),
      promo: row.promo ?? null,
      items,
      payments: payments.map((p) => ({ ...p, amount: fromScaled(p.amount) })),
    };
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

    // Validate pickup date is not in the past
    if (dto.pickupDate) {
      const today = new Date().toISOString().split('T')[0];
      if (dto.pickupDate < today) {
        throw new BadRequestException('Pickup date cannot be in the past');
      }
    }

    // Resolve branch from the performing user
    const branchId = performedBy
      ? await this.users.getBranchId(performedBy)
      : null;

    const [created] = await this.drizzle.db
      .insert(transactions)
      .values({
        number,
        customerName: dto.customerName ?? null,
        customerPhone: dto.customerPhone ?? null,
        customerEmail: dto.customerEmail ?? null,
        status: dto.status ?? 'pending',
        pickupDate: dto.pickupDate ?? null,
        total: toScaled(dto.total ?? '0'),
        paid: toScaled(dto.paid ?? '0'),
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
          addonServiceIds: item.addonServiceIds?.length
            ? item.addonServiceIds
            : null,
          status: item.status ?? 'pending',
          beforeImageUrl: item.beforeImageUrl ?? null,
          afterImageUrl: item.afterImageUrl ?? null,
          price:
            item.price !== undefined && item.price !== null
              ? toScaled(item.price)
              : null,
        })),
      );
    }

    if (dto.customerPhone && !dto.isExistingCustomer) {
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
      details: {
        number: created.number,
        customerName: created.customerName,
        total: created.total, // scaled bigint in audit details (intentional)
      },
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

    // Validate pickup date is not in the past
    if (dto.pickupDate) {
      const today = new Date().toISOString().split('T')[0];
      if (dto.pickupDate < today) {
        throw new BadRequestException('Pickup date cannot be in the past');
      }
    }
    if (dto.newPickupDate) {
      const today = new Date().toISOString().split('T')[0];
      if (dto.newPickupDate < today) {
        throw new BadRequestException(
          'Rescheduled pickup date cannot be in the past',
        );
      }
    }

    const setValues: Record<string, unknown> = {
      ...dto,
      ...(dto.total !== undefined && { total: toScaled(dto.total) }),
      ...(dto.paid !== undefined && { paid: toScaled(dto.paid) }),
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
    } else if (
      dto.newPickupDate !== undefined &&
      dto.newPickupDate !== existing.newPickupDate
    ) {
      auditType = AUDIT_TYPE.PICKUP_RESCHEDULED;
      auditDetails = {
        from: existing.newPickupDate ?? existing.pickupDate,
        to: dto.newPickupDate,
      };
    }

    const branchId = performedBy
      ? await this.users.getBranchId(performedBy)
      : null;

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
    const rows = await this.drizzle.db
      .select()
      .from(transactions)
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
    return rows.map(mapTxn);
  }

  async findUpcoming() {
    const today = new Date().toISOString().split('T')[0];
    const plus3 = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const rows = await this.drizzle.db
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
    return rows.map(mapTxn);
  }

  async collectionsSummary(year: number, month: number, branchId?: number) {
    const from = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00`);
    const lastDay = new Date(year, month, 0).getDate();
    const to = new Date(
      `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59`,
    );

    const conditions: ReturnType<typeof eq>[] = [
      gte(claimPayments.paidAt, from),
      lte(claimPayments.paidAt, to),
    ];
    if (branchId) conditions.push(eq(transactions.branchId, branchId));

    const rows = await this.drizzle.db
      .select({
        method: claimPayments.method,
        total: sql<number>`COALESCE(SUM(${claimPayments.amount}), 0)`,
      })
      .from(claimPayments)
      .innerJoin(transactions, eq(claimPayments.transactionId, transactions.id))
      .where(and(...conditions))
      .groupBy(claimPayments.method);

    const result: Record<string, string> = {
      cash: '0.00',
      gcash: '0.00',
      card: '0.00',
      bank_deposit: '0.00',
    };
    rows.forEach((r) => {
      result[r.method] = fromScaled(r.total);
    });
    return result;
  }

  async todayCollections() {
    const today = new Date().toISOString().split('T')[0];
    const rows = await this.drizzle.db
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
    return rows.map((r) => ({ ...r, amount: fromScaled(r.amount) }));
  }

  // Auto-sync transaction status and total when items change
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

    const nonCancelledItems = items.filter((i) => i.status !== 'cancelled');
    const cancelledItems = items.filter((i) => i.status === 'cancelled');

    // All items cancelled → cancel the transaction
    if (nonCancelledItems.length === 0) {
      await this.drizzle.db
        .update(transactions)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(transactions.id, transactionId));
      return;
    }

    // Some items cancelled → recalculate total from non-cancelled item prices
    if (cancelledItems.length > 0) {
      const rawSubtotalScaled = nonCancelledItems.reduce(
        (sum, i) => sum + (i.price ?? 0),
        0,
      );

      let newTotalScaled = rawSubtotalScaled;

      if (txn.promoId) {
        const [promo] = await this.drizzle.db
          .select()
          .from(promos)
          .where(eq(promos.id, txn.promoId));
        if (promo) {
          const discountFactor = 1 - parseFloat(promo.percent) / 100;
          newTotalScaled = Math.round(rawSubtotalScaled * discountFactor);
        }
      }

      await this.drizzle.db
        .update(transactions)
        .set({ total: newTotalScaled, updatedAt: new Date() })
        .where(eq(transactions.id, transactionId));
    }

    // Multi-item status sync
    if (items.length <= 1) return;

    const allClaimed = nonCancelledItems.every((i) => i.status === 'claimed');
    if (allClaimed && txn.status !== 'claimed') {
      await this.drizzle.db
        .update(transactions)
        .set({
          status: 'claimed',
          claimedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, transactionId));
      return;
    }

    const someClaimed = nonCancelledItems.some((i) => i.status === 'claimed');
    if (
      someClaimed &&
      txn.status !== 'in_progress' &&
      txn.status !== 'claimed'
    ) {
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
      const branchId = performedBy
        ? await this.users.getBranchId(performedBy)
        : null;

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

    const scaledAmount = toScaled(dto.amount);

    const [payment] = await this.drizzle.db
      .insert(claimPayments)
      .values({
        transactionId: id,
        method: dto.method,
        amount: scaledAmount,
      })
      .returning();

    // Compute new paid in scaled domain then store
    const newPaidScaled = toScaled(txn.paid) + scaledAmount;
    await this.drizzle.db
      .update(transactions)
      .set({ paid: newPaidScaled, updatedAt: new Date() })
      .where(eq(transactions.id, id));

    const branchId = performedBy
      ? await this.users.getBranchId(performedBy)
      : null;

    await this.audit.log({
      action: 'payment_add',
      auditType: AUDIT_TYPE.PAYMENT_ADDED,
      entityType: 'transaction',
      entityId: txn.number,
      source: 'pos',
      performedBy,
      branchId: branchId ?? undefined,
      details: {
        method: dto.method,
        amount: payment.amount,
        newPaid: newPaidScaled,
      },
    });

    return { ...payment, amount: fromScaled(payment.amount) };
  }

  async remove(id: number, performedBy?: string) {
    const txn = await this.findOne(id);

    await this.drizzle.db.delete(transactions).where(eq(transactions.id, id));

    const branchId = performedBy
      ? await this.users.getBranchId(performedBy)
      : null;

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
