'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ReceiptIcon,
  WrenchIcon,
  CurrencyDollarIcon,
  TagIcon,
  CalendarIcon,
  CoinIcon,
  TrendUpIcon,
  WalletIcon,
  DeviceMobileIcon,
  MoneyIcon,
  CreditCardIcon,
  BankIcon,
  QrCodeIcon,
} from '@phosphor-icons/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { DepositHistoryDialog } from '@/components/deposits/DepositHistoryDialog';
import { QrScanDialog } from '@/components/ui/qr-scan-dialog';
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
import { useUpsertDepositMutation } from '@/hooks/useDepositsQuery';
import { useCurrentUserQuery } from '@/hooks/useCurrentUserQuery';
import { useBranchesQuery } from '@/hooks/useBranchesQuery';
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
        <div className="h-7 w-24 bg-zinc-200 rounded animate-pulse" />
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
  const [month, setMonth] = useState(now.getMonth() + 1); // 0 = overall year
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [historyDialog, setHistoryDialog] = useState<{ open: boolean; method?: string }>({ open: false });
  const [depositDialog, setDepositDialog] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositError, setDepositError] = useState('');

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
  const { data: collectionsData, isLoading: collectionsLoading } = useCollectionsSummaryQuery(year, month, {
    branchId,
    enabled: isAdmin,
  });
  const upsertDepositMut = useUpsertDepositMutation(year, month, branchId);
  const { data: todayCollections = [] } = useTodayCollectionsQuery();

  const quickActions = ALL_QUICK_ACTIONS.filter((a) => !a.adminOnly || isAdmin);

  const from = month === 0 ? `${year}-01-01` : `${year}-${String(month).padStart(2, '0')}-01`;
  const to = month === 0 ? `${year}-12-31` : `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

  const filtered = useMemo(() => {
    return (reportTxns as Transaction[]).filter((t) => {
      const d = t.createdAt.split('T')[0];
      return d >= from && d <= to;
    });
  }, [reportTxns, from, to]);

  const monthlyStats = useMemo(() => {
    const active = filtered.filter((t) => t.status !== 'cancelled');
    const totalRevenue = active.reduce((sum, t) => sum + parseFloat(t.total), 0);
    const totalPaid = active.reduce((sum, t) => sum + parseFloat(t.paid), 0);
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
    const txns = (dailyTxns as Transaction[]).filter((t) => t.status !== 'cancelled');
    const totalRevenue = txns.reduce((sum, t) => sum + parseFloat(t.total), 0);
    const totalPaid = txns.reduce((sum, t) => sum + parseFloat(t.paid), 0);
    return { count: txns.length, totalRevenue, totalPaid, totalBalance: totalRevenue - totalPaid };
  }, [dailyTxns]);

  const todayCollectionTotal = todayCollections.reduce((sum, c) => sum + parseFloat(c.amount), 0);
  const totalExpenses = (expenses ?? []).reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const monthlyNet = monthlyStats.totalRevenue - totalExpenses;

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
                  <SelectItem value="0">Overall</SelectItem>
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
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex flex-wrap items-center gap-2">
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
        <button
          onClick={() => setShowQrScanner(true)}
          className="flex items-center gap-2 bg-zinc-950 text-white rounded-md px-3.5 py-1.5 text-xs font-semibold hover:bg-zinc-800 transition-colors duration-150 shrink-0"
        >
          <QrCodeIcon size={14} weight="bold" />
          Scan QR
        </button>
      </div>

      {/* Admin: monthly stats */}
      {isAdmin && (
        <>
          {/* Layer 1: 3 metric cards — 1fr 1.6fr 1fr */}
          <div
            className="grid grid-cols-1 sm:grid-cols-[1fr_1.6fr_1fr] gap-3 mb-4"
          >
            {/* Transactions */}
            <Link
              href="/transactions"
              className="bg-white border border-zinc-200 rounded-xl p-5 hover:border-zinc-300 transition-colors duration-150"
            >
              <div className="flex items-center gap-1.5 mb-3">
                <ReceiptIcon size={13} className="text-zinc-400" />
                <span className="text-xs font-medium text-zinc-400">Transactions</span>
              </div>
              {reportLoading ? (
                <div className="h-9 w-12 bg-zinc-200 rounded animate-pulse" />
              ) : (
                <p className="text-3xl font-semibold text-zinc-950">{filtered.length}</p>
              )}
            </Link>

            {/* Total Revenue — wider middle */}
            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <div className="flex items-center gap-1.5 mb-3">
                <TrendUpIcon size={13} className="text-zinc-400" />
                <span className="text-xs font-medium text-zinc-400">Total Revenue</span>
              </div>
              {reportLoading ? (
                <div className="h-9 w-36 bg-zinc-200 rounded animate-pulse mb-3" />
              ) : (
                <>
                  <p className="text-3xl font-mono font-semibold text-zinc-950 mb-3">
                    {formatPeso(monthlyStats.totalRevenue)}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                    <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="font-mono">{formatPeso(monthlyStats.totalPaid)}</span>
                      {' '}collected
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span className="font-mono">{formatPeso(monthlyStats.totalBalance)}</span>
                      {' '}outstanding
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Net Income */}
            <Link
              href="/expenses"
              className="bg-white border border-zinc-200 rounded-xl p-5 hover:border-zinc-300 transition-colors duration-150"
            >
              <div className="flex items-center gap-1.5 mb-3">
                <CoinIcon size={13} className="text-zinc-400" />
                <span className="text-xs font-medium text-zinc-400">Net Income</span>
                {!reportLoading && !expensesLoading && monthlyStats.totalRevenue > 0 && (
                  <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    monthlyNet >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {monthlyNet >= 0 ? '+' : ''}{((monthlyNet / monthlyStats.totalRevenue) * 100).toFixed(1)}%
                  </span>
                )}
              </div>
              {reportLoading || expensesLoading ? (
                <div className="h-9 w-28 bg-zinc-200 rounded animate-pulse" />
              ) : (
                <>
                  <p className={`text-3xl font-mono font-semibold mb-3 ${monthlyNet >= 0 ? 'text-zinc-950' : 'text-red-500'}`}>
                    {formatPeso(monthlyNet)}
                  </p>
                  <span className="text-xs font-medium text-red-500">
                    {formatPeso(totalExpenses)} expenses
                  </span>
                </>
              )}
            </Link>
          </div>

          {/* Section divider */}
          <p className="text-xs font-medium text-zinc-400 mb-2 mt-2">Collection Channels</p>

          {/* Layer 2: single strip with 1px vertical dividers */}
          <div className="bg-white border border-zinc-200 rounded-xl mb-6 overflow-hidden">
            <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-zinc-100">
              {METHOD_ORDER.map((key) => {
                const config = PAYMENT_METHOD_CONFIG[key];
                // Backend returns pre-computed net GCash and bank_deposit total in collectionsData
                const amount = parseFloat(collectionsData?.[key] ?? '0');
                const isBankDeposit = key === 'bank_deposit';
                return (
                  <button
                    key={key}
                    onClick={() => isBankDeposit ? setHistoryDialog({ open: true, method: key }) : undefined}
                    className={`group flex-1 px-5 py-4 text-left transition-colors duration-150 ${isBankDeposit ? 'hover:bg-zinc-50/60 cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <config.icon size={13} className={config.iconClass} />
                        <span className="text-xs font-medium text-zinc-500">{config.label}</span>
                      </div>
                      {key === 'bank_deposit' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDepositDialog(key);
                            setDepositAmount('');
                            setDepositError('');
                          }}
                          disabled={!collectionsData || parseFloat(collectionsData['gcash'] ?? '0') <= 0}
                          className="flex items-center px-2.5 py-1.5 -mr-2 text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors duration-150 disabled:text-zinc-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                    {collectionsLoading ? (
                      <div className="h-5 w-16 bg-zinc-200 rounded animate-pulse" />
                    ) : (
                      <p className={`font-mono text-lg font-semibold ${amount > 0 ? 'text-zinc-950' : 'text-zinc-300'}`}>
                        {formatPeso(amount)}
                      </p>
                    )}
                  </button>
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

      <QrScanDialog open={showQrScanner} onClose={() => setShowQrScanner(false)} />

      {/* Deposit history dialog */}
      <DepositHistoryDialog
        open={historyDialog.open}
        onClose={() => setHistoryDialog({ open: false })}
        year={year}
        month={month}
        monthLabel={month === 0 ? `${year} Overall` : `${MONTHS[(month || 1) - 1]} ${year}`}
        branchId={branchId}
      />

      {/* Add deposit dialog */}
      <Dialog
        open={depositDialog !== null}
        onOpenChange={(open) => { if (!open && !upsertDepositMut.isPending) setDepositDialog(null); }}
      >
        <DialogContent className="bg-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Record Bank Deposit</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              {month === 0 ? `${year} Overall` : `${MONTHS[(month || 1) - 1]} ${year}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="rounded-md bg-amber-50 border border-amber-100 px-3 py-2">
              <p className="text-xs text-amber-700">
                Recording a bank deposit will subtract the same amount from the GCash balance — this reflects a GCash → bank transfer.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-700">Amount (₱)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                autoFocus
                value={depositAmount}
                onChange={(e) => { setDepositAmount(e.target.value); setDepositError(''); }}
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-zinc-200 rounded-md text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="0.00"
              />
              {depositError && <p className="text-xs text-red-500">{depositError}</p>}
            </div>
            {collectionsData && parseFloat(collectionsData['gcash'] ?? '0') > 0 && (
              <p className="text-xs text-zinc-400">
                GCash balance: <span className="font-mono">{formatPeso(collectionsData['gcash'])}</span>
                {' '}— will be reduced by this amount.
              </p>
            )}
            {collectionsData && parseFloat(collectionsData['bank_deposit'] ?? '0') > 0 && (
              <p className="text-xs text-zinc-400">
                Current bank deposit total: <span className="font-mono">{formatPeso(collectionsData['bank_deposit'])}</span>
                {' '}— this amount will be added to it.
              </p>
            )}
            <Button
              variant="dark"
              size="sm"
              className="w-full"
              disabled={upsertDepositMut.isPending || !depositAmount}
              onClick={() => {
                const amt = parseFloat(depositAmount);
                if (isNaN(amt) || amt <= 0) { setDepositError('Enter a valid amount'); return; }
                upsertDepositMut.mutate(
                  { method: depositDialog!, amount: depositAmount },
                  { onSuccess: () => { setDepositDialog(null); toast.success('Deposit recorded'); } },
                );
              }}
            >
              {upsertDepositMut.isPending ? <Spinner /> : 'Add Deposit'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
