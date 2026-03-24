'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import {
  DiamondIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CalendarBlankIcon,
  ListIcon,
} from '@phosphor-icons/react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatPeso, formatDate, cn } from '@/lib/utils';
import { toTitleCase } from '@/utils/text';
import { useUpcomingPickupsQuery, useUpcomingByMonthQuery } from '@/hooks/useTransactionsQuery';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Transaction } from '@/lib/types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type ViewMode = 'calendar' | 'table';

const upcomingColumns: ColumnDef<Transaction>[] = [
  {
    accessorKey: 'pickupDate',
    header: 'Pickup',
    cell: ({ row }) => {
      const { pickupDate, newPickupDate } = row.original;
      if (newPickupDate) {
        return (
          <div>
            <span className="text-sm font-medium text-amber-600">{formatDate(newPickupDate)}</span>
            {pickupDate && (
              <span className="block text-xs text-zinc-400 line-through">{formatDate(pickupDate)}</span>
            )}
          </div>
        );
      }
      return <span className="text-sm font-medium text-zinc-950">{formatDate(pickupDate)}</span>;
    },
  },
  {
    accessorKey: 'number',
    header: '#',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-zinc-500">#{row.original.number}</span>
    ),
  },
  {
    accessorKey: 'customerName',
    header: 'Customer',
    cell: ({ row }) => (
      <div>
        <span className="font-medium text-zinc-950">
          {toTitleCase(row.original.customerName) || '—'}
        </span>
        {row.original.customerPhone && (
          <span className="block text-xs text-zinc-400">{row.original.customerPhone}</span>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: 'itemCount',
    header: 'Items',
    cell: ({ row }) => {
      const count = row.original.itemCount ?? 0;
      return (
        <span className="text-sm text-zinc-600">{count} {count === 1 ? 'item' : 'items'}</span>
      );
    },
  },
  {
    accessorKey: 'total',
    header: () => <span className="block text-right">Balance</span>,
    cell: ({ row }) => {
      const balance = parseFloat(row.original.total) - parseFloat(row.original.paid);
      const paid = parseFloat(row.original.paid);
      const isPartial = balance > 0 && paid > 0;
      const isUnpaid = balance > 0 && paid === 0;
      const pillClass = isUnpaid
        ? 'bg-red-100 text-red-600'
        : isPartial
          ? 'bg-amber-100 text-amber-700'
          : 'bg-emerald-100 text-emerald-700';
      return (
        <div className="flex justify-end items-center gap-1">
          {row.original.promoId && (
            <DiamondIcon size={11} weight="fill" className="text-emerald-500 shrink-0" />
          )}
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-mono ${pillClass}`}>
            {isUnpaid ? formatPeso(balance) : isPartial ? 'Partial' : 'Paid'}
          </span>
        </div>
      );
    },
  },
];

function BalancePill({ txn }: { txn: Transaction }) {
  const balance = parseFloat(txn.total) - parseFloat(txn.paid);
  const paid = parseFloat(txn.paid);
  const isPartial = balance > 0 && paid > 0;
  const isUnpaid = balance > 0 && paid === 0;
  const pillClass = isUnpaid
    ? 'bg-red-100 text-red-600'
    : isPartial
      ? 'bg-amber-100 text-amber-700'
      : 'bg-emerald-100 text-emerald-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-mono shrink-0 ${pillClass}`}>
      {isUnpaid ? formatPeso(balance) : isPartial ? 'Partial' : 'Paid'}
    </span>
  );
}

export default function UpcomingPickupsPage() {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>('calendar');
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: tableData = [], isLoading: tableLoading } = useUpcomingPickupsQuery();
  const { data: monthData = [], isLoading: calLoading } = useUpcomingByMonthQuery(viewYear, viewMonth);

  const transactions = tableData as Transaction[];

  const byDate = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const txn of monthData as Transaction[]) {
      const key = txn.newPickupDate ?? txn.pickupDate;
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(txn);
    }
    return map;
  }, [monthData]);

  const firstDay = new Date(viewYear, viewMonth - 1, 1).getDay();
  const totalDays = new Date(viewYear, viewMonth, 0).getDate();
  const todayStr = new Date().toISOString().split('T')[0];
  const trailingCount = (firstDay + totalDays) % 7 === 0 ? 0 : 7 - ((firstDay + totalDays) % 7);

  function prevMonth() {
    if (viewMonth === 1) { setViewYear((y) => y - 1); setViewMonth(12); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewYear((y) => y + 1); setViewMonth(1); }
    else setViewMonth((m) => m + 1);
  }

  const dialogTxns = selectedDate ? (byDate.get(selectedDate) ?? []) : [];

  const toggleBtn = (mode: ViewMode, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setView(mode)}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150',
        view === mode ? 'bg-zinc-950 text-white' : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100',
      )}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div>
      <PageHeader
        title="Upcoming Pickups"
        subtitle="Transactions with upcoming pickup dates"
        action={(
          <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg">
            {toggleBtn('calendar', <CalendarBlankIcon size={14} weight={view === 'calendar' ? 'fill' : 'regular'} />, 'Calendar')}
            {toggleBtn('table', <ListIcon size={14} weight={view === 'table' ? 'fill' : 'regular'} />, 'Table')}
          </div>
        )}
      />

      {view === 'table' ? (
        <DataTable
          columns={upcomingColumns}
          data={transactions}
          isLoading={tableLoading}
          loadingRows={5}
          hidePagination
          emptyTitle="No upcoming pickups"
          emptyDescription="No transactions with a pickup date in the next 3 days."
          onRowClick={(txn) => router.push(`/transactions/${txn.id}`)}
        />
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 hover:text-zinc-950 transition-colors"
            >
              <CaretLeftIcon size={16} />
            </button>
            <span className="text-sm font-semibold text-zinc-950">
              {MONTH_NAMES[viewMonth - 1]} {viewYear}
            </span>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 hover:text-zinc-950 transition-colors"
            >
              <CaretRightIcon size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 border border-zinc-200 rounded-lg overflow-hidden">
            {DAY_HEADERS.map((d) => (
              <div
                key={d}
                className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-400 bg-zinc-50 border-b border-zinc-200"
              >
                {d}
              </div>
            ))}

            {Array.from({ length: firstDay }).map((_, i) => (
              <div
                key={`pre-${i}`}
                className="min-h-[72px] border-b border-r border-zinc-100 bg-zinc-50/40"
              />
            ))}

            {Array.from({ length: totalDays }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const txns = byDate.get(dateStr) ?? [];
              const isToday = dateStr === todayStr;
              const hasPicks = txns.length > 0;
              const colIndex = (firstDay + i) % 7;
              return (
                <div
                  key={day}
                  onClick={() => hasPicks && setSelectedDate(dateStr)}
                  className={cn(
                    'min-h-[72px] p-2 border-b border-zinc-100 flex flex-col',
                    colIndex < 6 && 'border-r',
                    hasPicks && 'cursor-pointer hover:bg-blue-50/40',
                  )}
                >
                  <span className={cn(
                    'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 shrink-0',
                    isToday ? 'bg-zinc-950 text-white' : 'text-zinc-500',
                  )}>
                    {day}
                  </span>
                  {hasPicks && (
                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-semibold leading-none w-fit">
                      {txns.length} {txns.length === 1 ? 'pickup' : 'pickups'}
                    </span>
                  )}
                </div>
              );
            })}

            {Array.from({ length: trailingCount }).map((_, i) => (
              <div
                key={`post-${i}`}
                className="min-h-[72px] border-b border-r border-zinc-100 bg-zinc-50/40 last:border-r-0"
              />
            ))}
          </div>

          {calLoading && (
            <p className="mt-4 text-sm text-zinc-400 text-center">Loading...</p>
          )}
        </div>
      )}

      <Dialog open={!!selectedDate} onOpenChange={(open) => { if (!open) setSelectedDate(null); }}>
        <DialogContent className="bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              {selectedDate ? formatDate(selectedDate) : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="divide-y divide-zinc-100 -mx-1">
            {dialogTxns.map((txn) => (
              <button
                key={txn.id}
                onClick={() => { setSelectedDate(null); router.push(`/transactions/${txn.id}`); }}
                className="w-full flex items-center gap-3 py-3 px-2 hover:bg-zinc-50 transition-colors text-left rounded"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs text-zinc-400">#{txn.number}</span>
                    <StatusBadge status={txn.status} />
                    {txn.itemCount != null && (
                      <span className="text-[10px] text-zinc-400">{txn.itemCount} {txn.itemCount === 1 ? 'item' : 'items'}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-zinc-950 truncate">
                    {toTitleCase(txn.customerName) || '—'}
                  </p>
                </div>
                <BalancePill txn={txn} />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
