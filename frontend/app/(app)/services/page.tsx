'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { PlusIcon } from '@phosphor-icons/react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ServiceForm } from '@/components/forms/service-form';
import { createServicesColumns } from '@/columns/services-columns';
import {
  useServicesQuery,
  useUpdateServiceMutation,
  useToggleServiceMutation,
  useDeleteServiceMutation,
} from '@/hooks/useServicesQuery';
import type { Service } from '@/lib/types';

interface EditForm {
  name: string;
  type: 'primary' | 'add_on';
  price: string;
}

const EMPTY_EDIT: EditForm = { name: '', type: 'primary', price: '' };

export default function ServicesPage() {
  const searchParams = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<EditForm>(EMPTY_EDIT);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);

  useEffect(() => {
    if (searchParams.get('new') === '1') setShowForm(true);
  }, [searchParams]);

  const { data: services = [], isLoading } = useServicesQuery();

  const updateMut = useUpdateServiceMutation(() => {
    setEditId(null);
    setForm(EMPTY_EDIT);
  });
  const deleteMut = useDeleteServiceMutation();
  const toggleActive = useToggleServiceMutation();

  const startEdit = (s: Service) => {
    setEditId(s.id);
    setForm({ name: s.name, type: s.type, price: s.price });
    setShowForm(false);
  };

  const cancelEdit = () => {
    setEditId(null);
    setForm(EMPTY_EDIT);
  };

  const primaryServices = (services as Service[]).filter((s) => s.type === 'primary');
  const addonServices = (services as Service[]).filter((s) => s.type === 'add_on');

  const columns = useMemo(
    () => createServicesColumns({
      editId,
      form,
      setForm,
      onUpdate: () => updateMut.mutate({ id: editId!, form }),
      onCancelEdit: cancelEdit,
      onStartEdit: startEdit,
      onToggle: (id, isActive) => toggleActive.mutate({ id, isActive }),
      onDelete: setDeleteTarget,
    }),
    [editId, form],
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
          <Button onClick={() => { setShowForm((v) => !v); cancelEdit(); }}>
            <PlusIcon size={14} weight="bold" />
            Add Service
          </Button>
        }
      />

      {showForm && (
        <ServiceForm
          onSuccess={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-zinc-100 rounded-lg animate-pulse" />
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

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete service?"
        description={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        onConfirm={() => { if (deleteTarget) deleteMut.mutate(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMut.isPending}
      />
    </div>
  );
}
