'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCurrentUserQuery } from '@/hooks/useCurrentUserQuery';
import { PlusIcon } from '@phosphor-icons/react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Spinner } from '@/components/ui/spinner';
import { createPromoColumns } from '@/columns/promos-columns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  usePromosQuery,
  useCreatePromoMutation,
  useUpdatePromoMutation,
  useDeletePromoMutation,
} from '@/hooks/usePromosQuery';
import type { Promo } from '@/lib/types';

interface PromoForm {
  name: string;
  code: string;
  percent: string;
  dateFrom: string;
  dateTo: string;
  maxUses: string; // '' = unlimited
}

const EMPTY_FORM: PromoForm = { name: '', code: '', percent: '', dateFrom: '', dateTo: '', maxUses: '' };

const INPUT_CLS = 'w-full px-3 py-2 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

export default function PromosPage() {
  const searchParams = useSearchParams();
  const { data: currentUser } = useCurrentUserQuery();
  const isSuperadmin = currentUser?.userType === 'superadmin';
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Promo | null>(null);
  const [form, setForm] = useState<PromoForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Promo | null>(null);
  const origFormRef = useRef<PromoForm | null>(null);

  const { data: promos = [], isLoading } = usePromosQuery();

  const closeDialog = () => setDialogOpen(false);
  const createMut = useCreatePromoMutation(closeDialog);
  const updateMut = useUpdatePromoMutation(closeDialog);
  const deleteMut = useDeletePromoMutation();
  const isBusy = createMut.isPending || updateMut.isPending;
  const isUnchanged = editTarget !== null && origFormRef.current !== null
    && JSON.stringify(form) === JSON.stringify(origFormRef.current);

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

  const openEdit = (p: Promo) => {
    setEditTarget(p);
    const snap: PromoForm = {
      name: p.name,
      code: p.code,
      percent: p.percent,
      dateFrom: p.dateFrom ?? '',
      dateTo: p.dateTo ?? '',
      maxUses: p.maxUses != null ? String(p.maxUses) : '',
    };
    origFormRef.current = snap;
    setForm(snap);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.code.trim() || !form.percent) return;
    const maxUses = form.maxUses.trim() ? parseInt(form.maxUses, 10) : null;
    if (editTarget) {
      updateMut.mutate({
        id: editTarget.id,
        name: form.name,
        code: form.code,
        percent: form.percent,
        dateFrom: form.dateFrom || undefined,
        dateTo: form.dateTo || undefined,
        maxUses,
      });
    } else {
      createMut.mutate({
        name: form.name,
        code: form.code,
        percent: form.percent,
        dateFrom: form.dateFrom || undefined,
        dateTo: form.dateTo || undefined,
        maxUses: maxUses ?? undefined,
      });
    }
  };

  const columns = useMemo(
    () => createPromoColumns({
      onDelete: setDeleteTarget,
      onToggle: (id, isActive) => updateMut.mutate({ id, isActive }),
      onStartEdit: openEdit,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div>
      <PageHeader
        title="Promos"
        subtitle="Promotional codes and discounts"
        action={
          <Button onClick={openCreate}>
            <PlusIcon size={14} weight="bold" />
            Add Promo
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={promos as Promo[]}
        isLoading={isLoading}
        loadingRows={3}
        emptyTitle="No promos yet"
        emptyDescription="Create your first promo code."
      />

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open && !isBusy) closeDialog(); }}>
        <DialogContent className="bg-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{editTarget ? 'Edit Promo' : 'New Promo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-700">Promo Name</label>
              <input
                autoFocus
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={INPUT_CLS}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-700">Code</label>
              <input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                className={`${INPUT_CLS} font-mono uppercase`}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-700">Discount %</label>
              <input
                type="number"
                min="1"
                max="100"
                step="0.5"
                value={form.percent}
                onChange={(e) => setForm((f) => ({ ...f, percent: e.target.value }))}
                className={`${INPUT_CLS} font-mono`}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-700">Valid From</label>
                <input
                  type="date"
                  value={form.dateFrom}
                  onChange={(e) => setForm((f) => ({ ...f, dateFrom: e.target.value }))}
                  className={INPUT_CLS}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-700">Valid Until</label>
                <input
                  type="date"
                  value={form.dateTo}
                  onChange={(e) => setForm((f) => ({ ...f, dateTo: e.target.value }))}
                  className={INPUT_CLS}
                />
              </div>
            </div>
            {isSuperadmin && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-700">
                  Max Uses <span className="font-normal text-zinc-400">(leave blank for unlimited)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.maxUses}
                  onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
                  className={`${INPUT_CLS} font-mono`}
                  placeholder="e.g. 50"
                />
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1"
                disabled={isBusy || !form.name.trim() || !form.code.trim() || !form.percent || isUnchanged}
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
        title="Remove promo?"
        description={`Remove promo "${deleteTarget?.code}"? This cannot be undone.`}
        confirmLabel="Remove"
        onConfirm={() => { if (deleteTarget) deleteMut.mutate(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMut.isPending}
      />
    </div>
  );
}
