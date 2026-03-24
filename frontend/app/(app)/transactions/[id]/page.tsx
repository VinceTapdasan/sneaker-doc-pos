'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeftIcon, PlusIcon, EnvelopeIcon, PaperPlaneTiltIcon, TrashIcon, CameraIcon, UploadSimpleIcon, ArrowCounterClockwiseIcon, WarningIcon, PencilSimpleIcon } from '@phosphor-icons/react';
import { Lightbox } from '@/components/ui/lightbox';
import Link from 'next/link';
import { formatPeso, formatDate, formatDatetime, formatAddress, PAYMENT_METHOD_LABELS, cn } from '@/lib/utils';
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
  useEditTransactionMutation,
  useAddPaymentMutation,

  useDeleteTransactionMutation,
  useRestoreTransactionMutation,
} from '@/hooks/useTransactionsQuery';
import { useCurrentUserQuery } from '@/hooks/useCurrentUserQuery';
import { useUploadPhotoMutation, useUploadTxnPhotoMutation } from '@/hooks/useUploadPhoto';
import { useAssignableUsersQuery } from '@/hooks/useUsersQuery';
import { usePromosQuery } from '@/hooks/usePromosQuery';
import { useServicesQuery } from '@/hooks/useServicesQuery';
import type { Service } from '@/lib/types';
import { PAYMENT_METHOD_VALUES, TRANSACTION_STATUS, CARD_BANK_OPTIONS, getCardFeeRatePreview } from '@/lib/constants';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { generateGmailLink, generateGmailLinkNoBody, openLinkReliably, EMAIL_TEMPLATES, EMAIL_TEMPLATE_LABELS } from '@/utils/email';
import { ClaimStubPreview } from '@/components/transactions/ClaimStubPreview';
import type { EmailTemplateKey } from '@/utils/email';
import type { PaymentMethod } from '@/lib/types';
import { ItemStatusConfirmDialog, type PendingItemChange } from '@/components/transactions/ItemStatusConfirmDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export default function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentCardBank, setPaymentCardBank] = useState(''); // '' = default (3%), 'bpi' = 3.5%
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentError, setPaymentError] = useState('');

  const [emailTemplate, setEmailTemplate] = useState<EmailTemplateKey>(EMAIL_TEMPLATES.pickup_ready);
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(null);
  const [uploadingItemIds, setUploadingItemIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadRef = useRef<{ itemId: number; type: 'before' | 'after' } | null>(null);
  const stubRef = useRef<HTMLDivElement>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);

  const [smsSending, setSmsSending] = useState(false);
  const [smsConfirmed, setSmsConfirmed] = useState(false);

  const txnPhotoFileRef = useRef<HTMLInputElement>(null);
  const txnPhotoCameraRef = useRef<HTMLInputElement>(null);
  const pendingPhotoTypeRef = useRef<'before' | 'after' | null>(null);

  const [rescheduleValue, setRescheduleValue] = useState('');
  const [rescheduleConfirmOpen, setRescheduleConfirmOpen] = useState(false);
  const [noteValue, setNoteValue] = useState('');
  const [pendingStaffId, setPendingStaffId] = useState<string | null>(null);
  const initializedRef = useRef<string | null>(null);

  // Superadmin: bulk edit transaction (items + payments)
  type EditItemDraft = { id: number; shoeDescription: string; serviceId: string };
  type EditPaymentDraft = { id: number; method: string; referenceNumber: string; cardBank: string };
  const [editTxnOpen, setEditTxnOpen] = useState(false);
  const [editDraftItems, setEditDraftItems] = useState<EditItemDraft[]>([]);
  const [editDraftPayments, setEditDraftPayments] = useState<EditPaymentDraft[]>([]);

  const { data: currentUser } = useCurrentUserQuery();
  const isAdmin = currentUser?.userType === 'admin' || currentUser?.userType === 'superadmin';
  const isSuperadmin = currentUser?.userType === 'superadmin';
  const { data: assignableUsers = [] } = useAssignableUsersQuery();
  const { data: activePromos = [] } = usePromosQuery();
  const { data: allServices = [] } = useServicesQuery();
  const [promoEditing, setPromoEditing] = useState(false);
  const [promoSelected, setPromoSelected] = useState('none');

  const { data: txn, isLoading, isFetching } = useTransactionDetailQuery(id);
  const updateTxnMut = useUpdateTransactionMutation(id);
  const deleteTxnMut = useDeleteTransactionMutation(() => router.replace('/transactions'));
  const restoreTxnMut = useRestoreTransactionMutation(() => router.replace('/transactions'));
  const updateItemStatusMut = useUpdateItemStatusMutation(id);
  const editTxnMut = useEditTransactionMutation(id, () => setEditTxnOpen(false));
  const uploadPhotoMut = useUploadPhotoMutation(id);
  const uploadTxnPhotoMut = useUploadTxnPhotoMutation(id);

  const [loadingItemIds, setLoadingItemIds] = useState<Set<number>>(new Set());
  const [pendingItemChange, setPendingItemChange] = useState<PendingItemChange | null>(null);
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

  const handleUploadClick = useCallback((itemId: number, type: 'before' | 'after') => {
    pendingUploadRef.current = { itemId, type };
    fileInputRef.current?.click();
  }, []);

  const handleCameraClick = useCallback((itemId: number, type: 'before' | 'after') => {
    pendingUploadRef.current = { itemId, type };
    cameraInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const pending = pendingUploadRef.current;
      if (!file || !pending || !txn) return;
      // reset so same file can be re-selected if needed
      e.target.value = '';
      const key = `${pending.itemId}-${pending.type}`;
      setUploadingItemIds((prev) => new Set([...prev, key]));
      uploadPhotoMut.mutate(
        { itemId: pending.itemId, type: pending.type, file },
        {
          onSettled: () => {
            setUploadingItemIds((prev) => {
              const next = new Set(prev);
              next.delete(key);
              return next;
            });
          },
        },
      );
      pendingUploadRef.current = null;
    },
    [txn, uploadPhotoMut],
  );

  const txnBalance = txn ? parseFloat(txn.total) - parseFloat(txn.paid) : 0;

  // True if the transaction has at least one transaction-level "after" photo
  const hasTransactionAfterPhoto = useMemo(
    () => (txn?.photos ?? []).some((p) => p.type === 'after'),
    [txn?.photos],
  );

  function handleSendPickupSms() {
    if (!txn) return;
    setSmsSending(false);
    setSmsDialogOpen(true);
  }

  async function confirmSendSms() {
    if (!txn) return;
    setSmsSending(true);
    try {
      await api.transactions.sendPickupReadySms(txn.id);
      setSmsDialogOpen(false);
      toast.success(`SMS sent to ${txn.customerPhone}`);
    } catch {
      setSmsDialogOpen(false);
      toast.error('Failed to send SMS. Please try again.');
    } finally {
      setSmsSending(false);
    }
  }

  async function autoSendSms() {
    if (!txn?.customerPhone) return;
    setSmsDialogOpen(true);
    setSmsSending(true);
    setSmsConfirmed(true);
    try {
      await api.transactions.sendPickupReadySms(txn.id);
      setSmsDialogOpen(false);
      toast.success(`SMS sent to ${txn.customerPhone}`);
    } catch {
      setSmsDialogOpen(false);
      toast.error('Failed to send SMS. Please try again.');
    } finally {
      setSmsSending(false);
      setSmsConfirmed(false);
    }
  }

  function handleTxnPhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const type = pendingPhotoTypeRef.current;
    if (!file || !type) return;
    uploadTxnPhotoMut.mutate({ type, file });
    e.target.value = '';
  }

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
      onUploadClick: handleUploadClick,
      onCameraClick: handleCameraClick,
      loadingItemIds,
      uploadingItemIds,
      disableUploadBefore: true,
    }),
    [loadingItemIds, uploadingItemIds, handleUploadClick, handleCameraClick],
  );
  const addPaymentMut = useAddPaymentMutation(id, () => {
    setPaymentDialogOpen(false);
    setPaymentAmount('');
    setPaymentCardBank('');
    setPaymentError('');
  });


  if (isLoading || (isFetching && !txn)) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-zinc-200 rounded animate-pulse mb-2" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 bg-zinc-200 border border-zinc-200 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!txn) return <p className="text-sm text-zinc-400">Transaction not found.</p>;

  const balance = parseFloat(txn.total) - parseFloat(txn.paid);
  const refundAmount = balance < 0 ? Math.abs(balance) : 0;
  const isDeleted = !!txn.deletedAt;
  const txnLocked = isDeleted || ([TRANSACTION_STATUS.CANCELLED, TRANSACTION_STATUS.CLAIMED] as string[]).includes(txn.status);

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
        action={isAdmin ? (() => {
          if (isDeleted) {
            return (
              <Button
                size="sm"
                variant="ghost"
                disabled={restoreTxnMut.isPending}
                onClick={() => setRestoreConfirmOpen(true)}
              >
                <ArrowCounterClockwiseIcon size={14} />
                {restoreTxnMut.isPending ? 'Restoring…' : 'Restore'}
              </Button>
            );
          }
          const cantDelete = !['pending', 'cancelled'].includes(txn.status);
          const deleteTitle = cantDelete
            ? 'Only Pending or Cancelled transactions can be deleted'
            : undefined;
          return (
            <div className="flex items-center gap-2">
              {isSuperadmin && (
                <button
                  onClick={() => {
                    const nonCancelledItems = (txn.items ?? []).filter((i) => i.status !== 'cancelled');
                    setEditDraftItems(nonCancelledItems.map((i) => ({
                      id: i.id,
                      shoeDescription: i.shoeDescription ?? '',
                      serviceId: i.service ? String(i.service.id) : '',
                    })));
                    setEditDraftPayments((txn.payments ?? []).map((p) => ({
                      id: p.id,
                      method: p.method,
                      referenceNumber: p.referenceNumber ?? '',
                      cardBank: p.cardBank ?? '',
                    })));
                    setEditTxnOpen(true);
                  }}
                  className="flex items-center gap-1.5 bg-zinc-900 text-white rounded-md px-3.5 py-1.5 text-xs font-semibold hover:bg-zinc-700 transition-colors duration-150"
                >
                  <PencilSimpleIcon size={13} weight="bold" />
                  Edit
                </button>
              )}
              <Button
                variant="danger"
                size="sm"
                disabled={cantDelete || deleteTxnMut.isPending}
                title={deleteTitle}
                onClick={() => !cantDelete && setDeleteConfirmOpen(true)}
              >
                <TrashIcon size={14} />
                Delete
              </Button>
            </div>
          );
        })() : undefined}
      />

      {isDeleted && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <WarningIcon size={15} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700">
            This transaction was deleted on <span className="font-medium">{formatDate(txn.deletedAt!)}</span>. All fields are read-only and it is excluded from all reports.
          </p>
        </div>
      )}

      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${isDeleted ? 'opacity-50 pointer-events-none select-none' : ''}`}>
        {/* Left: items */}
        <div className="lg:col-span-2 space-y-4">
          {/* Customer */}
          <div className="bg-white border border-zinc-200 rounded-lg p-5">
            <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
              Customer
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
              {txn.branchName && (
                <div>
                  <p className="text-xs text-zinc-400">Branch</p>
                  <p className="text-sm text-zinc-700">{toTitleCase(txn.branchName)}</p>
                </div>
              )}
              {txn.staffNickname && (
                <div>
                  <p className="text-xs text-zinc-400">Assigned To</p>
                  <p className="text-sm text-zinc-700">{toTitleCase(txn.staffNickname)}</p>
                </div>
              )}
              {txn.newPickupDate && (
                <div>
                  <p className="text-xs text-amber-600">Rescheduled</p>
                  <p className="text-sm font-medium text-amber-600">{formatDate(txn.newPickupDate)}</p>
                </div>
              )}
            </div>
            {(txn.customerStreetName || txn.customerCity) && (
              <div className="mt-3 pt-3 border-t border-zinc-100">
                <p className="text-xs text-zinc-400 mb-1">Address</p>
                <p className="text-sm text-zinc-700">
                  {formatAddress({
                    streetName: txn.customerStreetName,
                    city: txn.customerCity,
                  })}
                </p>
              </div>
            )}

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
                      onClick={() => setRescheduleConfirmOpen(true)}
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
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Shoes & Services ({txn.items?.length ?? 0} items)
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Overall Status</span>
                <StatusBadge status={txn.status} />
              </div>
            </div>
            <DataTable
              columns={itemColumns}
              data={[...(txn.items ?? [])].sort((a, b) => a.id - b.id)}
              isLoading={isFetching && !txn.items}
              loadingRows={3}
              emptyTitle="No items"
            />
          </div>

          {/* Photo Dump */}
          <div className="bg-white border border-zinc-200 rounded-lg p-5">
            <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-4">
              Photos
            </h2>

            {/* Hidden file inputs */}
            <input
              ref={txnPhotoFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleTxnPhotoFile}
            />
            <input
              ref={txnPhotoCameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleTxnPhotoFile}
            />

            {(['before', 'after'] as const).map((photoType) => {
              const photos = (txn.photos ?? []).filter((p) => p.type === photoType);
              return (
                <div key={photoType} className="mb-5 last:mb-0">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-zinc-700 capitalize">{photoType} Photos</p>
                    {!txnLocked && (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          title="Take photo"
                          disabled={uploadTxnPhotoMut.isPending}
                          onClick={() => {
                            pendingPhotoTypeRef.current = photoType;
                            txnPhotoCameraRef.current?.click();
                          }}
                          className="w-7 h-7 flex items-center justify-center text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded transition-colors duration-150 disabled:opacity-50"
                        >
                          <CameraIcon size={13} />
                        </button>
                        <button
                          type="button"
                          title="Upload file"
                          disabled={uploadTxnPhotoMut.isPending}
                          onClick={() => {
                            pendingPhotoTypeRef.current = photoType;
                            txnPhotoFileRef.current?.click();
                          }}
                          className="w-7 h-7 flex items-center justify-center text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded transition-colors duration-150 disabled:opacity-50"
                        >
                          <UploadSimpleIcon size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                  {photos.length === 0 ? (
                    <p className="text-xs text-zinc-400">No {photoType} photos yet.</p>
                  ) : (
                    <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5">
                      {photos.map((photo) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => setLightbox({ src: photo.url, label: `${photoType} photo` })}
                          className="aspect-square rounded-md overflow-hidden border border-zinc-200 hover:border-zinc-400 transition-colors duration-150"
                        >
                          <img
                            src={photo.url}
                            alt={`${photoType} photo`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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
              {/* Superadmin: apply / change / remove promo inline */}
              {isSuperadmin && txn.status !== 'cancelled' && txn.status !== 'claimed' && parseFloat(txn.paid) < parseFloat(txn.total) && (
                promoEditing ? (
                  <div className="flex flex-col gap-2 pt-1">
                    <label className="text-xs font-medium text-zinc-700">Change Promo</label>
                    <Select value={promoSelected} onValueChange={setPromoSelected}>
                      <SelectTrigger className="h-8 text-sm border-zinc-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No promo</SelectItem>
                        {activePromos.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.code} · -{parseFloat(p.percent).toFixed(0)}%
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="dark"
                        disabled={updateTxnMut.isPending}
                        onClick={() => {
                          const newPromoId = promoSelected === 'none' ? null : parseInt(promoSelected, 10);
                          updateTxnMut.mutate({ promoId: newPromoId }, {
                            onSuccess: () => setPromoEditing(false),
                          });
                        }}
                      >
                        {updateTxnMut.isPending ? <Spinner /> : 'Apply'}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setPromoEditing(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-xs text-zinc-400 hover:text-zinc-600 underline underline-offset-2 text-left"
                    onClick={() => {
                      setPromoSelected(txn.promoId ? String(txn.promoId) : 'none');
                      setPromoEditing(true);
                    }}
                  >
                    {txn.promo ? 'Change promo' : 'Add promo'}
                  </button>
                )
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

            {refundAmount > 0 ? (
              <Button
                variant="danger"
                size="sm"
                className="w-full mt-4"
                onClick={() => setPaymentDialogOpen(true)}
              >
                Refund Payment · {formatPeso(refundAmount)}
              </Button>
            ) : (
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
            )}
          </div>

          <Dialog
            open={paymentDialogOpen}
            onOpenChange={(open) => {
              setPaymentDialogOpen(open);
              if (!open) { setPaymentAmount(''); setPaymentRef(''); setPaymentError(''); }
            }}
          >
            <DialogContent className="bg-white sm:max-w-sm">
              {refundAmount > 0 ? (
                <>
                  <DialogHeader>
                    <DialogTitle className="text-base">Refund Payment</DialogTitle>
                    <DialogDescription className="text-xs text-zinc-400">
                      #{txn.number} — Refund to customer
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 pt-1">
                    <div className="bg-red-50 border border-red-100 rounded-md p-3 text-center">
                      <p className="text-xs text-red-600 mb-1">Refund amount</p>
                      <p className="font-mono text-xl font-semibold text-red-700">{formatPeso(refundAmount)}</p>
                      <p className="text-xs text-zinc-400 mt-1">Paid {formatPeso(txn.paid)} · New total {formatPeso(txn.total)}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="danger"
                      className="w-full"
                      disabled={updateTxnMut.isPending}
                      onClick={() => updateTxnMut.mutate({ paid: txn.total }, {
                        onSuccess: () => setPaymentDialogOpen(false),
                      })}
                    >
                      {updateTxnMut.isPending ? <Spinner /> : 'Confirm Refund'}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle className="text-base">Record Payment</DialogTitle>
                    <DialogDescription className="text-xs text-zinc-400">
                      #{txn.number} — Balance: <span className="font-mono font-medium text-amber-600">{formatPeso(balance)}</span>
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-zinc-700">Method</label>
                        <Select value={paymentMethod} onValueChange={(v) => { setPaymentMethod(v as PaymentMethod); setPaymentCardBank(''); }}>
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
                        <label className="text-xs font-medium text-zinc-700">Reference #</label>
                        <input
                          type="text"
                          value={paymentRef}
                          onChange={(e) => setPaymentRef(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="e.g. GCash ref"
                        />
                      </div>
                    </div>
                    {/* Card bank selector — only shown when method=card */}
                    {paymentMethod === 'card' && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-zinc-700">Card Bank</label>
                        <Select value={paymentCardBank} onValueChange={setPaymentCardBank}>
                          <SelectTrigger className="h-9 text-sm w-full border-zinc-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CARD_BANK_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
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
                      {/* Card fee preview — display only, authoritative value computed server-side */}
                      {paymentMethod === 'card' && paymentAmount && parseFloat(paymentAmount) > 0 && (() => {
                        const rate = getCardFeeRatePreview(paymentCardBank);
                        const feeAmt = parseFloat(paymentAmount) * rate;
                        const netAmt = parseFloat(paymentAmount) - feeAmt;
                        return (
                          <div className="rounded-md bg-violet-50 border border-violet-100 px-3 py-2 text-xs space-y-0.5">
                            <div className="flex justify-between text-violet-700">
                              <span>Card fee ({(rate * 100).toFixed(1)}%)</span>
                              <span className="font-mono">-{formatPeso(feeAmt.toFixed(2))}</span>
                            </div>
                            <div className="flex justify-between font-medium text-violet-900">
                              <span>Net received</span>
                              <span className="font-mono">{formatPeso(netAmt.toFixed(2))}</span>
                            </div>
                          </div>
                        );
                      })()}
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
                        addPaymentMut.mutate({
                          method: paymentMethod,
                          amount: paymentAmount,
                          ...(paymentRef.trim() ? { referenceNumber: paymentRef.trim() } : {}),
                          ...(paymentMethod === 'card' ? { cardBank: paymentCardBank || undefined } : {}),
                        });
                      }}
                    >
                      {addPaymentMut.isPending ? <Spinner /> : 'Record Payment'}
                    </Button>
                  </div>
                </>
              )}
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
                  <div key={p.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-zinc-700">
                        {p.method === 'card'
                          ? `Card${p.cardBank ? ` · ${p.cardBank.toUpperCase()}` : ''}`
                          : (PAYMENT_METHOD_LABELS[p.method] ?? p.method)}
                        {p.referenceNumber && (
                          <span className="ml-1.5 font-mono font-normal text-zinc-400">#{p.referenceNumber}</span>
                        )}
                      </p>
                      {p.method === 'card' && Number(p.fee) > 0 && (
                        <p className="text-xs text-violet-500 font-mono">
                          fee {p.feePercent}% · -{formatPeso(p.fee)}
                        </p>
                      )}
                      <p className="text-xs text-zinc-400">{formatDatetime(p.paidAt)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-sm text-zinc-950">{formatPeso(p.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}


          {/* Assigned Staff — all roles can assign */}
          {assignableUsers.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-lg p-5">
              <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
                Assigned To
              </h2>
              <Select
                value={txn.staffId ?? 'unassigned'}
                onValueChange={(v) => setPendingStaffId(v)}
                disabled={txnLocked || updateTxnMut.isPending}
              >
                <SelectTrigger className="h-9 text-sm w-full border-zinc-200">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {assignableUsers.filter((u) => u.id !== currentUser?.id).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nickname || u.fullName ? toTitleCase(u.nickname ?? u.fullName ?? '') : u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* QR Code */}
          <div className="bg-white border border-zinc-200 rounded-lg p-5">
            <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
              QR Code
            </h2>
            <div className="flex flex-col items-center gap-2">
              <QRCodeSVG
                value={txn.number}
                size={140}
                level="M"
                className="rounded"
              />
              <p className="text-xs font-mono text-zinc-400">#{txn.number}</p>
            </div>
            {txn.customerPhone && (() => {
              const hasDoneItems = (txn.items ?? []).some((i) => i.status === 'done');
              return (
                <button
                  type="button"
                  onClick={handleSendPickupSms}
                  disabled={!hasDoneItems}
                  title={!hasDoneItems ? 'No items are marked as done yet' : undefined}
                  className="mt-4 flex items-center justify-center gap-2 w-full px-3 py-2 text-sm font-medium bg-zinc-200 text-zinc-800 rounded-md hover:bg-zinc-300 transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <PaperPlaneTiltIcon size={13} />
                  Send SMS — Ready for Pickup
                </button>
              );
            })()}
          </div>

          {/* SMS confirmation + sending dialog */}
          <Dialog open={smsDialogOpen} onOpenChange={(o) => { if (!smsSending) setSmsDialogOpen(o); }}>
            <DialogContent className="bg-white sm:max-w-xs">
              <div className="flex flex-col items-center gap-4 py-6 px-4 text-center">
                <div
                  style={{
                    animation: smsSending ? 'sms-plane 1.2s ease-in-out infinite' : undefined,
                  }}
                >
                  <PaperPlaneTiltIcon size={40} className="text-zinc-950" weight="fill" />
                </div>
                <style>{`
                  @keyframes sms-plane {
                    0%   { transform: translate(0, 0) rotate(-10deg); opacity: 1; }
                    50%  { transform: translate(6px, -8px) rotate(10deg); opacity: 0.7; }
                    100% { transform: translate(0, 0) rotate(-10deg); opacity: 1; }
                  }
                `}</style>
                <div>
                  <p className="text-sm font-medium text-zinc-950">
                    {smsSending ? 'Sending SMS' : 'Send SMS — Ready for Pickup'}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    {(() => {
                      const doneItems = (txn.items ?? []).filter((i) => i.status === 'done');
                      if (doneItems.length === 0) {
                        return `Notifying ${txn.customerName ?? 'customer'} that their shoes are ready for pickup.`;
                      }
                      const names = doneItems.map((i) => i.shoeDescription ?? 'Item').join(', ');
                      return `${doneItems.length} item${doneItems.length !== 1 ? 's' : ''} ready — ${names}`;
                    })()}
                  </p>
                </div>
                {!smsSending && (
                  <div className="flex gap-2 w-full">
                    <button
                      type="button"
                      disabled={smsSending}
                      onClick={() => setSmsDialogOpen(false)}
                      className="flex-1 px-3 py-2 text-sm font-medium border border-zinc-200 text-zinc-700 rounded-md hover:bg-zinc-50 transition-colors duration-150 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={smsSending}
                      onClick={confirmSendSms}
                      className="flex-1 px-3 py-2 text-sm font-medium bg-zinc-950 text-white rounded-md hover:bg-zinc-800 transition-colors duration-150 disabled:opacity-50"
                    >
                      Yes, Send
                    </button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

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
                <button
                  type="button"
                  className="flex items-center justify-center gap-2 w-full px-3 py-2 text-sm font-medium bg-zinc-200 text-zinc-800 rounded-md hover:bg-zinc-300 transition-colors duration-150"
                  onClick={() => {
                    if (emailTemplate === EMAIL_TEMPLATES.claim_stub) {
                      const link = generateGmailLinkNoBody(txn, EMAIL_TEMPLATES.claim_stub);
                      // Use openLinkReliably (anchor element) instead of window.open —
                      // works in PWA standalone mode and avoids mobile popup blockers.
                      // Open synchronously first, then attempt clipboard copy in background.
                      openLinkReliably(link);
                      (async () => {
                        try {
                          if (!stubRef.current) return;
                          const dataUrl = await toPng(stubRef.current, { pixelRatio: 2 });
                          const res = await fetch(dataUrl);
                          const blob = await res.blob();
                          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                          toast.success('Stub image copied', { description: 'Paste into the Gmail compose body' });
                        } catch {
                          // clipboard image copy not supported on this device
                        }
                      })();
                    } else {
                      // Use openLinkReliably — window.open with long body-encoded URLs
                      // is blocked or silently fails on mobile browsers and PWA standalone mode.
                      openLinkReliably(generateGmailLink(txn, emailTemplate));
                    }
                  }}
                >
                  <EnvelopeIcon size={13} />
                  Open in Gmail
                </button>
              </div>
            </div>
          )}

          {/* Off-screen stub render used for screenshot capture on claim_stub email */}
          {txn && emailTemplate === EMAIL_TEMPLATES.claim_stub && (
            <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '320px' }}>
              <ClaimStubPreview ref={stubRef} txn={txn} />
            </div>
          )}
        </div>
      </div>

      {/* Hidden file inputs — triggered programmatically */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <Lightbox
        open={!!lightbox}
        src={lightbox?.src ?? ''}
        alt={lightbox?.label}
        onClose={() => setLightbox(null)}
      />

      <ItemStatusConfirmDialog
        open={pendingItemChange !== null}
        pendingChange={pendingItemChange}
        customerName={txn.customerName ?? ''}
        loading={updateItemStatusMut.isPending}
        missingAfterPhoto={
          pendingItemChange?.newStatus === 'claimed' && (
            // Multiple items: always warn — txn-level photo may not cover this specific item
            (txn.items?.length ?? 0) > 1 ||
            // Single item: only warn if no photo at all
            (!txn.items?.find((i) => i.id === pendingItemChange.itemId)?.afterImageUrl && !hasTransactionAfterPhoto)
          )
        }
        onConfirm={() => {
          if (!pendingItemChange) return;
          setPendingItemChange(null);
          setLoadingItemIds((prev) => new Set([...prev, pendingItemChange.itemId]));
          updateItemStatusMut.mutate({ itemId: pendingItemChange.itemId, status: pendingItemChange.newStatus });
        }}
        onCancel={() => setPendingItemChange(null)}
      />

      <ConfirmDialog
        open={rescheduleConfirmOpen}
        title="Save new schedule?"
        description={txn.customerPhone
          ? `Update the pickup date to ${rescheduleValue ? formatDate(rescheduleValue) : '—'}? An SMS will be sent to ${txn.customerPhone} notifying the customer of the new date.`
          : `Update the pickup date to ${rescheduleValue ? formatDate(rescheduleValue) : '—'}?`}
        confirmLabel={txn.customerPhone ? 'Save & Send SMS' : 'Save'}
        confirmVariant="dark"
        onConfirm={() => {
          updateTxnMut.mutate(
            { newPickupDate: rescheduleValue },
            {
              onSuccess: () => { setRescheduleConfirmOpen(false); },
              onError: () => setRescheduleConfirmOpen(false),
            },
          );
        }}
        onCancel={() => { if (!updateTxnMut.isPending) setRescheduleConfirmOpen(false); }}
        loading={updateTxnMut.isPending}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete transaction?"
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={() => { deleteTxnMut.mutate(txn.id); }}
        onCancel={() => { if (!deleteTxnMut.isPending) setDeleteConfirmOpen(false); }}
        loading={deleteTxnMut.isPending}
      >
        <div className="space-y-3">
          {/* Transaction summary */}
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Transaction</span>
              <span className="font-mono font-medium text-zinc-950">#{txn.number}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Customer</span>
              <span className="text-zinc-950">{toTitleCase(txn.customerName) || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Total</span>
              <span className="font-mono text-zinc-950">{formatPeso(txn.total)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Paid</span>
              <span className={`font-mono ${parseFloat(txn.paid) > 0 ? 'text-emerald-600' : 'text-zinc-400'}`}>
                {formatPeso(txn.paid)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Status</span>
              <span className="capitalize text-zinc-700">{txn.status.replace('_', ' ')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Items</span>
              <span className="text-zinc-700">{txn.items?.length ?? 0}</span>
            </div>
          </div>

          {/* Warning */}
          <div className="rounded-md bg-red-50 border border-red-100 px-3 py-2">
            <p className="text-xs text-red-700">
              This will move the transaction to trash. It can be restored later from the Transactions page. Only Pending or Cancelled transactions can be deleted.
            </p>
          </div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={restoreConfirmOpen}
        title="Restore transaction?"
        confirmLabel="Restore"
        confirmVariant="dark"
        onConfirm={() => { restoreTxnMut.mutate(txn.id); }}
        onCancel={() => { if (!restoreTxnMut.isPending) setRestoreConfirmOpen(false); }}
        loading={restoreTxnMut.isPending}
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Transaction</span>
              <span className="font-mono font-medium text-zinc-950">#{txn.number}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Customer</span>
              <span className="text-zinc-950">{toTitleCase(txn.customerName) || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Total</span>
              <span className="font-mono text-zinc-950">{formatPeso(txn.total)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Deleted on</span>
              <span className="text-zinc-700">{formatDate(txn.deletedAt!)}</span>
            </div>
          </div>
          <div className="rounded-md bg-amber-50 border border-amber-100 px-3 py-2">
            <p className="text-xs text-amber-700">
              Restoring will make this transaction active again and include it in reports and collections.
            </p>
          </div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!pendingStaffId}
        title="Assign staff?"
        description={(() => {
          if (!pendingStaffId) return '';
          if (pendingStaffId === 'unassigned') return 'Remove the current staff assignment from this transaction?';
          const staff = assignableUsers.find((u) => u.id === pendingStaffId);
          const name = staff ? toTitleCase(staff.nickname ?? staff.fullName ?? '') || staff.email : 'this staff member';
          return `Assign ${name} to transaction #${txn.number}?`;
        })()}
        confirmLabel="Assign"
        confirmVariant="dark"
        onConfirm={() => {
          updateTxnMut.mutate(
            { staffId: pendingStaffId === 'unassigned' ? null : pendingStaffId },
            { onSuccess: () => setPendingStaffId(null), onError: () => setPendingStaffId(null) },
          );
        }}
        onCancel={() => { if (!updateTxnMut.isPending) setPendingStaffId(null); }}
        loading={updateTxnMut.isPending}
      />

      {/* Superadmin: Edit Transaction modal */}
      {isSuperadmin && (
        <Dialog
          open={editTxnOpen}
          onOpenChange={(open) => { if (!open && !editTxnMut.isPending) setEditTxnOpen(false); }}
        >
          <DialogContent className="bg-white sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base">Edit Transaction #{txn.number}</DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">Superadmin only · Changes are audited</DialogDescription>
            </DialogHeader>

            <div className="space-y-5 pt-1">
              {/* Payments — shown first */}
              {editDraftPayments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Payments</p>
                  <div className="space-y-3">
                    {editDraftPayments.map((pay) => {
                      const original = (txn.payments ?? []).find((p) => p.id === pay.id);
                      return (
                        <div key={pay.id} className="rounded-lg border border-zinc-200 p-3 space-y-2">
                          <p className="text-[11px] font-medium text-zinc-400">
                            {PAYMENT_METHOD_LABELS[original?.method ?? pay.method] ?? pay.method} · {formatPeso(original?.amount ?? '0')}
                          </p>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-zinc-700">Method</label>
                            <Select
                              value={pay.method}
                              onValueChange={(v) => setEditDraftPayments((prev) => prev.map((x) => x.id === pay.id ? { ...x, method: v, cardBank: v !== 'card' ? '' : x.cardBank } : x))}
                            >
                              <SelectTrigger className="h-9 text-sm border-zinc-200">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(['cash', 'gcash', 'card'] as const).map((m) => (
                                  <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {pay.method === 'card' && (
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-zinc-700">Card Bank</label>
                              <Select
                                value={pay.cardBank}
                                onValueChange={(v) => setEditDraftPayments((prev) => prev.map((x) => x.id === pay.id ? { ...x, cardBank: v } : x))}
                              >
                                <SelectTrigger className="h-9 text-sm border-zinc-200">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {CARD_BANK_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-zinc-700">Reference No. (optional)</label>
                            <input
                              type="text"
                              value={pay.referenceNumber}
                              onChange={(e) => setEditDraftPayments((prev) => prev.map((x) => x.id === pay.id ? { ...x, referenceNumber: e.target.value } : x))}
                              className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900"
                              placeholder="e.g. GCash ref 123456"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Items */}
              {editDraftItems.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Items</p>
                  <div className="space-y-3">
                    {editDraftItems.map((item, idx) => {
                      const hasAnyPayment = (txn.payments ?? []).length > 0;
                      return (
                        <div key={item.id} className="rounded-lg border border-zinc-200 p-3 space-y-2">
                          <p className="text-[11px] font-medium text-zinc-400">Item {idx + 1}</p>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-zinc-700">Shoe Description</label>
                            <input
                              type="text"
                              value={item.shoeDescription}
                              onChange={(e) => setEditDraftItems((prev) => prev.map((x) => x.id === item.id ? { ...x, shoeDescription: e.target.value } : x))}
                              className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900"
                              placeholder="e.g. Nike Air Max 1"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-zinc-700">Service</label>
                            {hasAnyPayment ? (
                              <div className="px-3 py-2 text-xs text-zinc-400 bg-zinc-50 border border-zinc-200 rounded-md">
                                Service locked — payment already recorded
                              </div>
                            ) : (
                              <Select
                                value={item.serviceId}
                                onValueChange={(v) => setEditDraftItems((prev) => prev.map((x) => x.id === item.id ? { ...x, serviceId: v } : x))}
                              >
                                <SelectTrigger className="h-9 text-sm border-zinc-200">
                                  <SelectValue placeholder="Select service…" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">— No change —</SelectItem>
                                  {(allServices as Service[]).map((s) => (
                                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  disabled={editTxnMut.isPending}
                  onClick={() => setEditTxnOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="dark"
                  size="sm"
                  className="flex-1"
                  disabled={editTxnMut.isPending}
                  onClick={() => {
                    const origItems = (txn.items ?? []).filter((i) => i.status !== 'cancelled');
                    const origPayments = txn.payments ?? [];
                    const itemChanged = editDraftItems.some((draft) => {
                      const orig = origItems.find((i) => i.id === draft.id);
                      if (!orig) return false;
                      const descChanged = draft.shoeDescription.trim() !== (orig.shoeDescription ?? '');
                      const svcChanged = !!draft.serviceId && draft.serviceId !== '__none__' && parseInt(draft.serviceId, 10) !== orig.service?.id;
                      return descChanged || svcChanged;
                    });
                    const paymentChanged = editDraftPayments.some((draft) => {
                      const orig = origPayments.find((p) => p.id === draft.id);
                      if (!orig) return false;
                      return draft.method !== orig.method ||
                        draft.referenceNumber.trim() !== (orig.referenceNumber ?? '') ||
                        draft.cardBank !== (orig.cardBank ?? '');
                    });
                    if (!itemChanged && !paymentChanged) {
                      toast.info('No changes to save');
                      return;
                    }
                    editTxnMut.mutate({
                      items: editDraftItems.map((i) => ({
                        id: i.id,
                        ...(i.shoeDescription.trim() && { shoeDescription: i.shoeDescription.trim() }),
                        ...(i.serviceId && i.serviceId !== '__none__' && { serviceId: parseInt(i.serviceId, 10) }),
                      })),
                      payments: editDraftPayments.map((p) => ({
                        id: p.id,
                        method: p.method,
                        ...(p.referenceNumber.trim() && { referenceNumber: p.referenceNumber.trim() }),
                        ...(p.cardBank && { cardBank: p.cardBank }),
                      })),
                    });
                  }}
                >
                  {editTxnMut.isPending ? <Spinner /> : 'Save Changes'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
