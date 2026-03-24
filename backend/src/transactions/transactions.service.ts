import {
  BadRequestException,
  Injectable,
  Logger,
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
  getTableColumns,
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
  expenses,
  users as usersTable, // alias to avoid conflict with this.users (UsersService)
} from '../db/schema';
import {
  TRANSACTION_STATUS,
  AUDIT_TYPE,
  type AuditType,
  computeCardFee,
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
import { PromosService } from '../promos/promos.service';

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
    private readonly promosService: PromosService,
  ) {}

  // Generate next zero-padded transaction number using advisory lock to prevent race conditions.
  // pg_advisory_xact_lock(1) serialises concurrent callers within the current transaction.
  private async nextNumber(): Promise<string> {
    const [result] = await this.drizzle.db.execute(
      sql`SELECT pg_advisory_xact_lock(1), COALESCE(MAX(CAST(${transactions.number} AS INTEGER)), 0) AS max FROM ${transactions}`,
    );
    const max = Number((result as Record<string, unknown>)?.max ?? 0);
    return String(max + 1).padStart(4, '0');
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
      city: string | null;
    } | null = null;
    if (row.txn.customerPhone) {
      const [cust] = await this.drizzle.db
        .select({
          streetName: customers.streetName,
          city: customers.city,
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
      customerCity: customerAddress?.city ?? null,
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

    // Validate promo usage limit before creating
    if (dto.promoId) {
      await this.promosService.validatePromoApplicable(dto.promoId);
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
        staffId: dto.staffId ?? null, // do not auto-assign to creator — leave unassigned unless explicitly set
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

    if (dto.customerPhone) {
      await this.drizzle.db
        .insert(customers)
        .values({
          phone: dto.customerPhone,
          name: dto.customerName ?? null,
          email: dto.customerEmail ?? null,
          streetName: dto.customerStreetName ?? null,
          city: dto.customerCity ?? null,
          country: dto.customerCountry ?? null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: customers.phone,
          set: {
            name: dto.customerName ?? null,
            email: dto.customerEmail ?? null,
            streetName: dto.customerStreetName ?? null,
            city: dto.customerCity ?? null,
            country: dto.customerCountry ?? null,
            updatedAt: new Date(),
          },
        });

      await this.audit.log({
        action: dto.isExistingCustomer ? 'update' : 'create',
        auditType: AUDIT_TYPE.CUSTOMER_UPSERTED,
        entityType: 'customer',
        entityId: dto.customerPhone,
        source,
        performedBy,
        branchId: branchId ?? undefined,
        details: {
          txnNumber: created.number,
          phone: dto.customerPhone,
          name: dto.customerName ?? null,
          email: dto.customerEmail ?? null,
          streetName: dto.customerStreetName ?? null,
          city: dto.customerCity ?? null,
          country: dto.customerCountry ?? null,
          isExistingCustomer: dto.isExistingCustomer ?? false,
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

    // When promoId changes, recalculate total from non-cancelled items
    // This handles: apply new promo, switch promo, remove promo (null)
    const promoIdChanged = 'promoId' in dto && dto.promoId !== existing.promoId;

    // Validate usage limit before applying a new promo
    if (promoIdChanged && dto.promoId != null) {
      await this.promosService.validatePromoApplicable(dto.promoId);
    }
    if (promoIdChanged) {
      const items = await this.drizzle.db
        .select()
        .from(transactionItems)
        .where(eq(transactionItems.transactionId, id));
      const rawSubtotalScaled = items
        .filter((i) => i.status !== 'cancelled')
        .reduce((sum, i) => sum + (i.price ?? 0), 0);
      let newTotalScaled = rawSubtotalScaled;
      const newPromoId = dto.promoId ?? null;
      if (newPromoId) {
        const [promo] = await this.drizzle.db
          .select()
          .from(promos)
          .where(eq(promos.id, newPromoId));
        if (promo) {
          const discountFactor = 1 - parseFloat(promo.percent) / 100;
          newTotalScaled = Math.round(rawSubtotalScaled * discountFactor);
        }
      }
      setValues.total = newTotalScaled;
    }
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
      let assignedStaff: { fullName: string | null; email: string } | null = null;
      if (dto.staffId) {
        assignedStaff = await this.users.findById(dto.staffId) as { fullName: string | null; email: string } | null;
      }
      auditDetails = {
        from: existing.staffId ?? null,
        to: dto.staffId ?? null,
        assignedFullName: assignedStaff?.fullName ?? null,
        assignedEmail: assignedStaff?.email ?? null,
      };
    } else if (promoIdChanged) {
      auditType = AUDIT_TYPE.TRANSACTION_UPDATED;
      action = 'promo_change';
      auditDetails = {
        promoFrom: existing.promoId ?? null,
        promoTo: dto.promoId ?? null,
        totalAfter: fromScaled(updated.total),
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

    // Auto-fire SMS when pickup is rescheduled and customer has a phone number
    if (
      dto.newPickupDate !== undefined &&
      dto.newPickupDate !== existing.newPickupDate &&
      updated.customerPhone
    ) {
      const sender = performedBy ? await this.users.findById(performedBy) : null;
      this.sms.sendScheduleChangedSms({
        customerPhone: updated.customerPhone,
        customerName: updated.customerName,
        number: updated.number,
        newPickupDate: dto.newPickupDate,
      }).then(() => {
        return this.audit.log({
          action: 'sms_sent',
          auditType: AUDIT_TYPE.SMS_SENT,
          entityType: 'transaction',
          entityId: updated.number,
          source: 'pos',
          performedBy,
          branchId: branchId ?? undefined,
          details: {
            sentAt: new Date().toISOString(),
            smsType: 'schedule_changed',
            customerPhone: updated.customerPhone,
            txnNumber: updated.number,
            sentById: performedBy ?? null,
            sentByFullName: sender?.fullName ?? null,
            sentByEmail: sender?.email ?? null,
          },
        });
      }).catch((err) => {
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
      .select({
        ...getTableColumns(transactions),
        itemCount: sql<number>`CAST((SELECT COUNT(*) FROM transaction_items WHERE transaction_id = ${transactions.id} AND status != 'cancelled') AS INT)`,
      })
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
    return (rows as Array<typeof transactions.$inferSelect & { itemCount: number }>)
      .map((r) => ({ ...mapTxn(r), itemCount: Number(r.itemCount) }));
  }

  async findUpcomingByMonth(year: number, month: number, branchId?: number) {
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const rows = await this.drizzle.db
      .select({
        ...getTableColumns(transactions),
        itemCount: sql<number>`CAST((SELECT COUNT(*) FROM transaction_items WHERE transaction_id = ${transactions.id} AND status != 'cancelled') AS INT)`,
      })
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
    return (rows as Array<typeof transactions.$inferSelect & { itemCount: number }>)
      .map((r) => ({ ...mapTxn(r), itemCount: Number(r.itemCount) }));
  }

  async collectionsSummary(year: number, month: number, branchId?: number) {
    // year=0 means all-time — no date bounds
    const conditions: ReturnType<typeof eq>[] = [
      isNull(transactions.deletedAt) as ReturnType<typeof eq>,
      ne(transactions.status, 'cancelled') as ReturnType<typeof eq>,
    ];
    if (year !== 0) {
      const from = month === 0
        ? new Date(`${year}-01-01T00:00:00`)
        : new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00`);
      const to = month === 0
        ? new Date(`${year}-12-31T23:59:59`)
        : (() => {
            const lastDay = new Date(year, month, 0).getDate();
            return new Date(`${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59`);
          })();
      conditions.push(gte(claimPayments.paidAt, from) as ReturnType<typeof eq>);
      conditions.push(lte(claimPayments.paidAt, to) as ReturnType<typeof eq>);
    }
    if (branchId) conditions.push(eq(transactions.branchId, branchId));

    const rows = await this.drizzle.db
      .select({
        method: claimPayments.method,
        total: sql<number>`COALESCE(SUM(${claimPayments.amount}), 0)`,
        totalFee: sql<number>`COALESCE(SUM(${claimPayments.fee}), 0)`,
      })
      .from(claimPayments)
      .innerJoin(transactions, eq(claimPayments.transactionId, transactions.id))
      .where(and(...conditions))
      .groupBy(claimPayments.method);

    // NOTE: PostgreSQL SUM() returns strings via Drizzle — always coerce with Number()
    const collected: Record<string, number> = {
      cash: 0,
      gcash: 0,
      card: 0,
      bank_deposit: 0,
    };
    const fees: Record<string, number> = { card: 0 };
    rows.forEach((r) => {
      collected[r.method] = Number(r.total);
      if (r.method === 'card') fees.card = Number(r.totalFee);
    });
    // Card net = gross collected - fee paid to bank
    collected.card = Math.max(0, collected.card - fees.card);

    // Fetch bank deposit total separately (the deposits table tracks bank_deposit
    // amounts directly). Source-channel deductions are unreliable (upsertSingle
    // clamps new rows to 0 via Math.max), so we subtract from the correct channel
    // using the origin field.
    const depositConditions: ReturnType<typeof eq>[] = [
      eq(deposits.method, 'bank_deposit'),
      ...(year !== 0 ? [eq(deposits.year, year)] : []),
      ...(branchId ? [eq(deposits.branchId, branchId)] : []),
      ...(year !== 0 && month !== 0 ? [eq(deposits.month, month)] : []),
    ];
    const depositRows = await this.drizzle.db
      .select({
        origin: deposits.origin,
        total: sql<number>`COALESCE(SUM(${deposits.amount}), 0)`,
      })
      .from(deposits)
      .where(and(...depositConditions))
      .groupBy(deposits.origin);

    // Sum bank deposits and subtract from their respective source channels
    let bankDepositTotal = 0;
    depositRows.forEach((r) => {
      const amount = Number(r.total);
      bankDepositTotal += amount;
      // Subtract from the source channel (gcash, cash, card)
      const origin = r.origin ?? 'gcash';
      if (origin in collected) {
        collected[origin] = Math.max(0, collected[origin] - amount);
      }
    });

    return {
      cash: fromScaled(collected.cash),
      gcash: fromScaled(collected.gcash),
      card: fromScaled(collected.card),          // net (after card fees deducted)
      cardFee: fromScaled(fees.card),            // total card fees for the period
      bank_deposit: fromScaled(bankDepositTotal),
    };
  }

  async collectionsHistory(year: number, month: number, method: string, branchId?: number) {
    const from = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00`);
    const lastDay = new Date(year, month, 0).getDate();
    const to = new Date(`${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59`);

    const conditions: ReturnType<typeof eq>[] = [
      eq(claimPayments.method, method) as ReturnType<typeof eq>,
      gte(claimPayments.paidAt, from),
      lte(claimPayments.paidAt, to),
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

  /**
   * Pre-computed dashboard summary — ALL financial math happens here, not on the frontend.
   * Combines: monthly revenue/paid/balance, expenses total, net income, collection channels,
   * today's collections (list + total), and daily stats (staff view).
   */
  async dashboardSummary(year: number, month: number, branchId?: number) {
    const { from, to, fromDate, toDate } = this.getDateRange(year, month);

    // ---------- Shared conditions ----------
    const txnBaseConditions: ReturnType<typeof eq>[] = [
      isNull(transactions.deletedAt) as ReturnType<typeof eq>,
    ];
    // year=0 means all-time — skip date bounds
    if (from && to) {
      txnBaseConditions.push(gte(transactions.createdAt, from) as ReturnType<typeof eq>);
      txnBaseConditions.push(lte(transactions.createdAt, to) as ReturnType<typeof eq>);
    }
    if (branchId) txnBaseConditions.push(eq(transactions.branchId, branchId));
    const activeTxnConditions = [...txnBaseConditions, ne(transactions.status, 'cancelled') as ReturnType<typeof eq>];

    // ---------- Run all queries in parallel ----------
    const [
      revenueRow,
      statusRows,
      collectionsResult,
      expenseRow,
      todayCollectionRows,
      dailyRevenueRow,
      dailyCountRow,
    ] = await Promise.all([
      // 1. Monthly revenue + paid from active (non-cancelled) transactions
      this.drizzle.db
        .select({
          totalRevenue: sql<number>`COALESCE(SUM(${transactions.total}), 0)`,
          totalPaid: sql<number>`COALESCE(SUM(${transactions.paid}), 0)`,
          count: sql<number>`COUNT(*)`,
        })
        .from(transactions)
        .where(and(...activeTxnConditions)),

      // 2. Transaction counts by status
      this.drizzle.db
        .select({
          status: transactions.status,
          count: sql<number>`COUNT(*)`,
        })
        .from(transactions)
        .where(and(...txnBaseConditions))
        .groupBy(transactions.status),

      // 3. Collection channels (reuse existing method)
      this.collectionsSummary(year, month, branchId),

      // 4. Monthly expenses total (branch-scoped via staff membership)
      (async () => {
        // year=0 = all-time: no date bounds on expenses
        const baseConds: ReturnType<typeof eq>[] = [
          isNull(expenses.deletedAt) as ReturnType<typeof eq>,
        ];
        if (fromDate && toDate) {
          baseConds.push(gte(expenses.dateKey, fromDate) as ReturnType<typeof eq>);
          baseConds.push(lte(expenses.dateKey, toDate) as ReturnType<typeof eq>);
        }
        if (branchId) {
          const staffRows = await this.drizzle.db
            .select({ id: usersTable.id })
            .from(usersTable)
            .where(eq(usersTable.branchId, branchId));
          const staffIds = staffRows.map((u) => u.id);
          if (staffIds.length === 0) return [{ total: 0 }];
          return this.drizzle.db
            .select({ total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)` })
            .from(expenses)
            .where(and(...baseConds, inArray(expenses.staffId, staffIds)));
        }
        return this.drizzle.db
          .select({ total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)` })
          .from(expenses)
          .where(and(...baseConds));
      })(),

      // 5. Today's collections (list)
      this.todayCollections(branchId),

      // 6. Daily revenue stats (for staff view)
      (async () => {
        const today = new Date().toISOString().split('T')[0];
        const dailyConds = [
          sql`${transactions.createdAt}::date = ${today}::date` as ReturnType<typeof eq>,
          isNull(transactions.deletedAt),
          ne(transactions.status, 'cancelled') as ReturnType<typeof eq>,
        ];
        if (branchId) dailyConds.push(eq(transactions.branchId, branchId));
        return this.drizzle.db
          .select({
            totalRevenue: sql<number>`COALESCE(SUM(${transactions.total}), 0)`,
            totalPaid: sql<number>`COALESCE(SUM(${transactions.paid}), 0)`,
          })
          .from(transactions)
          .where(and(...dailyConds));
      })(),

      // 7. Daily transaction count
      (async () => {
        const today = new Date().toISOString().split('T')[0];
        const dailyConds = [
          sql`${transactions.createdAt}::date = ${today}::date` as ReturnType<typeof eq>,
          isNull(transactions.deletedAt),
          ne(transactions.status, 'cancelled') as ReturnType<typeof eq>,
        ];
        if (branchId) dailyConds.push(eq(transactions.branchId, branchId));
        return this.drizzle.db
          .select({ count: sql<number>`COUNT(*)` })
          .from(transactions)
          .where(and(...dailyConds));
      })(),
    ]);

    // ---------- Compute all values (Number() to guard against string coercion) ----------
    const totalRevenue = Number(revenueRow[0]?.totalRevenue ?? 0);
    const totalPaid = Number(revenueRow[0]?.totalPaid ?? 0);
    const txnCount = Number(revenueRow[0]?.count ?? 0);
    const totalExpenses = Number(expenseRow[0]?.total ?? 0);

    const byStatus: Record<string, number> = {};
    let totalAllStatuses = 0;
    statusRows.forEach((r) => {
      const c = Number(r.count);
      byStatus[r.status] = c;
      totalAllStatuses += c;
    });

    const todayCollTotal = todayCollectionRows.reduce(
      (s, c) => s + parseFloat(c.amount), 0,
    );

    const dailyRev = Number(dailyRevenueRow[0]?.totalRevenue ?? 0);
    const dailyPaid = Number(dailyRevenueRow[0]?.totalPaid ?? 0);
    const dailyCount = Number(dailyCountRow[0]?.count ?? 0);

    return {
      monthly: {
        transactionCount: txnCount,
        totalRevenue: fromScaled(totalRevenue),
        totalPaid: fromScaled(totalPaid),
        totalBalance: fromScaled(totalRevenue - totalPaid),
        totalExpenses: fromScaled(totalExpenses),
        netIncome: fromScaled(totalRevenue - totalExpenses),
        byStatus: { ...byStatus, total: totalAllStatuses },
      },
      collections: collectionsResult,
      todayCollections: todayCollectionRows,
      todayCollectionTotal: todayCollTotal.toFixed(2),
      daily: {
        count: dailyCount,
        totalRevenue: fromScaled(dailyRev),
        totalPaid: fromScaled(dailyPaid),
        totalBalance: fromScaled(dailyRev - dailyPaid),
      },
    };
  }

  private getDateRange(year: number, month: number) {
    // year=0 means all-time — no date bounds
    if (year === 0) {
      return { from: null, to: null, fromDate: null, toDate: null };
    }
    const from = month === 0
      ? new Date(`${year}-01-01T00:00:00`)
      : new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00`);
    const lastDay = month === 0 ? 31 : new Date(year, month, 0).getDate();
    const to = month === 0
      ? new Date(`${year}-12-31T23:59:59`)
      : new Date(`${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59`);
    const fromDate = month === 0
      ? `${year}-01-01`
      : `${year}-${String(month).padStart(2, '0')}-01`;
    const toDate = month === 0
      ? `${year}-12-31`
      : `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { from, to, fromDate, toDate };
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

    // Validate BEFORE writing — guards must run before any DB mutation
    if (dto.status && dto.status !== existing.status && dto.status === 'claimed') {
      const otherClaimable = (txn.items ?? []).filter(
        (i) => i.id !== itemId && i.status !== 'claimed' && i.status !== 'cancelled',
      );
      if (otherClaimable.length === 0 && txn.total > txn.paid) {
        throw new BadRequestException('Balance must be fully settled before the last item can be claimed.');
      }
    }

    const [updated] = await this.drizzle.db
      .update(transactionItems)
      .set(dto)
      .where(eq(transactionItems.id, itemId))
      .returning();

    if (dto.status && dto.status !== existing.status) {

      const branchId = performedBy
        ? await this.users.getBranchId(performedBy)
        : null;

      const remainingAfterClaim = dto.status === 'claimed'
        ? (txn.items ?? []).filter(
            (i) => i.id !== itemId && i.status !== 'claimed' && i.status !== 'cancelled',
          ).length
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
          ...(dto.status === 'claimed' && remainingAfterClaim !== null
            ? { isPartialClaim: remainingAfterClaim > 0, remainingItems: remainingAfterClaim }
            : {}),
        },
      });

      // Auto-create refund expense when an item is cancelled
      if (dto.status === 'cancelled' && existing.price !== null && existing.price > 0) {
        const todayKey = new Date().toISOString().split('T')[0];
        const refundAmount = existing.price; // already scaled
        const [refundExpense] = await this.drizzle.db
          .insert(expenses)
          .values({
            dateKey: todayKey,
            category: 'Refund',
            note: `Refund — Txn #${txn.number} — ${existing.shoeDescription || 'Item'}`,
            method: 'cash',
            source: 'system',
            amount: refundAmount,
            staffId: performedBy ?? null,
          })
          .returning();

        await this.audit.log({
          action: 'create',
          auditType: AUDIT_TYPE.ITEM_STATUS_CHANGED,
          entityType: 'expense',
          entityId: String(refundExpense.id),
          source: 'system',
          performedBy,
          branchId: branchId ?? undefined,
          details: {
            reason: 'item_cancellation_refund',
            transactionNumber: txn.number,
            shoe: existing.shoeDescription,
            refundAmount: fromScaled(refundAmount),
          },
        });
      }

      // Auto-sync parent transaction status
      await this.syncTransactionStatus(transactionId);
    }

    return updated;
  }

  async addPayment(id: number, dto: AddPaymentDto, performedBy?: string) {
    const txn = await this.findOne(id);

    const scaledAmount = toScaled(dto.amount);

    // Compute card fee server-side — never trust frontend for financial calculations
    const isCard = dto.method === 'card';
    const { fee, feePercent } = isCard
      ? computeCardFee(scaledAmount, dto.cardBank)
      : { fee: 0, feePercent: '0' };

    const [payment] = await this.drizzle.db
      .insert(claimPayments)
      .values({
        transactionId: id,
        method: dto.method,
        amount: scaledAmount,
        referenceNumber: dto.referenceNumber ?? null,
        cardBank: isCard ? (dto.cardBank ?? null) : null,
        fee,
        feePercent,
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
          ...(isCard && { cardBank: dto.cardBank ?? null, fee: fromScaled(fee), feePercent }),
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

  /**
   * Superadmin-only: correct the payment method (and optionally reference number) on
   * an existing claim_payment record. The amount is never changed here — only the method.
   *
   * Edge case — bank_deposit:
   *   The dashboard's bank_deposit collection total comes from the `deposits` table, NOT
   *   from claim_payments. Changing a payment's method to/from bank_deposit in claim_payments
   *   will NOT automatically update the deposits table, which could cause a mismatch in
   *   the collection report. The caller (controller) is responsible for surfacing this
   *   warning to the user; this method records it in the audit log.
   *
   * All other method changes (cash ↔ gcash ↔ card) are safe — collection totals update
   * automatically on the next dashboard load since all queries hit the DB live.
   */
  async updatePaymentMethod(
    txnId: number,
    paymentId: number,
    dto: { method: string; referenceNumber?: string; cardBank?: string },
    performedBy?: string,
  ) {
    const txn = await this.findOne(txnId);

    const [existing] = await this.drizzle.db
      .select()
      .from(claimPayments)
      .where(and(eq(claimPayments.id, paymentId), eq(claimPayments.transactionId, txnId)));

    if (!existing) {
      throw new NotFoundException(`Payment ${paymentId} not found on transaction ${txnId}`);
    }

    // Allow same-method edits when card bank is changing (fee recomputation needed)
    const cardBankChanged =
      existing.method === 'card' &&
      dto.method === 'card' &&
      (dto.cardBank ?? '') !== (existing.cardBank ?? '');
    if (existing.method === dto.method && !cardBankChanged) {
      // Only referenceNumber changed — update it without touching fee
      const [updated] = await this.drizzle.db
        .update(claimPayments)
        .set({ referenceNumber: dto.referenceNumber !== undefined ? dto.referenceNumber : existing.referenceNumber })
        .where(eq(claimPayments.id, paymentId))
        .returning();
      return { ...updated, amount: fromScaled(updated.amount) };
    }

    // Recompute fee when changing to/from card — clear fee for non-card methods
    const isNewCard = dto.method === 'card';
    const { fee: newFee, feePercent: newFeePercent } = isNewCard
      ? computeCardFee(existing.amount, dto.cardBank)
      : { fee: 0, feePercent: '0' };

    const [updated] = await this.drizzle.db
      .update(claimPayments)
      .set({
        method: dto.method,
        referenceNumber: dto.referenceNumber !== undefined ? dto.referenceNumber : existing.referenceNumber,
        cardBank: isNewCard ? (dto.cardBank ?? null) : null,
        fee: newFee,
        feePercent: newFeePercent,
      })
      .where(eq(claimPayments.id, paymentId))
      .returning();

    const branchId = performedBy ? await this.users.getBranchId(performedBy) : null;
    const bankDepositInvolved = existing.method === 'bank_deposit' || dto.method === 'bank_deposit';

    await this.audit.log({
      action: 'update',
      auditType: AUDIT_TYPE.PAYMENT_ADDED, // reuse closest audit type
      entityType: 'claim_payment',
      entityId: String(paymentId),
      source: 'admin',
      performedBy,
      branchId: branchId ?? undefined,
      details: {
        txnNumber: txn.number,
        paymentId,
        from: existing.method,
        to: dto.method,
        amount: fromScaled(existing.amount),
        ...(bankDepositInvolved && {
          warning: 'bank_deposit involved — deposits table may need manual reconciliation',
        }),
      },
    });

    return { ...updated, amount: fromScaled(updated.amount) };
  }

  async sendPickupReadySms(id: number, performedBy?: string): Promise<{ phone: string }> {
    const txn = await this.findOne(id);

    if (!txn.customerPhone) {
      throw new BadRequestException('Customer has no phone number on file.');
    }

    const lines = [
      `Good day. Your shoe(s) for Txn #${txn.number} are ready for pickup. Unclaimed after 5 days: Php100/week.`,
      '',
      'Assistance',
      'Mon-Fri: 0962 990 3989',
      'Sat-Sun: Facebook Chat',
    ];
    const message = lines.join('\n');

    await this.sms.send({ to: txn.customerPhone, message });

    const sentAt = new Date().toISOString();
    const sender = performedBy ? await this.users.findById(performedBy) : null;
    const branchId = performedBy ? await this.users.getBranchId(performedBy) : null;

    await this.audit.log({
      action: 'sms_sent',
      auditType: AUDIT_TYPE.SMS_SENT,
      entityType: 'transaction',
      entityId: txn.number,
      source: 'pos',
      performedBy,
      branchId: branchId ?? undefined,
      details: {
        sentAt,
        customerPhone: txn.customerPhone,
        txnNumber: txn.number,
        sentById: performedBy ?? null,
        sentByFullName: sender?.fullName ?? null,
        sentByEmail: sender?.email ?? null,
      },
    });

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

    const deletableStatuses = ['pending', 'cancelled'];
    if (!deletableStatuses.includes(txn.status)) {
      throw new BadRequestException(
        `Cannot delete — transaction status is "${txn.status}". Only Pending or Cancelled transactions can be deleted.`,
      );
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
      auditType: AUDIT_TYPE.TRANSACTION_DELETED,
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

  async restore(id: number, performedBy?: string, scopedBranch?: number) {
    const conditions: ReturnType<typeof eq>[] = [
      eq(transactions.id, id),
      isNotNull(transactions.deletedAt) as ReturnType<typeof eq>,
    ];
    if (scopedBranch !== undefined) {
      conditions.push(eq(transactions.branchId, scopedBranch));
    }
    const [txn] = await this.drizzle.db
      .select()
      .from(transactions)
      .where(and(...conditions));
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

  // ---------------------------------------------------------------------------
  // Purge: hard-delete soft-deleted transactions older than 30 days
  // Called by POST /transactions/purge-deleted (triggered by Cloud Scheduler)
  // Child rows (items, payments, photos) cascade-delete via FK constraints
  // ---------------------------------------------------------------------------
  private readonly logger = new Logger(TransactionsService.name);

  async purgeOldDeleted() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const deleted = await this.drizzle.db
      .delete(transactions)
      .where(
        and(
          isNotNull(transactions.deletedAt) as ReturnType<typeof eq>,
          lte(transactions.deletedAt, cutoff),
        ),
      )
      .returning({ id: transactions.id, number: transactions.number });

    if (deleted.length > 0) {
      this.logger.log(
        `Purged ${deleted.length} soft-deleted transaction(s) older than 30 days: ${deleted.map((t) => `#${t.number}`).join(', ')}`,
      );

      await this.audit.log({
        action: `Purged ${deleted.length} deleted transaction(s) older than 30 days`,
        auditType: AUDIT_TYPE.TRANSACTION_DELETED,
        entityType: 'transaction',
        entityId: deleted.map((t) => t.number).join(','),
        source: 'system-cron',
        performedBy: undefined,
      });
    }
  }
}
