'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RequireAdmin } from '@/components/auth/RequireAdmin';
import { api } from '@/lib/api';
import { useBranchesQuery } from '@/hooks/useBranchesQuery';
import { useCurrentUserQuery } from '@/hooks/useCurrentUserQuery';
import { cn } from '@/lib/utils';
import { PdfDownloadButton } from '@/components/reports/PdfDownloadButton';
import { Spinner } from '@/components/ui/spinner';

const MONTHS = [
  { value: 0, label: 'Full Year' },
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth() + 1;
const YEARS = Array.from({ length: 3 }, (_, i) => CURRENT_YEAR - i);

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Done',
  claimed: 'Claimed',
  cancelled: 'Cancelled',
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-zinc-200 rounded-lg p-4 bg-white">
      <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-semibold text-zinc-950 font-mono">{value}</p>
      {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function ReportsPage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [branchId, setBranchId] = useState<number | undefined>();

  const { data: currentUser } = useCurrentUserQuery();
  const isSuperadmin = currentUser?.userType === 'superadmin';
  const { data: branches = [] } = useBranchesQuery();

  const { data, isLoading, error } = useQuery({
    queryKey: ['reports-summary', year, month, branchId],
    queryFn: () => api.reports.summary(year, month, branchId),
    enabled: !!currentUser,
  });

  const selectedBranch = branches.find((b) => b.id === branchId);
  const periodLabel = month === 0 ? `Year ${year}` : `${MONTHS[month].label} ${year}`;

  return (
    <RequireAdmin>
      <div>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <PageHeader
            title="Reports"
            subtitle={`Summary for ${periodLabel}`}
          />
          {data && (
            <PdfDownloadButton
              data={data}
              year={year}
              month={month}
              branchName={selectedBranch?.name}
              label="Download PDF"
            />
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v, 10))}>
            <SelectTrigger className="h-9 text-sm w-36 border-zinc-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map(({ value, label }) => (
                <SelectItem key={value} value={String(value)}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v, 10))}>
            <SelectTrigger className="h-9 text-sm w-24 border-zinc-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isSuperadmin && branches.length > 0 && (
            <Select
              value={branchId ? String(branchId) : 'all'}
              onValueChange={(v) => setBranchId(v === 'all' ? undefined : parseInt(v, 10))}
            >
              <SelectTrigger className="h-9 text-sm w-44 border-zinc-200">
                <SelectValue placeholder="All branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Spinner size={24} className="text-zinc-400" />
          </div>
        )}

        {error && (
          <div className="text-sm text-red-500 py-8 text-center">
            Failed to load report. Please try again.
          </div>
        )}

        {data && (
          <div className="space-y-8">
            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Collections" value={`₱${data.collections.total}`} />
              <StatCard label="Total Expenses" value={`₱${data.expenses.total}`} />
              <StatCard label="Net Income" value={`₱${data.net}`} />
              <StatCard label="Transactions" value={String(data.transactions.total)} sub={`${data.shoesCount} pairs`} />
            </div>

            {/* Collections + Txn Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Collections breakdown */}
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">
                  Collections by Method
                </h2>
                <div className="border border-zinc-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Method</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {[
                        { key: 'cash', label: 'Cash' },
                        { key: 'gcash', label: 'GCash' },
                        { key: 'card', label: 'Card' },
                        { key: 'bank_deposit', label: 'Bank Deposit' },
                      ].map(({ key, label }) => (
                        <tr key={key}>
                          <td className="px-4 py-2.5 text-zinc-700">{label}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-zinc-900">
                            ₱{data.collections[key as keyof typeof data.collections]}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-zinc-50 border-t border-zinc-200">
                        <td className="px-4 py-2.5 font-semibold text-zinc-900">Total</td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-zinc-950">
                          ₱{data.collections.total}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Transaction status breakdown */}
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">
                  Transaction Status
                </h2>
                <div className="border border-zinc-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Status</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {Object.entries(data.transactions)
                        .filter(([k]) => k !== 'total')
                        .map(([key, count]) => (
                          <tr key={key}>
                            <td className="px-4 py-2.5 text-zinc-700">{STATUS_LABELS[key] ?? key}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-zinc-900">{count}</td>
                          </tr>
                        ))}
                      <tr className="bg-zinc-50 border-t border-zinc-200">
                        <td className="px-4 py-2.5 font-semibold text-zinc-900">Total</td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-zinc-950">
                          {data.transactions.total}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Top Services */}
            {data.topServices.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">
                  Top Services
                </h2>
                <div className="border border-zinc-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Service</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Bookings</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {data.topServices.map((s, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2.5 text-zinc-700">{s.name}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-zinc-900">{s.count}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-zinc-900">₱{s.revenue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Expenses */}
            {data.expenses.items.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">
                  Expenses — Total: ₱{data.expenses.total}
                </h2>
                <div className="border border-zinc-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Date</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Category</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Note</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {data.expenses.items.map((e) => (
                        <tr key={e.id}>
                          <td className="px-4 py-2.5 font-mono text-zinc-600 text-xs">{e.dateKey}</td>
                          <td className="px-4 py-2.5 text-zinc-700">{e.category ?? '—'}</td>
                          <td className="px-4 py-2.5 text-zinc-500 max-w-xs truncate">{e.note ?? '—'}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-zinc-900">₱{e.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Transactions table */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3">
                Transactions ({data.txnList.length})
              </h2>
              <div className="border border-zinc-200 rounded-lg overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">#</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Customer</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Date</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Status</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Pairs</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Total</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {data.txnList.map((t) => (
                      <tr key={t.id} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-xs text-zinc-600">{t.number}</td>
                        <td className="px-4 py-2.5 text-zinc-700 max-w-[160px] truncate">
                          {t.customerName ?? <span className="text-zinc-400">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-zinc-500 text-xs">
                          {new Date(t.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={cn(
                            'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide',
                            t.status === 'claimed' ? 'bg-green-50 text-green-700' :
                            t.status === 'cancelled' ? 'bg-red-50 text-red-600' :
                            t.status === 'done' ? 'bg-blue-50 text-blue-600' :
                            t.status === 'in_progress' ? 'bg-yellow-50 text-yellow-700' :
                            'bg-zinc-100 text-zinc-600',
                          )}>
                            {STATUS_LABELS[t.status] ?? t.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-zinc-700">{t.itemCount}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-zinc-900">₱{t.total}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-zinc-900">₱{t.paid}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </RequireAdmin>
  );
}
