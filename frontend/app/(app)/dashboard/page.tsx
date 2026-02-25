'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ReceiptIcon,
  WrenchIcon,
  CurrencyDollarIcon,
  TagIcon,
  CalendarIcon,
} from '@phosphor-icons/react';
import { formatPeso, formatDate, PAYMENT_METHOD_LABELS, STATUS_LABELS } from '@/lib/utils';
import {
  useTransactionReportQuery,
  useRecentTransactionsQuery,
  useUpcomingPickupsQuery,
  useDailyStatsQuery,
} from '@/hooks/useTransactionsQuery';
import { useMonthlyExpensesQuery } from '@/hooks/useExpensesQuery';
import { useCurrentUserQuery } from '@/hooks/useCurrentUserQuery';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { toTitleCase } from '@/utils/text';
import type { Transaction, ClaimPayment } from '@/lib/types';

const ALL_QUICK_ACTIONS = [
  { label: 'New Transaction', href: '/transactions/new', icon: ReceiptIcon, adminOnly: false },
  { label: 'New Service', href: '/services?new=1', icon: WrenchIcon, adminOnly: true },
  { label: 'New Expense', href: '/expenses?new=1', icon: CurrencyDollarIcon, adminOnly: true },
  { label: 'New Promo', href: '/promos?new=1', icon: TagIcon, adminOnly: true },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pickupDateClass(dateStr: string | null) {
  if (!dateStr) return 'text-zinc-400';
  const today = new Date().toISOString().split('T')[0];
  if (dateStr < today) return 'text-red-500 font-medium';
  if (dateStr === today) return 'text-amber-600 font-medium';
  return 'text-zinc-700';
}

export default function DashboardPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: currentUser } = useCurrentUserQuery();
  const isAdmin = currentUser?.userType === 'admin' || currentUser?.userType === 'superadmin';

  const { data: reportTxns = [] } = useTransactionReportQuery(year, month, { enabled: isAdmin });
  const { data: dailyTxns = [] } = useDailyStatsQuery();
  const { data: recentTxns = [] } = useRecentTransactionsQuery(20);
  const { data: upcomingPickups = [] } = useUpcomingPickupsQuery();
  const { data: expenses = [] } = useMonthlyExpensesQuery(year, month, { enabled: isAdmin });

  const quickActions = ALL_QUICK_ACTIONS.filter((a) => !a.adminOnly || isAdmin);

  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

  const filtered = useMemo(() => {
    return (reportTxns as Transaction[]).filter((t) => {
      const d = t.createdAt.split('T')[0];
      return d >= from && d <= to;
    });
  }, [reportTxns, from, to]);

  const monthlyStats = useMemo(() => {
    const totalRevenue = filtered.reduce((sum, t) => sum + parseFloat(t.total), 0);
    const totalPaid = filtered.reduce((sum, t) => sum + parseFloat(t.paid), 0);
    const byStatus = filtered.reduce(
      (acc, t) => { acc[t.status] = (acc[t.status] ?? 0) + 1; return acc; },
      {} as Record<string, number>,
    );
    const byPaymentMethod = filtered.reduce(
      (acc, t) => {
        (t.payments ?? []).forEach((p: ClaimPayment) => {
          acc[p.method] = (acc[p.method] ?? 0) + parseFloat(p.amount);
        });
        return acc;
      },
      {} as Record<string, number>,
    );
    return { totalRevenue, totalPaid, totalBalance: totalRevenue - totalPaid, byStatus, byPaymentMethod };
  }, [filtered]);

  const dailyStats = useMemo(() => {
    const txns = dailyTxns as Transaction[];
    const totalRevenue = txns.reduce((sum, t) => sum + parseFloat(t.total), 0);
    const totalPaid = txns.reduce((sum, t) => sum + parseFloat(t.paid), 0);
    return { count: txns.length, totalRevenue, totalPaid, totalBalance: totalRevenue - totalPaid };
  }, [dailyTxns]);

  const totalExpenses = (expenses ?? []).reduce((sum, e) => sum + parseFloat(e.amount), 0);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={isAdmin ? 'Monthly financial summary' : "Today's overview"}
        action={
          isAdmin ? (
            <div className="flex items-center gap-2">
              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                className="px-3 py-1.5 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none"
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10))}
                className="px-3 py-1.5 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none"
              >
                {[2024, 2025, 2026].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          ) : null
        }
      />

      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {quickActions.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2 bg-white border border-zinc-200 rounded-md px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 transition-colors duration-150"
          >
            <Icon size={13} className="text-zinc-400 shrink-0" />
            {label}
          </Link>
        ))}
      </div>

      {/* Admin: monthly stats */}
      {isAdmin && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
            {[
              { label: 'Transactions', value: filtered.length, mono: false },
              { label: 'Total Revenue', value: formatPeso(monthlyStats.totalRevenue), mono: true },
              { label: 'Total Collected', value: formatPeso(monthlyStats.totalPaid), mono: true },
              { label: 'Outstanding', value: formatPeso(monthlyStats.totalBalance), mono: true },
            ].map(({ label, value, mono }) => (
              <div key={label} className="bg-white border border-zinc-200 rounded-lg p-5">
                <p className="text-xs text-zinc-400 mb-1">{label}</p>
                <p className={`text-2xl font-semibold text-zinc-950 ${mono ? 'font-mono' : ''}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
            <div className="bg-white border border-zinc-200 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-zinc-950 mb-4">Transactions by Status</h2>
              <div className="space-y-2">
                {Object.entries(monthlyStats.byStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between py-1">
                    <span className="text-sm text-zinc-600">{STATUS_LABELS[status] ?? status.replace('_', ' ')}</span>
                    <span className="font-mono text-sm font-medium text-zinc-950">{count}</span>
                  </div>
                ))}
                {Object.keys(monthlyStats.byStatus).length === 0 && (
                  <p className="text-sm text-zinc-400">No data for this period.</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white border border-zinc-200 rounded-lg p-5">
                <h2 className="text-sm font-semibold text-zinc-950 mb-4">Collected by Payment Method</h2>
                <div className="space-y-2">
                  {Object.entries(monthlyStats.byPaymentMethod).map(([method, amount]) => (
                    <div key={method} className="flex items-center justify-between py-1">
                      <span className="text-sm text-zinc-600">{PAYMENT_METHOD_LABELS[method] ?? method}</span>
                      <span className="font-mono text-sm font-medium text-zinc-950">{formatPeso(amount)}</span>
                    </div>
                  ))}
                  {Object.keys(monthlyStats.byPaymentMethod).length === 0 && (
                    <p className="text-sm text-zinc-400">No payments recorded for this period.</p>
                  )}
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-lg p-5">
                <h2 className="text-sm font-semibold text-zinc-950 mb-1">Expenses</h2>
                <p className="text-xs text-zinc-400 mb-2">Month total</p>
                <p className="text-2xl font-mono font-semibold text-zinc-950">{formatPeso(totalExpenses)}</p>
                {expenses.length > 0 && (
                  <p className="text-xs text-zinc-400 mt-1">{expenses.length} entries</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Staff: daily stats */}
      {!isAdmin && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
          {[
            { label: 'Transactions Today', value: dailyStats.count, mono: false },
            { label: "Today's Revenue", value: formatPeso(dailyStats.totalRevenue), mono: true },
            { label: 'Collected Today', value: formatPeso(dailyStats.totalPaid), mono: true },
            { label: 'Outstanding', value: formatPeso(dailyStats.totalBalance), mono: true },
          ].map(({ label, value, mono }) => (
            <div key={label} className="bg-white border border-zinc-200 rounded-lg p-5">
              <p className="text-xs text-zinc-400 mb-1">{label}</p>
              <p className={`text-2xl font-semibold text-zinc-950 ${mono ? 'font-mono' : ''}`}>
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming pickups + Recent transactions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white border border-zinc-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-zinc-950 mb-4 flex items-center gap-1.5">
            <CalendarIcon size={14} className="text-amber-500" />
            Upcoming Pickups
            {upcomingPickups.length > 0 && (
              <span className="ml-auto text-xs font-normal text-zinc-400">{upcomingPickups.length} within 3 days</span>
            )}
          </h2>
          {upcomingPickups.length === 0 ? (
            <p className="text-sm text-zinc-400">No pickups in the next 3 days.</p>
          ) : (
            <div className="divide-y divide-zinc-100">
              {(upcomingPickups as Transaction[]).map((t) => (
                <Link
                  key={t.id}
                  href={`/transactions/${t.id}`}
                  className="flex items-center justify-between py-2.5 hover:bg-zinc-50 -mx-1 px-1 rounded transition-colors duration-150"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-medium text-zinc-950">#{t.number}</p>
                    <p className="text-xs text-zinc-500 truncate">{toTitleCase(t.customerName) || '—'}</p>
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <p className={`text-xs ${pickupDateClass(t.pickupDate)}`}>{formatDate(t.pickupDate)}</p>
                    <div className="mt-0.5"><StatusBadge status={t.status} /></div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-zinc-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-zinc-950 mb-4">Recent Transactions</h2>
          {recentTxns.length === 0 ? (
            <p className="text-sm text-zinc-400">No transactions yet.</p>
          ) : (
            <div className="divide-y divide-zinc-100">
              {(recentTxns as Transaction[]).map((t) => (
                <Link
                  key={t.id}
                  href={`/transactions/${t.id}`}
                  className="flex items-center justify-between py-2.5 hover:bg-zinc-50 -mx-1 px-1 rounded transition-colors duration-150"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-medium text-zinc-950">#{t.number}</p>
                    <p className="text-xs text-zinc-500 truncate">{toTitleCase(t.customerName) || '—'}</p>
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <p className="font-mono text-xs text-zinc-950">{formatPeso(t.total)}</p>
                    <div className="mt-0.5"><StatusBadge status={t.status} /></div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
