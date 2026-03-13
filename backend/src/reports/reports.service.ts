import { Injectable } from '@nestjs/common';
import { and, desc, eq, gte, inArray, isNull, lte, ne, sql } from 'drizzle-orm';
import { DrizzleService } from '../db/drizzle.service';
import {
  transactions,
  transactionItems,
  claimPayments,
  expenses,
  services as servicesTable,
  users,
} from '../db/schema';
import { fromScaled } from '../utils/money';

function getDateRange(year: number, month: number) {
  const from =
    month === 0
      ? new Date(`${year}-01-01T00:00:00`)
      : new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00`);
  const to =
    month === 0
      ? new Date(`${year}-12-31T23:59:59`)
      : new Date(year, month, 0, 23, 59, 59);
  const fromDate =
    month === 0
      ? `${year}-01-01`
      : `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = month === 0 ? 31 : new Date(year, month, 0).getDate();
  const toDate =
    month === 0
      ? `${year}-12-31`
      : `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to, fromDate, toDate };
}

@Injectable()
export class ReportsService {
  constructor(private readonly drizzle: DrizzleService) {}

  async getSummary(year: number, month: number, branchId?: number) {
    const { from, to, fromDate, toDate } = getDateRange(year, month);

    const txnConditions = [
      gte(transactions.createdAt, from),
      lte(transactions.createdAt, to),
      isNull(transactions.deletedAt),
    ];
    if (branchId) txnConditions.push(eq(transactions.branchId, branchId));

    // Active-only conditions: excludes deleted + cancelled (for revenue-affecting queries)
    const activeTxnConditions = [...txnConditions, ne(transactions.status, 'cancelled')];

    const paymentConditions = [
      gte(claimPayments.paidAt, from),
      lte(claimPayments.paidAt, to),
      isNull(transactions.deletedAt),
      ne(transactions.status, 'cancelled'),
    ];
    if (branchId) paymentConditions.push(eq(transactions.branchId, branchId));

    const [
      collectionsRows,
      expenseRows,
      txnStatusRows,
      shoesCountRow,
      topServicesRows,
      txnListRows,
    ] = await Promise.all([
      // Collections by payment method
      this.drizzle.db
        .select({
          method: claimPayments.method,
          total: sql<number>`COALESCE(SUM(${claimPayments.amount}), 0)`,
        })
        .from(claimPayments)
        .innerJoin(transactions, eq(claimPayments.transactionId, transactions.id))
        .where(and(...paymentConditions))
        .groupBy(claimPayments.method),

      // Expenses for period (branch-scoped via staff membership)
      (async () => {
        const dateRange = and(gte(expenses.dateKey, fromDate), lte(expenses.dateKey, toDate));
        if (branchId) {
          const staffRows = await this.drizzle.db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.branchId, branchId));
          const staffIds = staffRows.map((u) => u.id);
          if (staffIds.length === 0) return [];
          return this.drizzle.db
            .select()
            .from(expenses)
            .where(and(dateRange, inArray(expenses.staffId, staffIds)))
            .orderBy(expenses.dateKey);
        }
        return this.drizzle.db
          .select()
          .from(expenses)
          .where(dateRange)
          .orderBy(expenses.dateKey);
      })(),

      // Transaction counts by status
      this.drizzle.db
        .select({
          status: transactions.status,
          count: sql<number>`COUNT(*)`,
        })
        .from(transactions)
        .where(and(...txnConditions))
        .groupBy(transactions.status),

      // Total non-cancelled shoes (excludes cancelled transactions + cancelled items)
      this.drizzle.db
        .select({ count: sql<number>`COUNT(${transactionItems.id})` })
        .from(transactionItems)
        .innerJoin(transactions, eq(transactionItems.transactionId, transactions.id))
        .where(and(...activeTxnConditions, ne(transactionItems.status, 'cancelled'))),

      // Top 5 services by booking count (excludes cancelled transactions)
      this.drizzle.db
        .select({
          name: servicesTable.name,
          count: sql<number>`COUNT(${transactionItems.id})`,
          revenue: sql<number>`COALESCE(SUM(${transactionItems.price}), 0)`,
        })
        .from(transactionItems)
        .innerJoin(transactions, eq(transactionItems.transactionId, transactions.id))
        .innerJoin(servicesTable, eq(transactionItems.serviceId, servicesTable.id))
        .where(and(...activeTxnConditions))
        .groupBy(servicesTable.id, servicesTable.name)
        .orderBy(desc(sql`COUNT(${transactionItems.id})`))
        .limit(5),

      // Transaction list with item count
      this.drizzle.db
        .select({
          id: transactions.id,
          number: transactions.number,
          customerName: transactions.customerName,
          createdAt: transactions.createdAt,
          status: transactions.status,
          total: transactions.total,
          paid: transactions.paid,
          itemCount: sql<number>`COUNT(${transactionItems.id})`,
        })
        .from(transactions)
        .leftJoin(transactionItems, eq(transactionItems.transactionId, transactions.id))
        .where(and(...txnConditions))
        .groupBy(transactions.id)
        .orderBy(desc(transactions.createdAt)),
    ]);

    const collections: Record<string, string> = {
      cash: '0.00',
      gcash: '0.00',
      card: '0.00',
      bank_deposit: '0.00',
    };
    collectionsRows.forEach((r) => {
      collections[r.method] = fromScaled(r.total);
    });
    const collectionsTotal = Object.values(collections).reduce(
      (s, v) => s + parseFloat(v),
      0,
    );

    const expensesScaledTotal = expenseRows.reduce((s, e) => s + e.amount, 0);
    const expensesTotal = fromScaled(expensesScaledTotal);
    const expensesMapped = expenseRows.map((e) => ({ ...e, amount: fromScaled(e.amount) }));

    const txnCounts = { total: 0, claimed: 0, cancelled: 0, pending: 0, in_progress: 0, done: 0 };
    txnStatusRows.forEach((r) => {
      const key = r.status as keyof typeof txnCounts;
      if (key in txnCounts) txnCounts[key] = Number(r.count);
      txnCounts.total += Number(r.count);
    });

    return {
      collections: { ...collections, total: collectionsTotal.toFixed(2) },
      expenses: { total: expensesTotal, items: expensesMapped },
      transactions: txnCounts,
      shoesCount: Number(shoesCountRow[0]?.count ?? 0),
      net: (collectionsTotal - parseFloat(expensesTotal)).toFixed(2),
      topServices: topServicesRows.map((r) => ({
        name: r.name,
        count: Number(r.count),
        revenue: fromScaled(r.revenue),
      })),
      txnList: txnListRows.map((r) => ({
        ...r,
        total: fromScaled(r.total),
        paid: fromScaled(r.paid),
        itemCount: Number(r.itemCount),
      })),
    };
  }
}
