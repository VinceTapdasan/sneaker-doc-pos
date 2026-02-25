'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { PlusIcon } from '@phosphor-icons/react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PromoForm } from '@/components/forms/promo-form';
import { createPromoColumns } from '@/columns/promos-columns';
import { usePromosQuery, useDeletePromoMutation } from '@/hooks/usePromosQuery';
import type { Promo } from '@/lib/types';

export default function PromosPage() {
  const searchParams = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Promo | null>(null);

  useEffect(() => {
    if (searchParams.get('new') === '1') setShowForm(true);
  }, [searchParams]);

  const { data: promos = [], isLoading } = usePromosQuery();
  const deleteMut = useDeletePromoMutation();

  const columns = useMemo(
    () => createPromoColumns({ onDelete: setDeleteTarget }),
    [],
  );

  return (
    <div>
      <PageHeader
        title="Promos"
        subtitle="Promotional codes and discounts"
        action={
          <Button onClick={() => setShowForm((v) => !v)}>
            <PlusIcon size={14} weight="bold" />
            Add Promo
          </Button>
        }
      />

      {showForm && (
        <PromoForm
          onSuccess={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}

      <DataTable
        columns={columns}
        data={promos as Promo[]}
        isLoading={isLoading}
        loadingRows={3}
        emptyTitle="No promos yet"
        emptyDescription="Create your first promo code."
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Deactivate promo?"
        description={`Deactivate promo "${deleteTarget?.code}"? This cannot be undone.`}
        confirmLabel="Deactivate"
        onConfirm={() => { if (deleteTarget) deleteMut.mutate(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMut.isPending}
      />
    </div>
  );
}
