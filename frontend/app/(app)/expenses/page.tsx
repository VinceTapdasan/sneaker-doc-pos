'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { ReceiptIcon, CameraIcon, XCircleIcon } from '@phosphor-icons/react';
import { formatPeso, today, cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Spinner } from '@/components/ui/spinner';
import { createExpenseColumns, type ExpenseEditForm } from '@/columns/expenses-columns';
import {
  useExpensesQuery,
  useExpensesSummaryQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
} from '@/hooks/useExpensesQuery';
import { useCurrentUserQuery } from '@/hooks/useCurrentUserQuery';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { putToStorage } from '@/hooks/useUploadPhoto';
import { isValidImageType, RAW_MAX_SIZE_MB, compressWithFallback } from '@/utils/photo';
import { toast } from 'sonner';
import type { Expense } from '@/lib/types';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_deposit', label: 'Bank Deposit' },
] as const;

interface ExpenseForm {
  category: string;
  note: string;
  method: string;
  amount: string;
  photoUrl: string;
}

const EMPTY_FORM: ExpenseForm = { category: '', note: '', method: '', amount: '', photoUrl: '' };

const INPUT_CLS = 'w-full px-3 py-2 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

export default function ExpensesPage() {
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(today());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const { data: currentUser } = useCurrentUserQuery();
  const isAdmin = currentUser?.userType === 'admin' || currentUser?.userType === 'superadmin';

  const { data: expenses = [], isLoading } = useExpensesQuery(selectedDate);
  const { data: summary } = useExpensesSummaryQuery(selectedDate);

  const closeDialog = () => setDialogOpen(false);
  const createMut = useCreateExpenseMutation(selectedDate, closeDialog);
  const updateMut = useUpdateExpenseMutation(selectedDate, closeDialog);
  const deleteMut = useDeleteExpenseMutation(selectedDate);
  const isBusy = createMut.isPending || updateMut.isPending || photoUploading;

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!e.target) return;
    // Reset input so the same file can be reselected
    (e.target as HTMLInputElement).value = '';
    if (!file) return;
    if (!isValidImageType(file)) { toast.error('Only image files allowed (JPEG, PNG, WebP, HEIC)'); return; }
    if (file.size > RAW_MAX_SIZE_MB * 1024 * 1024) { toast.error(`File must be under ${RAW_MAX_SIZE_MB}MB`); return; }
    setPhotoUploading(true);
    try {
      const { blob } = await compressWithFallback(file);
      const { signedUrl, publicUrl } = await api.expenses.uploadUrl('jpg');
      await putToStorage(signedUrl, blob);
      setForm((f) => ({ ...f, photoUrl: publicUrl }));
    } catch (err) {
      toast.error('Photo upload failed', { description: (err as Error).message });
    } finally {
      setPhotoUploading(false);
    }
  };

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditTarget(null);
      setForm(EMPTY_FORM);
      setDialogOpen(true);
    }
  }, [searchParams]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (e: Expense) => {
    setEditTarget(e);
    setForm({
      category: e.category ?? '',
      note: e.note ?? '',
      method: e.method ?? '',
      amount: e.amount ?? '',
      photoUrl: e.photoUrl ?? '',
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.amount) return;
    if (editTarget) {
      updateMut.mutate({
        id: editTarget.id,
        category: form.category || undefined,
        note: form.note || undefined,
        method: form.method || undefined,
        amount: form.amount || undefined,
        photoUrl: form.photoUrl || null,
      });
    } else {
      createMut.mutate({
        category: form.category || undefined,
        note: form.note || undefined,
        method: form.method || undefined,
        amount: form.amount,
        photoUrl: form.photoUrl || undefined,
      });
    }
  };

  const columns = useMemo(
    () => createExpenseColumns({
      onDelete: setDeleteTarget,
      onStartEdit: isAdmin ? openEdit : undefined,
      isAdmin,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin],
  );

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Daily operational expenses"
        action={(
          <Button onClick={openCreate}>
            <ReceiptIcon size={14} weight="bold" />
            Add Expense
          </Button>
        )}
      />

      <div className="flex items-center gap-4 mb-6">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
        {summary && (
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-zinc-400">Daily total:</span>
            <span className="font-mono font-semibold text-zinc-950">{formatPeso(summary.total)}</span>
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        data={expenses as Expense[]}
        isLoading={isLoading}
        loadingRows={3}
        emptyTitle="No expenses"
        emptyDescription="No expenses recorded for this date."
      />

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open && !isBusy) closeDialog(); }}>
        <DialogContent className="bg-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{editTarget ? 'Edit Expense' : 'New Expense'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <p className="text-xs font-medium text-zinc-700 mb-2">Payment Method</p>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_METHODS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, method: f.method === value ? '' : value }))}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium border transition-colors duration-150',
                      form.method === value
                        ? 'bg-zinc-950 text-white border-zinc-950'
                        : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400 hover:text-zinc-700',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-700">Category</label>
              <input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Supplies, Utilities"
                className={INPUT_CLS}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-700">Note</label>
              <input
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Brief description"
                className={INPUT_CLS}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-700">Amount (₱)</label>
              <input
                autoFocus={!editTarget}
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                className={`${INPUT_CLS} font-mono`}
              />
            </div>

            {/* Receipt photo */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-700">Receipt Photo <span className="text-zinc-400 font-normal">(optional)</span></label>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelect}
              />
              {form.photoUrl ? (
                <div className="relative w-full h-28 rounded-md overflow-hidden border border-zinc-200 bg-zinc-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.photoUrl} alt="Receipt" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, photoUrl: '' }))}
                    className="absolute top-1 right-1 bg-white rounded-full shadow p-0.5 text-zinc-500 hover:text-red-500 transition-colors"
                  >
                    <XCircleIcon size={18} weight="fill" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={photoUploading}
                  onClick={() => photoInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-500 border border-dashed border-zinc-300 rounded-md hover:border-zinc-400 hover:text-zinc-700 transition-colors disabled:opacity-50"
                >
                  {photoUploading ? <Spinner /> : <CameraIcon size={15} />}
                  {photoUploading ? 'Uploading…' : 'Attach receipt'}
                </button>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1"
                disabled={isBusy || !form.amount}
                onClick={handleSave}
              >
                {isBusy ? <Spinner /> : 'Save'}
              </Button>
              <Button size="sm" variant="ghost" disabled={isBusy} onClick={closeDialog}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove expense?"
        description="Remove this expense? This cannot be undone."
        onConfirm={() => { if (deleteTarget) deleteMut.mutate(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMut.isPending}
      />
    </div>
  );
}
