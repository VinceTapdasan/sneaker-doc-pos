'use client';

import { useMemo, useState } from 'react';
import { PlusIcon } from '@phosphor-icons/react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { createBranchesColumns } from '@/columns/branches-columns';
import {
  useBranchesQuery,
  useCreateBranchMutation,
  useDeleteBranchMutation,
} from '@/hooks/useBranchesQuery';
import { COUNTRY_DEFAULT } from '@/lib/ph-geo';
import type { Branch } from '@/lib/types';

interface NewForm {
  name: string;
  streetName: string;
  barangay: string;
  city: string;
  province: string;
  phone: string;
}

const EMPTY_FORM: NewForm = { name: '', streetName: '', barangay: '', city: '', province: '', phone: '' };

const INPUT_CLS = 'px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

export default function BranchesPage() {
  const [showForm, setShowForm] = useState(false);
  const [newForm, setNewForm] = useState<NewForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);

  const { data: branches = [], isLoading } = useBranchesQuery(false);

  const createMut = useCreateBranchMutation(() => {
    setShowForm(false);
    setNewForm(EMPTY_FORM);
  });

  const deleteMut = useDeleteBranchMutation(() => setDeleteTarget(null));

  function set(field: keyof NewForm, value: string) {
    setNewForm((f) => ({ ...f, [field]: value }));
  }

  function handleCreate() {
    const name = newForm.name.trim();
    if (!name) return;
    createMut.mutate({
      name,
      streetName: newForm.streetName.trim() || undefined,
      barangay: newForm.barangay.trim() || undefined,
      city: newForm.city.trim() || undefined,
      province: newForm.province.trim() || undefined,
      country: COUNTRY_DEFAULT,
      phone: newForm.phone.trim() || undefined,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') { setShowForm(false); setNewForm(EMPTY_FORM); }
  }

  const columns = useMemo(
    () => createBranchesColumns({ onDelete: setDeleteTarget }),
    [],
  );

  return (
    <>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove branch?"
        description={`Remove "${deleteTarget?.name}"? It will be hidden from the system. Branches with pending or in-progress transactions cannot be removed.`}
        confirmLabel="Remove"
        onConfirm={() => { if (deleteTarget) deleteMut.mutate(deleteTarget.id); }}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMut.isPending}
      />
      <div>
        <PageHeader
          title="Branches"
          subtitle={`${branches.length} branch${branches.length !== 1 ? 'es' : ''}`}
          action={
            !showForm ? (
              <Button onClick={() => setShowForm(true)}>
                <PlusIcon size={14} weight="bold" />
                New Branch
              </Button>
            ) : null
          }
        />

        {showForm && (
          <div className="bg-white border border-zinc-200 rounded-lg p-4 mb-5 space-y-3">
            {/* Row 1: Name + Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                autoFocus
                type="text"
                value={newForm.name}
                onChange={(e) => set('name', e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Branch name *"
                className={INPUT_CLS}
              />
              <input
                type="text"
                value={newForm.phone}
                onChange={(e) => set('phone', e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Phone (optional)"
                className={`${INPUT_CLS} font-mono`}
              />
            </div>

            {/* Row 2: Street Name / Purok (full width) */}
            <input
              type="text"
              value={newForm.streetName}
              onChange={(e) => set('streetName', e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Street Name / Purok (optional)"
              className={`w-full ${INPUT_CLS}`}
            />

            {/* Row 3: Barangay | City | Province */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={newForm.barangay}
                onChange={(e) => set('barangay', e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Barangay"
                className={INPUT_CLS}
              />
              <input
                type="text"
                value={newForm.city}
                onChange={(e) => set('city', e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="City / Municipality"
                className={INPUT_CLS}
              />
              <input
                type="text"
                value={newForm.province}
                onChange={(e) => set('province', e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Province"
                className={INPUT_CLS}
              />
            </div>

            {/* Row 4: Country (static) + actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 border border-zinc-100 rounded-md bg-zinc-50">
                <span className="text-zinc-300 text-xs uppercase tracking-wider">Country</span>
                <span>{COUNTRY_DEFAULT}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="dark"
                  disabled={!newForm.name.trim() || createMut.isPending}
                  onClick={handleCreate}
                >
                  {createMut.isPending ? 'Saving...' : 'Save Branch'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setShowForm(false); setNewForm(EMPTY_FORM); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-zinc-200 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : branches.length === 0 ? (
          <EmptyState title="No branches yet" description="Create the first branch to get started." />
        ) : (
          <DataTable columns={columns} data={branches} />
        )}
      </div>
    </>
  );
}
