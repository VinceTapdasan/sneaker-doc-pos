'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ReceiptIcon,
  WrenchIcon,
  CurrencyDollarIcon,
  TagIcon,
  CalendarIcon,
  CoinIcon,
  TrendUpIcon,
  HourglassIcon,
  WalletIcon,
  DeviceMobileIcon,
  MoneyIcon,
  CreditCardIcon,
  BankIcon,
} from '@phosphor-icons/react';
import { formatPeso, formatDate, PAYMENT_METHOD_LABELS } from '@/lib/utils';
import {
  useTransactionReportQuery,
  useRecentTransactionsQuery,
  useUpcomingPickupsQuery,
  useDailyStatsQuery,
  useTodayCollectionsQuery,
  useCollectionsSummaryQuery,
} from '@/hooks/useTransactionsQuery';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMonthlyExpensesQuery } from '@/hooks/useExpensesQuery';
import { useCurrentUserQuery } from '@/hooks/useCurrentUserQuery';
import { useBranchesQuery } from '@/hooks/useBranchesQuery';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { toTitleCase } from '@/utils/text';
import type { Transaction, ClaimPayment, TodayCollection } from '@/lib/types';

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

const PAYMENT_METHOD_CONFIG: Record<string, {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconClass: string;
  iconBg: string;
}> = {
  gcash: { label: 'GCash', icon: DeviceMobileIcon, iconClass: 'text-blue-600', iconBg: 'bg-blue-50' },
  bank_deposit: { label: 'Bank Deposit', icon: BankIcon, iconClass: 'text-amber-600', iconBg: 'bg-amber-50' },
  cash: { label: 'Cash', icon: MoneyIcon, iconClass: 'text-emerald-600', iconBg: 'bg-emerald-50' },
  card: { label: 'Card', icon: CreditCardIcon, iconClass: 'text-violet-600', iconBg: 'bg-violet-50' },
};

const METHOD_ORDER = ['gcash', 'bank_deposit', 'cash', 'card'] as const;

function pickupDateClass(dateStr: string | null) {
  if (!dateStr) return 'text-zinc-400';
  const today = new Date().toISOString().split('T')[0];
  if (dateStr < today) return 'text-red-500 font-medium';
  if (dateStr === today) return 'text-amber-600 font-medium';
  return 'text-zinc-700';
}

interface StatCardProps {
  label: string;
  href: string;
  value: string;
  mono?: boolean;
  loading?: boolean;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconClass: string;
  iconBg: string;
}

