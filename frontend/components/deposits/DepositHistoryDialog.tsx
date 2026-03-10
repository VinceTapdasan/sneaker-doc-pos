'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { formatPeso, formatDatetime } from '@/lib/utils';
import { useDepositsAuditQuery } from '@/hooks/useDepositsQuery';

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
  const { data = [], isLoading } = useDepositsAuditQuery(year, month, branchId, 'bank_deposit');

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-white sm:max-w-2xl flex flex-col max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-base">Bank Deposit History</DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">{monthLabel}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : data.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-12">No bank deposits recorded.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-zinc-100">
                  <th className="py-2.5 text-left font-medium text-zinc-400">Deposited By</th>
                  <th className="py-2.5 text-right font-medium text-zinc-400">Amount</th>
                  <th className="py-2.5 text-right font-medium text-zinc-400">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {data.map((entry) => (
                  <tr key={entry.id} className="hover:bg-zinc-50/50 transition-colors duration-100">
                    <td className="py-2.5 text-zinc-700 max-w-[200px] truncate">
                      {entry.performedByEmail ?? '—'}
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
