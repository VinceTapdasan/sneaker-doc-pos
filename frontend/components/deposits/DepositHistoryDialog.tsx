'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { formatPeso, formatDatetime, cn } from '@/lib/utils';
import { useDepositsAuditQuery } from '@/hooks/useDepositsQuery';

type PaymentFilter = 'all' | 'cash' | 'gcash' | 'card';

const FILTERS: { label: string; value: PaymentFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Cash', value: 'cash' },
  { label: 'GCash', value: 'gcash' },
  { label: 'Card', value: 'card' },
];

interface DepositHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  year: number;
  month: number;
  monthLabel: string;
  branchId?: number;
}

export function DepositHistoryDialog({
  open,
  onClose,
  year,
  month,
  monthLabel,
  branchId,
}: DepositHistoryDialogProps) {
  const [filter, setFilter] = useState<PaymentFilter>('all');
  const { data = [], isLoading } = useDepositsAuditQuery(year, month, branchId, 'bank_deposit');

  const filtered = filter === 'all'
    ? data
    : data.filter((entry) => (entry.details?.origin as string | undefined) === filter);

  const filteredTotal = useMemo(
    () => filtered.reduce((acc, e) => acc + Number(e.details?.added ?? 0), 0),
    [filtered],
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-white sm:max-w-2xl flex flex-col max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-base">Bank Deposit History</DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">{monthLabel}</DialogDescription>
        </DialogHeader>

        {/* Filter buttons — stays fixed, outside scroll area */}
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                filter === f.value
                  ? 'bg-zinc-950 text-white'
                  : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-12">No deposits recorded.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-zinc-100">
                  <th className="py-2.5 text-left font-medium text-zinc-400">Deposited By</th>
                  <th className="py-2.5 text-left font-medium text-zinc-400">Source</th>
                  <th className="py-2.5 text-right font-medium text-zinc-400">Amount</th>
                  <th className="py-2.5 text-right font-medium text-zinc-400">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.map((entry) => {
                  const origin = entry.details?.origin as string | undefined;
                  const sourceLabel = origin === 'gcash' ? 'GCash' : origin === 'card' ? 'Card' : origin === 'cash' ? 'Cash' : '—';
                  return (
                    <tr key={entry.id} className="hover:bg-zinc-50/50 transition-colors duration-100">
                      <td className="py-2.5 text-zinc-700 max-w-[160px] truncate">
                        {entry.performedByEmail ?? '—'}
                      </td>
                      <td className="py-2.5 text-zinc-500">
                        {sourceLabel}
                      </td>
                      <td className="py-2.5 text-right font-mono text-zinc-950">
                        {formatPeso(entry.details?.added ?? '0')}
                      </td>
                      <td className="py-2.5 text-right text-zinc-400 whitespace-nowrap pl-4">
                        {formatDatetime(entry.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-zinc-200">
                  <td colSpan={2} className="py-2.5 text-xs font-medium text-zinc-500">Total</td>
                  <td className="py-2.5 text-right font-mono font-medium text-zinc-950">
                    {formatPeso(filteredTotal)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