function StatCard({ label, href, value, mono, loading, icon: Icon, iconClass, iconBg }: StatCardProps) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <Link href={href} className="text-xs font-medium text-zinc-400 hover:text-blue-600 transition-colors duration-150">
          {label}
        </Link>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${iconBg}`}>
          <Icon size={13} className={iconClass} />
        </div>
      </div>
      {loading ? (
        <div className="h-7 w-24 bg-zinc-100 rounded animate-pulse" />
      ) : (
        <p className={`text-lg md:text-2xl font-semibold text-zinc-950 truncate ${mono ? 'font-mono' : ''}`}>
          {value}
        </p>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [branchFilter, setBranchFilter] = useState<string>('all');

  const { data: currentUser } = useCurrentUserQuery();
  const isAdmin = currentUser?.userType === 'admin' || currentUser?.userType === 'superadmin';
  const isSuperadmin = currentUser?.userType === 'superadmin';

  const { data: branches = [] } = useBranchesQuery(false);

  const branchId = branchFilter !== 'all' ? parseInt(branchFilter, 10) : undefined;

  const { data: reportTxns = [], isLoading: reportLoading } = useTransactionReportQuery(year, month, {
    enabled: isAdmin,
    branchId,
  });
  const { data: dailyTxns = [], isLoading: dailyLoading } = useDailyStatsQuery();
  const { data: recentTxns = [] } = useRecentTransactionsQuery(20);
  const { data: upcomingPickups = [] } = useUpcomingPickupsQuery();
  const { data: expenses = [], isLoading: expensesLoading } = useMonthlyExpensesQuery(year, month, { enabled: isAdmin });
  const { data: collectionsSummary, isLoading: collectionsLoading } = useCollectionsSummaryQuery(year, month, {
    branchId,
    enabled: isAdmin,
  });
  const { data: todayCollections = [] } = useTodayCollectionsQuery();

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

  const todayCollectionTotal = todayCollections.reduce((sum, c) => sum + parseFloat(c.amount), 0);
  const totalExpenses = (expenses ?? []).reduce((sum, e) => sum + parseFloat(e.amount), 0);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={isAdmin ? 'Monthly financial summary' : "Today's overview"}
        action={
          isAdmin ? (
            <div className={`grid gap-2 ${isSuperadmin && branches.length > 0 ? 'grid-cols-3' : 'grid-cols-2'} sm:flex sm:items-center sm:flex-wrap sm:justify-end`}>
              {isSuperadmin && branches.length > 0 && (
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger className="h-9 text-sm w-full sm:w-36 border-zinc-200">
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>{toTitleCase(b.name)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v, 10))}>
                <SelectTrigger className="h-9 text-sm w-full sm:w-32 border-zinc-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v, 10))}>
                <SelectTrigger className="h-9 text-sm w-full sm:w-24 border-zinc-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <StatCard
              label="Transactions"
              href="/transactions"
              value={String(filtered.length)}
              loading={reportLoading}
              icon={ReceiptIcon}
              iconClass="text-zinc-500"
              iconBg="bg-zinc-100"
            />
            <StatCard
              label="Total Revenue"
              href="/transactions"
              value={formatPeso(monthlyStats.totalRevenue)}
              mono
              loading={reportLoading}
              icon={TrendUpIcon}
              iconClass="text-emerald-600"
              iconBg="bg-emerald-50"
            />
            <StatCard
              label="Total Collected"
              href="/transactions"
              value={formatPeso(monthlyStats.totalPaid)}
              mono
              loading={reportLoading}
              icon={WalletIcon}
              iconClass="text-blue-600"
              iconBg="bg-blue-50"
            />
            <StatCard
              label="Outstanding"
              href="/transactions"
              value={formatPeso(monthlyStats.totalBalance)}
              mono
              loading={reportLoading}
              icon={HourglassIcon}
              iconClass="text-amber-600"
              iconBg="bg-amber-50"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
            {/* Expenses card */}
            <div className="bg-white border border-zinc-200 rounded-lg p-5">
              <div className="flex items-center justify-between mb-1">
                <Link href="/expenses" className="text-sm font-semibold text-zinc-950 hover:text-blue-600 transition-colors duration-150">
                  Expenses
                </Link>
                <div className="w-7 h-7 rounded-full flex items-center justify-center bg-red-50">
                  <CurrencyDollarIcon size={13} className="text-red-500" />
                </div>
              </div>
              <p className="text-xs text-zinc-400 mb-2">Month total</p>
              {expensesLoading ? (
                <div className="h-8 w-24 bg-zinc-100 rounded animate-pulse" />
              ) : (
                <>
                  <p className="text-lg md:text-2xl font-mono font-semibold text-zinc-950 truncate">{formatPeso(totalExpenses)}</p>
                  {expenses.length > 0 && (
                    <p className="text-xs text-zinc-400 mt-1">{expenses.length} entries</p>
                  )}
                </>
              )}
            </div>

            {/* Payment method breakdown — 2x2 grid */}
            <div className="grid grid-cols-2 gap-3">
              {METHOD_ORDER.map((key) => {
                const config = PAYMENT_METHOD_CONFIG[key];
                const amount = parseFloat(collectionsSummary?.[key] ?? '0');
                return (
                  <div key={key} className="bg-white border border-zinc-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${config.iconBg}`}>
                        <config.icon size={12} className={config.iconClass} />
                      </div>
                      <span className="text-xs text-zinc-400">{config.label}</span>
                    </div>
                    {collectionsLoading ? (
                      <div className="h-5 w-16 bg-zinc-100 rounded animate-pulse" />
                    ) : (
                      <p className="font-mono text-base font-semibold text-zinc-950">{formatPeso(amount)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Staff: daily stat cards */}
      {!isAdmin && (
        <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8">
          <StatCard
            label="Transactions Today"
            href="/transactions"
            value={String(dailyStats.count)}
            loading={dailyLoading}
            icon={ReceiptIcon}
            iconClass="text-zinc-500"
            iconBg="bg-zinc-100"
          />
          <StatCard
            label="Collected Today"
            href="/transactions"
            value={formatPeso(todayCollectionTotal)}
            mono
            loading={dailyLoading}
            icon={WalletIcon}
            iconClass="text-blue-600"
            iconBg="bg-blue-50"
          />
        </div>
      )}

      {/* Today's collections list — admin only */}
      {isAdmin && (
        <div className="bg-white border border-zinc-200 rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-zinc-950 mb-1 flex items-center gap-1.5">
            <CoinIcon size={14} className="text-emerald-500" />
            Today&apos;s Collections
            {todayCollections.length > 0 && (
              <span className="ml-auto text-xs font-mono font-medium text-emerald-600">
                {formatPeso(todayCollectionTotal)}
              </span>
            )}
          </h2>
          <p className="text-xs text-zinc-400 mb-3">Payments recorded today</p>
          {todayCollections.length === 0 ? (
            <p className="text-sm text-zinc-400">No collections recorded today.</p>
          ) : (
            <div className="divide-y divide-zinc-100">
              {todayCollections.map((c) => (
                <Link
                  key={c.id}
                  href={`/transactions/${c.transactionId}`}
                  className="flex items-center justify-between py-2.5 hover:bg-zinc-50 -mx-1 px-1 rounded transition-colors duration-150"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-medium text-zinc-950">#{c.txnNumber}</p>
                    <p className="text-xs text-zinc-500 truncate">{toTitleCase(c.customerName) || '—'}</p>
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <p className="font-mono text-xs font-medium text-emerald-600">{formatPeso(c.amount)}</p>
                    <p className="text-xs text-zinc-400">{PAYMENT_METHOD_LABELS[c.method] ?? c.method}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
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
                    <p className="text-xs text-zinc-400">{formatDate(t.createdAt)}</p>
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
