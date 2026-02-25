'use client';

import { use, useMemo, useState } from 'react';
import { ArrowLeftIcon, PlusIcon } from '@phosphor-icons/react';
import Link from 'next/link';
import { formatPeso, formatDate, formatDatetime, PAYMENT_METHOD_LABELS, STATUS_LABELS } from '@/lib/utils';
import { toTitleCase } from '@/utils/text';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Select } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { Spinner } from '@/components/ui/spinner';
import { createTransactionItemColumns } from '@/columns/transaction-items-columns';
import {
  useTransactionDetailQuery,
  useUpdateTransactionStatusMutation,
  useUpdateItemStatusMutation,
  useAddPaymentMutation,
} from '@/hooks/useTransactionsQuery';
import type { TransactionStatus, PaymentMethod } from '@/lib/types';

const STATUSES: TransactionStatus[] = ['pending', 'in_progress', 'done', 'claimed'];
const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'gcash', 'card', 'bank_deposit'];

export default function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentAmount, setPaymentAmount] = useState('');

  const { data: txn, isLoading } = useTransactionDetailQuery(id);
  const updateStatusMut = useUpdateTransactionStatusMutation(id);
  const updateItemStatusMut = useUpdateItemStatusMutation(id);

  const itemColumns = useMemo(
    () => createTransactionItemColumns({
      onStatusChange: (itemId, status) => updateItemStatusMut.mutate({ itemId, status }),
    }),
    [],
  );
  const addPaymentMut = useAddPaymentMutation(id, () => {
    setShowPaymentForm(false);
    setPaymentAmount('');
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-white border border-zinc-200 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!txn) return <p className="text-sm text-zinc-400">Transaction not found.</p>;

  const balance = parseFloat(txn.total) - parseFloat(txn.paid);

  return (
    <div>
      <PageHeader
        title={`Transaction #${txn.number}`}
        subtitle={`Created ${formatDatetime(txn.createdAt)}`}
        backButton={
          <Link href="/transactions">
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon size={14} />
            </Button>
          </Link>
        }
        action={
          <Select
            value={txn.status}
            onChange={(e) => updateStatusMut.mutate(e.target.value as TransactionStatus)}
            className="w-40"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: items */}
        <div className="lg:col-span-2 space-y-4">
          {/* Customer */}
          <div className="bg-white border border-zinc-200 rounded-lg p-5">
            <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
              Customer
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-zinc-400">Name</p>
                <p className="text-sm font-medium text-zinc-950">{toTitleCase(txn.customerName) || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400">Phone</p>
                <p className="text-sm text-zinc-700">{txn.customerPhone ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400">Pickup</p>
                <p className="text-sm text-zinc-700">{formatDate(txn.pickupDate)}</p>
              </div>
            </div>
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
              Shoes & Services ({txn.items?.length ?? 0} items)
            </p>
            <DataTable
              columns={itemColumns}
              data={txn.items ?? []}
              emptyTitle="No items"
            />
          </div>
        </div>

        {/* Right: payment */}
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-white border border-zinc-200 rounded-lg p-5">
            <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-4">
              Payment Summary
            </h2>
            <div className="space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Total</span>
                <span className="font-mono font-medium text-zinc-950">{formatPeso(txn.total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Paid</span>
                <span className="font-mono text-emerald-600">{formatPeso(txn.paid)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-zinc-100 pt-2.5">
                <span className="font-medium text-zinc-950">Balance</span>
                <span
                  className={`font-mono font-semibold ${balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}
                >
                  {balance > 0 ? formatPeso(balance) : 'Fully paid'}
                </span>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              className="w-full mt-4"
              onClick={() => setShowPaymentForm((v) => !v)}
            >
              <PlusIcon size={13} />
              Add Payment
            </Button>

            {showPaymentForm && (
              <div className="mt-3 space-y-2.5 pt-3 border-t border-zinc-100">
                <Select
                  label="Method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABELS[m]}
                    </option>
                  ))}
                </Select>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-700">Amount (₱)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  disabled={!paymentAmount || addPaymentMut.isPending}
                  onClick={() => addPaymentMut.mutate({ method: paymentMethod, amount: paymentAmount })}
                >
                  {addPaymentMut.isPending ? <Spinner /> : 'Record Payment'}
                </Button>
              </div>
            )}
          </div>

          {/* Payment history */}
          {txn.payments && txn.payments.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-lg p-5">
              <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
                Payment History
              </h2>
              <div className="space-y-2">
                {txn.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-zinc-700">
                        {PAYMENT_METHOD_LABELS[p.method]}
                      </p>
                      <p className="text-xs text-zinc-400">{formatDatetime(p.paidAt)}</p>
                    </div>
                    <span className="font-mono text-sm text-zinc-950">{formatPeso(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          <div className="bg-white border border-zinc-200 rounded-lg p-5">
            <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
              Status
            </h2>
            <StatusBadge status={txn.status} />
          </div>
        </div>
      </div>
    </div>
  );
}
