'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftIcon, PlusIcon, EnvelopeIcon, ArrowRightIcon } from '@phosphor-icons/react';
import { Lightbox } from '@/components/ui/lightbox';
import Link from 'next/link';
import { formatPeso, formatDate, formatDatetime, PAYMENT_METHOD_LABELS, cn } from '@/lib/utils';
import { toTitleCase } from '@/utils/text';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/components/ui/data-table';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { createTransactionItemColumns } from '@/columns/transaction-items-columns';
import {
  useTransactionDetailQuery,
  useUpdateTransactionMutation,
  useUpdateItemStatusMutation,
  useAddPaymentMutation,
} from '@/hooks/useTransactionsQuery';
import { PAYMENT_METHOD_VALUES } from '@/lib/constants';
import { generateGmailLink, EMAIL_TEMPLATES, EMAIL_TEMPLATE_LABELS } from '@/utils/email';
import type { EmailTemplateKey } from '@/utils/email';
import type { PaymentMethod, ItemStatus } from '@/lib/types';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export default function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentError, setPaymentError] = useState('');

  const [emailTemplate, setEmailTemplate] = useState<EmailTemplateKey>(EMAIL_TEMPLATES.pickup_ready);
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(null);

  const [rescheduleValue, setRescheduleValue] = useState('');
  const [noteValue, setNoteValue] = useState('');
  const initializedRef = useRef<string | null>(null);

  const { data: txn, isLoading, isFetching } = useTransactionDetailQuery(id);
  const updateTxnMut = useUpdateTransactionMutation(id);
  const updateItemStatusMut = useUpdateItemStatusMutation(id);

  const [loadingItemIds, setLoadingItemIds] = useState<Set<number>>(new Set());
  const [pendingItemChange, setPendingItemChange] = useState<{
    itemId: number;
    newStatus: ItemStatus;
    currentStatus: string;
    shoeDescription: string;
    serviceName: string;
  } | null>(null);
  const txnRef = useRef(txn);
  useEffect(() => { txnRef.current = txn; }, [txn]);

  useEffect(() => {
    if (!isFetching && !updateItemStatusMut.isPending && loadingItemIds.size > 0) {
      setLoadingItemIds(new Set());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFetching, updateItemStatusMut.isPending]);

  useEffect(() => {
    if (txn && initializedRef.current !== id) {
      initializedRef.current = id;
      setRescheduleValue(txn.newPickupDate ?? '');
      setNoteValue(txn.note ?? '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txn?.id]);

  const itemColumns = useMemo(
    () => createTransactionItemColumns({
      onStatusChange: (itemId, status) => {
        const item = txnRef.current?.items?.find((i) => i.id === itemId);
        setPendingItemChange({
          itemId,
          newStatus: status,
          currentStatus: item?.status ?? '',
          shoeDescription: item?.shoeDescription ?? '',
          serviceName: item?.service?.name ?? '',
        });
      },
      onImageClick: (src, label) => setLightbox({ src, label }),
      loadingItemIds,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadingItemIds],
  );
  const addPaymentMut = useAddPaymentMutation(id, () => {
    setPaymentDialogOpen(false);
    setPaymentAmount('');
    setPaymentError('');
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
  const txnLocked = ['cancelled', 'claimed'].includes(txn.status);

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
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: items */}
        <div className="lg:col-span-2 space-y-4">
          {/* Customer */}
          <div className="bg-white border border-zinc-200 rounded-lg p-5">
            <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
              Customer
            </h2>
            <div className={cn('grid grid-cols-1 gap-4', txn.newPickupDate ? 'sm:grid-cols-4' : 'sm:grid-cols-3')}>
              <div>
                <p className="text-xs text-zinc-400">Name</p>
                <p className="text-sm font-medium text-zinc-950">{toTitleCase(txn.customerName) || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400">Phone</p>
                <p className="text-sm text-zinc-700">{txn.customerPhone ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400">Original Pickup</p>
                <p className="text-sm text-zinc-700">{formatDate(txn.pickupDate)}</p>
              </div>
              {txn.newPickupDate && (
                <div>
                  <p className="text-xs text-amber-600">Rescheduled</p>
                  <p className="text-sm font-medium text-amber-600">{formatDate(txn.newPickupDate)}</p>
                </div>
              )}
            </div>

            {!txnLocked && (
              <div className="mt-3 pt-3 border-t border-zinc-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-400 mb-1.5">
                    {txn.newPickupDate ? 'Update Rescheduled Date' : 'Reschedule Pickup'}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={rescheduleValue}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setRescheduleValue(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md text-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <Button
                      size="sm"
                      variant="dark"
                      disabled={!rescheduleValue || updateTxnMut.isPending}
                      onClick={() => updateTxnMut.mutate({ newPickupDate: rescheduleValue })}
                    >
                      {updateTxnMut.isPending ? <Spinner /> : 'Save'}
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-zinc-400 mb-1.5">Note</p>
                  <div className="flex flex-col gap-2">
                    <textarea
                      rows={2}
                      value={noteValue}
                      onChange={(e) => setNoteValue(e.target.value)}
                      placeholder="Internal note..."
                      className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                    />
                    <Button
                      size="sm"
                      variant="dark"
                      disabled={noteValue === (txn.note ?? '') || updateTxnMut.isPending}
                      onClick={() => updateTxnMut.mutate({ note: noteValue || null })}
                      className="self-end"
                    >
                      {updateTxnMut.isPending ? <Spinner /> : 'Save Note'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {txnLocked && txn.note && (
              <div className="mt-3 pt-3 border-t border-zinc-100">
                <p className="text-xs text-zinc-400">Note</p>
                <p className="text-sm text-zinc-700 mt-0.5 whitespace-pre-wrap">{txn.note}</p>
              </div>
            )}
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
              Shoes & Services ({txn.items?.length ?? 0} items)
            </p>
            <DataTable
              columns={itemColumns}
              data={[...(txn.items ?? [])].sort((a, b) => a.id - b.id)}
              isLoading={isFetching && !txn.items}
              loadingRows={3}
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
              {txn.promo && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Promo</span>
                  <span className="font-mono text-emerald-600">
                    {txn.promo.code} · -{parseFloat(txn.promo.percent).toFixed(0)}%
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Paid</span>
                <span className="font-mono text-emerald-600">{formatPeso(txn.paid)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-zinc-100 pt-2.5">
                <span className="font-medium text-zinc-950">Balance</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-mono ${
                  balance <= 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : parseFloat(txn.paid) > 0
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-600'
                }`}>
                  {balance <= 0 ? 'Fully paid' : parseFloat(txn.paid) > 0 ? `Partial · ${formatPeso(balance)}` : formatPeso(balance)}
                </span>
              </div>
            </div>

            <Button
              variant="dark"
              size="sm"
              className="w-full mt-4"
              disabled={balance <= 0}
              onClick={() => { setPaymentDialogOpen(true); setPaymentError(''); }}
            >
              <PlusIcon size={13} />
              {balance <= 0 ? 'Fully Paid' : 'Add Payment'}
            </Button>
          </div>

          <Dialog
            open={paymentDialogOpen}
            onOpenChange={(open) => {
              setPaymentDialogOpen(open);
              if (!open) { setPaymentAmount(''); setPaymentError(''); }
            }}
          >
            <DialogContent className="bg-white sm:max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-base">Record Payment</DialogTitle>
                <DialogDescription className="text-xs text-zinc-400">
                  #{txn.number} — Balance: <span className="font-mono font-medium text-amber-600">{formatPeso(balance)}</span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-1">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-700">Method</label>
                  <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                    <SelectTrigger className="h-9 text-sm w-full border-zinc-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHOD_VALUES.map((m) => (
                        <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-700">Amount (₱)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => { setPaymentAmount(e.target.value); setPaymentError(''); }}
                    className={cn(
                      'w-full px-3 py-2 text-sm bg-white border rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
                      paymentError ? 'border-red-400' : 'border-zinc-200',
                    )}
                    placeholder="0.00"
                    autoFocus
                  />
                  {paymentError && (
                    <p className="text-xs text-red-500">{paymentError}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="dark"
                  className="w-full"
                  disabled={!paymentAmount || addPaymentMut.isPending}
                  onClick={() => {
                    const amt = parseFloat(paymentAmount);
                    if (isNaN(amt) || amt <= 0) {
                      setPaymentError('Enter a valid amount');
                      return;
                    }
                    if (amt > balance) {
                      setPaymentError(`Amount exceeds remaining balance of ${formatPeso(balance)}`);
                      return;
                    }
                    addPaymentMut.mutate({ method: paymentMethod, amount: paymentAmount });
                  }}
                >
                  {addPaymentMut.isPending ? <Spinner /> : 'Record Payment'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

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

          {/* Email customer */}
          {txn.customerEmail && (
            <div className="bg-white border border-zinc-200 rounded-lg p-5">
              <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
                Email Customer
              </h2>
              <p className="text-xs text-zinc-400 mb-3 truncate">{txn.customerEmail}</p>
              <div className="space-y-2">
                <Select value={emailTemplate} onValueChange={(v) => setEmailTemplate(v as EmailTemplateKey)}>
                  <SelectTrigger className="h-9 text-sm w-full border-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EMAIL_TEMPLATE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <a
                  href={generateGmailLink(txn, emailTemplate)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-3 py-2 text-sm font-medium bg-zinc-950 text-white rounded-md hover:bg-zinc-800 transition-colors duration-150"
                >
                  <EnvelopeIcon size={13} />
                  Open in Gmail
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      <Lightbox
        open={!!lightbox}
        src={lightbox?.src ?? ''}
        alt={lightbox?.label}
        onClose={() => setLightbox(null)}
      />

      <ConfirmDialog
        open={pendingItemChange !== null}
        title="Change item status?"
        confirmLabel="Update Status"
        confirmVariant="dark"
        loading={updateItemStatusMut.isPending}
        onConfirm={() => {
          if (!pendingItemChange) return;
          setPendingItemChange(null);
          setLoadingItemIds((prev) => new Set([...prev, pendingItemChange.itemId]));
          updateItemStatusMut.mutate({ itemId: pendingItemChange.itemId, status: pendingItemChange.newStatus });
        }}
        onCancel={() => setPendingItemChange(null)}
      >
        {pendingItemChange && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Customer</span>
              <span className="text-zinc-950">{toTitleCase(txn.customerName) || '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Shoe</span>
              <span className="text-zinc-950">{toTitleCase(pendingItemChange.shoeDescription) || '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Service</span>
              <span className="text-zinc-950">{pendingItemChange.serviceName || '—'}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-500">Status</span>
              <div className="flex items-center gap-2">
                <StatusBadge status={pendingItemChange.currentStatus} />
                <ArrowRightIcon size={12} className="text-zinc-400" />
                <StatusBadge status={pendingItemChange.newStatus} />
              </div>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
