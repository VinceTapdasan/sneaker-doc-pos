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
  ne,
  inArray,
  ilike,
  or,
  isNotNull,
  isNull,
} from 'drizzle-orm';
import { DrizzleService } from '../db/drizzle.service';
import {
  transactions,
  transactionItems,
  transactionPhotos,
  claimPayments,
  customers,
  promos,
  services,
  branches,
  deposits,
  users as usersTable, // alias to avoid conflict with this.users (UsersService)
} from '../db/schema';
import {
  TRANSACTION_STATUS,
  AUDIT_TYPE,
  type AuditType,
} from '../db/constants';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { SmsService } from '../sms/sms.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { AddPaymentDto } from './dto/add-payment.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { AddPhotoDto } from './dto/add-photo.dto';
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
    private readonly sms: SmsService,
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

    // Always exclude soft-deleted transactions
    conditions.push(isNull(transactions.deletedAt) as ReturnType<typeof eq>);

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
      .select({ txn: transactions, promo: promos, staff: usersTable, branch: branches })
      .from(transactions)
      .leftJoin(promos, eq(transactions.promoId, promos.id))
      .leftJoin(usersTable, eq(transactions.staffId, usersTable.id))
      .leftJoin(branches, eq(transactions.branchId, branches.id))
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

    const photos = await this.drizzle.db
      .select()
      .from(transactionPhotos)
      .where(eq(transactionPhotos.transactionId, id))
      .orderBy(transactionPhotos.createdAt)
      .catch(() => []); // graceful fallback if migration hasn't run yet

    // Fetch customer address if phone is available
    let customerAddress: {
      streetName: string | null;
      barangay: string | null;
      city: string | null;
      province: string | null;
    } | null = null;
    if (row.txn.customerPhone) {
      const [cust] = await this.drizzle.db
        .select({
          streetName: customers.streetName,
          barangay: customers.barangay,
          city: customers.city,
          province: customers.province,
        })
        .from(customers)
        .where(eq(customers.phone, row.txn.customerPhone))
        .limit(1);
      customerAddress = cust ?? null;
    }

    return {
      ...mapTxn(row.txn),
      promo: row.promo ?? null,
      items,
      payments: payments.map((p) => ({ ...p, amount: fromScaled(p.amount) })),
      customerStreetName: customerAddress?.streetName ?? null,
      customerBarangay: customerAddress?.barangay ?? null,
      customerCity: customerAddress?.city ?? null,
      customerProvince: customerAddress?.province ?? null,
      staffNickname: row.staff?.nickname ?? null,
      staffId: row.txn.staffId ?? null,
      branchName: row.branch?.name ?? null,
      branchStreetName: row.branch?.streetName ?? null,
      branchBarangay: row.branch?.barangay ?? null,
      branchCity: row.branch?.city ?? null,
      branchProvince: row.branch?.province ?? null,
      branchPhone: row.branch?.phone ?? null,
      photos,
    };
  }

  async findByNumber(number: string) {
    const [txn] = await this.drizzle.db
      .select()
      .from(transactions)
      .where(and(eq(transactions.number, number), isNull(transactions.deletedAt)));
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
        staffId: dto.staffId ?? performedBy ?? null,
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
          streetName: dto.customerStreetName ?? null,
          barangay: dto.customerBarangay ?? null,
          city: dto.customerCity ?? null,
          province: dto.customerProvince ?? null,
          country: dto.customerCountry ?? null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: customers.phone,
          set: {
            name: dto.customerName ?? null,
            email: dto.customerEmail ?? null,
            streetName: dto.customerStreetName ?? null,
            barangay: dto.customerBarangay ?? null,
            city: dto.customerCity ?? null,
            province: dto.customerProvince ?? null,
            country: dto.customerCountry ?? null,
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
        txnNumber: created.number,
        createdAt: created.createdAt,
        customerName: created.customerName ?? null,
        customerPhone: created.customerPhone ?? null,
        customerEmail: created.customerEmail ?? null,
        pickupDate: created.pickupDate ?? null,
        total: fromScaled(created.total),
        paid: fromScaled(created.paid),
        status: created.status,
        promoId: created.promoId ?? null,
        staffId: created.staffId ?? null,
        branchId: created.branchId ?? null,
        itemCount: dto.items?.length ?? 0,
        items: (dto.items ?? []).map((i) => ({
          shoe: i.shoeDescription ?? null,
          serviceId: i.serviceId ?? null,
          price: i.price ?? null,
        })),
        note: dto.note ?? null,
        source,
      },
    });

    if (dto.staffId) {
      await this.audit.log({
        action: 'assign',
        auditType: AUDIT_TYPE.TRANSACTION_ASSIGNED,
        entityType: 'transaction',
        entityId: created.number,
        source,
        performedBy,
        branchId: branchId ?? undefined,
        details: { staffId: dto.staffId, txnNumber: created.number },
      });
    }

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
        auditDetails = { from: prevStatus, to: dto.status, refundedAmount: existing.paid };
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
    } else if ('staffId' in dto && dto.staffId !== existing.staffId) {
      auditType = AUDIT_TYPE.TRANSACTION_ASSIGNED;
      action = 'assign';
      auditDetails = { from: existing.staffId ?? null, to: dto.staffId ?? null };
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

    // Auto-fire SMS when pickup is rescheduled and customer has a phone number
    if (
      dto.newPickupDate !== undefined &&
      dto.newPickupDate !== existing.newPickupDate &&
      updated.customerPhone
    ) {
      this.sms.sendScheduleChangedSms({
        customerPhone: updated.customerPhone,
        customerName: updated.customerName,
        number: updated.number,
        newPickupDate: dto.newPickupDate,
      }).catch((err) => {
        // Fire-and-forget — don't fail the update if SMS fails
        console.error('Failed to send reschedule SMS:', err);
      });
    }

    return this.findOne(id);
  }

  async findRecent(limit = 10, branchId?: number) {
    const conditions: ReturnType<typeof eq>[] = [
      isNull(transactions.deletedAt) as ReturnType<typeof eq>,
    ];
    if (branchId) conditions.push(eq(transactions.branchId, branchId));
    const rows = await this.drizzle.db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
    return rows.map(mapTxn);
  }

  async findUpcoming(branchId?: number) {
    const today = new Date().toISOString().split('T')[0];
    const plus3 = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const rows = await this.drizzle.db
      .select()
      .from(transactions)
      .where(
        and(
          isNull(transactions.deletedAt),
          ...(branchId ? [eq(transactions.branchId, branchId)] : []),
          not(inArray(transactions.status, ['done', 'claimed', 'cancelled'])),
          or(
            // original pickup date within 3 days
            and(
              gte(transactions.pickupDate, today),
              lte(transactions.pickupDate, plus3),
            ),
            // OR rescheduled date within 3 days
            and(
              isNotNull(transactions.newPickupDate),
              gte(transactions.newPickupDate, today),
              lte(transactions.newPickupDate, plus3),
            ),
          ),
        ),
      )
      .orderBy(sql`COALESCE(${transactions.newPickupDate}, ${transactions.pickupDate}) ASC`);
    return rows.map(mapTxn);
  }

  async findUpcomingByMonth(year: number, month: number, branchId?: number) {
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const rows = await this.drizzle.db
      .select()
      .from(transactions)
      .where(
        and(
          isNull(transactions.deletedAt),
          ...(branchId ? [eq(transactions.branchId, branchId)] : []),
          not(inArray(transactions.status, ['claimed', 'cancelled'])),
          or(
            and(gte(transactions.pickupDate, from), lte(transactions.pickupDate, to)),
            and(
              isNotNull(transactions.newPickupDate),
              gte(transactions.newPickupDate, from),
              lte(transactions.newPickupDate, to),
            ),
          ),
        ),
      )
      .orderBy(sql`COALESCE(${transactions.newPickupDate}, ${transactions.pickupDate}) ASC`);
    return rows.map(mapTxn);
  }

  async collectionsSummary(year: number, month: number, branchId?: number) {
    // month=0 means full year
    const from = month === 0
      ? new Date(`${year}-01-01T00:00:00`)
      : new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00`);
    const to = month === 0
      ? new Date(`${year}-12-31T23:59:59`)
      : (() => {
          const lastDay = new Date(year, month, 0).getDate();
          return new Date(`${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59`);
        })();

    const conditions: ReturnType<typeof eq>[] = [
      gte(claimPayments.paidAt, from),
      lte(claimPayments.paidAt, to),
      isNull(transactions.deletedAt) as ReturnType<typeof eq>,
      ne(transactions.status, 'cancelled') as ReturnType<typeof eq>,
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

    const collected: Record<string, number> = {
      cash: 0,
      gcash: 0,
      card: 0,
      bank_deposit: 0,
    };
    rows.forEach((r) => {
      collected[r.method] = r.total;
    });

    // Fetch bank deposit total to compute net GCash (gcash collected - deposited to bank)
    // month=0 means full year — sum across all months
    const depositConditions: ReturnType<typeof eq>[] = [
      eq(deposits.year, year),
      eq(deposits.method, 'bank_deposit'),
      (branchId ? eq(deposits.branchId, branchId) : isNull(deposits.branchId)) as ReturnType<typeof eq>,
      ...(month !== 0 ? [eq(deposits.month, month)] : []),
    ];
    const depositRows = await this.drizzle.db
      .select({ total: sql<number>`COALESCE(SUM(${deposits.amount}), 0)` })
      .from(deposits)
      .where(and(...depositConditions));
    const bankDepositedScaled = depositRows[0]?.total ?? 0;

    const gcashNet = Math.max(0, collected.gcash - bankDepositedScaled);

    return {
      cash: fromScaled(collected.cash),
      gcash: fromScaled(gcashNet),
      card: fromScaled(collected.card),
      bank_deposit: fromScaled(bankDepositedScaled),
    };
  }

  async todayCollections(branchId?: number) {
    const today = new Date().toISOString().split('T')[0];
    const conditions: ReturnType<typeof eq>[] = [
      sql`${claimPayments.paidAt}::date = ${today}::date` as ReturnType<typeof eq>,
      isNull(transactions.deletedAt) as ReturnType<typeof eq>,
      ne(transactions.status, 'cancelled') as ReturnType<typeof eq>,
    ];
    if (branchId) conditions.push(eq(transactions.branchId, branchId) as ReturnType<typeof eq>);
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
      .where(and(...conditions))
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

    const nonCancelled = items.filter((i) => i.status !== 'cancelled');
    const cancelled = items.filter((i) => i.status === 'cancelled');

    // All items cancelled → cancel the transaction
    if (nonCancelled.length === 0) {
      await this.drizzle.db
        .update(transactions)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(transactions.id, transactionId));
      return;
    }

    // Some items cancelled → recalculate total from non-cancelled item prices
    if (cancelled.length > 0) {
      const rawSubtotalScaled = nonCancelled.reduce(
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

    // Derive overall status using priority: in_progress > pending > done > claimed
    // Applies to both single-item and multi-item transactions
    const statuses = new Set(nonCancelled.map((i) => i.status));
    let derived: string;
    if (statuses.has('in_progress')) {
      derived = 'in_progress';
    } else if (statuses.has('pending')) {
      derived = 'pending';
    } else if (statuses.has('done')) {
      derived = 'done'; // all done, or mix of done + claimed (shoes still to pick up)
    } else {
      derived = 'claimed'; // all non-cancelled items claimed
    }

    if (derived === txn.status) return;

    await this.drizzle.db
      .update(transactions)
      .set({
        status: derived,
        ...(derived === 'claimed' ? { claimedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, transactionId));
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
          ...(dto.status === 'cancelled' && existing.price !== null
            ? { refundedAmount: fromScaled(existing.price) }
            : {}),
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
        referenceNumber: dto.referenceNumber ?? null,
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
        paidAt: payment.paidAt,
        txnNumber: txn.number,
        txnStatus: txn.status,
        customerName: txn.customerName ?? null,
        customerPhone: txn.customerPhone ?? null,
        staffId: txn.staffId ?? null,
        payment: {
          method: dto.method,
          amount: fromScaled(payment.amount),
          referenceNumber: dto.referenceNumber ?? null,
        },
        balanceBefore: txn.paid,
        balanceAfter: fromScaled(newPaidScaled),
        totalDue: txn.total,
        itemCount: txn.items?.length ?? 0,
        items: (txn.items ?? []).map((i) => ({
          id: i.id,
          shoe: i.shoeDescription ?? null,
          service: i.service?.name ?? null,
          price: i.price ?? null,
          status: i.status,
        })),
      },
    });

    return { ...payment, amount: fromScaled(payment.amount) };
  }

  async sendPickupReadySms(id: number): Promise<{ phone: string }> {
    const txn = await this.findOne(id);

    if (!txn.customerPhone) {
      throw new BadRequestException('Customer has no phone number on file.');
    }

    const name = txn.customerName ?? 'Customer';
    const pickupDate = txn.newPickupDate ?? txn.pickupDate;
    const dateStr = pickupDate
      ? new Date(pickupDate).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
      : null;
    const message = [
      `Hi ${name}! Your shoe(s) are ready for pickup at Sneaker Doctor.`,
      `Transaction #${txn.number}.`,
      ...(dateStr ? [`Pickup Date: ${dateStr}.`] : []),
      `See you soon!`,
    ].join(' ');

    await this.sms.send({ to: txn.customerPhone, message });

    return { phone: txn.customerPhone };
  }

  async addPhoto(id: number, dto: AddPhotoDto) {
    const [photo] = await this.drizzle.db
      .insert(transactionPhotos)
      .values({ transactionId: id, type: dto.type, url: dto.url })
      .returning();
    return photo;
  }

  async removePhoto(txnId: number, photoId: number) {
    await this.drizzle.db
      .delete(transactionPhotos)
      .where(and(eq(transactionPhotos.id, photoId), eq(transactionPhotos.transactionId, txnId)));
  }

  async remove(id: number, performedBy?: string) {
    const txn = await this.findOne(id);

    if (txn.status === 'claimed') {
      throw new BadRequestException('Cannot delete a claimed transaction.');
    }
    if (toScaled(txn.paid) > 0) {
      throw new BadRequestException('Cannot delete a transaction with recorded payments.');
    }

    await this.drizzle.db
      .update(transactions)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(transactions.id, id));

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

  async findDeleted(branchId?: number) {
    const conditions: ReturnType<typeof eq>[] = [
      isNotNull(transactions.deletedAt) as ReturnType<typeof eq>,
    ];
    if (branchId) conditions.push(eq(transactions.branchId, branchId));
    const rows = await this.drizzle.db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.deletedAt));
    return rows.map(mapTxn);
  }

  async restore(id: number, performedBy?: string) {
    const [txn] = await this.drizzle.db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), isNotNull(transactions.deletedAt)));
    if (!txn) throw new NotFoundException(`Deleted transaction ${id} not found`);

    const [restored] = await this.drizzle.db
      .update(transactions)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq(transactions.id, id))
      .returning();

    const branchId = performedBy
      ? await this.users.getBranchId(performedBy)
      : null;

    await this.audit.log({
      action: 'restore',
      auditType: AUDIT_TYPE.TRANSACTION_RESTORED,
      entityType: 'transaction',
      entityId: txn.number,
      source: 'admin',
      performedBy,
      branchId: branchId ?? undefined,
      details: { restored: true },
    });

    return mapTxn(restored);
  }
}
