'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { formatPeso, formatDatetime, PAYMENT_METHOD_LABELS } from '@/lib/utils';
import { useDepositsAuditQuery } from '@/hooks/useDepositsQuery';

const TABS = [
  { value: '', label: 'All' },
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'bank_deposit', label: 'Bank Deposit' },
  { value: 'card', label: 'Card' },
];

interface DepositHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  year: number;
  month: number;
  monthLabel: string;
  branchId?: number;
  initialMethod?: string;
}

export function DepositHistoryDialog({
  open,
  onClose,
  year,
  month,
  monthLabel,
  branchId,
  initialMethod,
}: DepositHistoryDialogProps) {
  const [activeMethod, setActiveMethod] = useState(initialMethod ?? '');

  useEffect(() => {
    if (open) setActiveMethod(initialMethod ?? '');
  }, [open, initialMethod]);

  const { data = [], isLoading } = useDepositsAuditQuery(year, month, branchId, activeMethod || undefined);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-white sm:max-w-2xl flex flex-col max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-base">Deposit History</DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">{monthLabel}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-0 border-b border-zinc-100 -mx-6 px-6 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveMethod(tab.value)}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors duration-150 ${
                activeMethod === tab.value
                  ? 'border-zinc-950 text-zinc-950'
                  : 'border-transparent text-zinc-400 hover:text-zinc-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : data.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-12">No deposit records found.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-zinc-100">
                  <th className="py-2.5 text-left font-medium text-zinc-400">Deposited By</th>
                  <th className="py-2.5 text-left font-medium text-zinc-400">Method</th>
                  <th className="py-2.5 text-right font-medium text-zinc-400">Amount</th>
                  <th className="py-2.5 text-right font-medium text-zinc-400">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {data.map((entry) => (
                  <tr key={entry.id} className="hover:bg-zinc-50/50 transition-colors duration-100">
                    <td className="py-2.5 text-zinc-700 max-w-[160px] truncate">
                      {entry.performedByEmail ?? '—'}
                    </td>
                    <td className="py-2.5 text-zinc-500">
                      {PAYMENT_METHOD_LABELS[entry.details?.method ?? ''] ?? entry.details?.method ?? '—'}
                    </td>
                    <td className="py-2.5 text-right font-mono text-zinc-950">
                      {formatPeso(entry.details?.added ?? '0')}
                    </td>
                    <td className="py-2.5 text-right text-zinc-400 whitespace-nowrap pl-4">
                      {formatDatetime(entry.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
