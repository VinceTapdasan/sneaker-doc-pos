'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { PlusIcon } from '@phosphor-icons/react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Spinner } from '@/components/ui/spinner';
import { createServicesColumns } from '@/columns/services-columns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useServicesQuery,
  useCreateServiceMutation,
  useUpdateServiceMutation,
  useDeleteServiceMutation,
} from '@/hooks/useServicesQuery';
import type { Service } from '@/lib/types';

interface ServiceForm {
  name: string;
  type: 'primary' | 'add_on';
  price: string;
}

const EMPTY_FORM: ServiceForm = { name: '', type: 'primary', price: '' };

const INPUT_CLS = 'w-full px-3 py-2 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

export default function ServicesPage() {
  const searchParams = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Service | null>(null);
  const [form, setForm] = useState<ServiceForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const origFormRef = useRef<ServiceForm | null>(null);

  const { data: services = [], isLoading } = useServicesQuery();

  const closeDialog = () => setDialogOpen(false);
  const createMut = useCreateServiceMutation(closeDialog);
  const updateMut = useUpdateServiceMutation(closeDialog);
  const deleteMut = useDeleteServiceMutation();
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

  const openEdit = (s: Service) => {
    setEditTarget(s);
    const snap: ServiceForm = { name: s.name, type: s.type, price: s.price };
    origFormRef.current = snap;
    setForm(snap);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.price) return;
    if (editTarget) {
      updateMut.mutate({ id: editTarget.id, form });
    } else {
      createMut.mutate(form);
    }
  };

  const primaryServices = (services as Service[]).filter((s) => s.type === 'primary');
  const addonServices = (services as Service[]).filter((s) => s.type === 'add_on');

  const columns = useMemo(
    () => createServicesColumns({ onStartEdit: openEdit, onDelete: setDeleteTarget }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const renderSection = (title: string, list: Service[]) => (
    <div className="mb-5">
      <div className="px-0 py-2 mb-1">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{title}</h2>
      </div>
      {list.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-lg">
          <p className="px-5 py-5 text-sm text-zinc-400">None yet.</p>
        </div>
      ) : (
        <DataTable columns={columns} data={list} />
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Services"
        subtitle="Manage the service catalog"
        action={
          <Button onClick={openCreate}>
            <PlusIcon size={14} weight="bold" />
            Add Service
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-zinc-200 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <EmptyState title="No services yet" description="Add your first service to the catalog." />
      ) : (
        <>
          {renderSection('Primary Services', primaryServices)}
          {renderSection('Add-ons', addonServices)}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open && !isBusy) closeDialog(); }}>
        <DialogContent className="bg-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{editTarget ? 'Edit Service' : 'New Service'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-700">Service Name</label>
              <input
                autoFocus
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                className={INPUT_CLS}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-700">Type</label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as 'primary' | 'add_on' }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="add_on">Add-on</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-700">Price (₱)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className={`${INPUT_CLS} font-mono`}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1"
                disabled={isBusy || !form.name.trim() || !form.price || isUnchanged}
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
        title="Remove service?"
        description={`"${deleteTarget?.name}" will be removed from the service catalog.`}
        confirmLabel="Remove"
        onConfirm={() => { if (deleteTarget) deleteMut.mutate(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMut.isPending}
      />
    </div>
  );
}
