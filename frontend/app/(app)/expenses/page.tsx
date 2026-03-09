'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ReceiptIcon } from '@phosphor-icons/react';
import { formatPeso, today, cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Spinner } from '@/components/ui/spinner';
import { ExpenseForm } from '@/components/forms/expense-form';
import { createExpenseColumns, type ExpenseEditForm } from '@/columns/expenses-columns';
import {
  useExpensesQuery,
  useExpensesSummaryQuery,
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
import type { Expense } from '@/lib/types';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_deposit', label: 'Bank Deposit' },
] as const;

const EMPTY_EDIT: ExpenseEditForm = { category: '', note: '', method: '', amount: '' };

export default function ExpensesPage() {
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(today());
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [editTarget, setEditTarget] = useState<Expense | null>(null);
  const [editForm, setEditForm] = useState<ExpenseEditForm>(EMPTY_EDIT);

  useEffect(() => {
    if (searchParams.get('new') === '1') setShowForm(true);
  }, [searchParams]);

  const { data: currentUser } = useCurrentUserQuery();
  const isAdmin = currentUser?.userType === 'admin' || currentUser?.userType === 'superadmin';

  const { data: expenses = [], isLoading } = useExpensesQuery(selectedDate);
  const { data: summary } = useExpensesSummaryQuery(selectedDate);
  const updateMut = useUpdateExpenseMutation(selectedDate, () => setEditTarget(null));
  const deleteMut = useDeleteExpenseMutation(selectedDate);

  const startEdit = (e: Expense) => {
    setEditTarget(e);
    setEditForm({
      category: e.category ?? '',
      note: e.note ?? '',
      method: e.method ?? '',
      amount: e.amount ?? '',
    });
    setShowForm(false);
  };

  const columns = useMemo(
    () => createExpenseColumns({
      onDelete: setDeleteTarget,
      onStartEdit: isAdmin ? startEdit : undefined,
      isAdmin,
    }),
    [isAdmin],
  );

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Daily operational expenses"
        action={(
          <Button onClick={() => setShowForm((v) => !v)}>
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

      {showForm && (
        <ExpenseForm
          dateKey={selectedDate}
          onSuccess={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}

      <DataTable
        columns={columns}
        data={expenses as Expense[]}
        isLoading={isLoading}
        loadingRows={3}
        emptyTitle="No expenses"
        emptyDescription="No expenses recorded for this date."
      />

      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="bg-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Edit Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <p className="text-xs font-medium text-zinc-700 mb-2">Payment Method</p>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_METHODS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setEditForm((f) => ({ ...f, method: f.method === value ? '' : value }))}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium border transition-colors duration-150',
                      editForm.method === value
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
                value={editForm.category}
                onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Supplies, Utilities"
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-700">Note</label>
              <input
                value={editForm.note}
                onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Brief description"
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-700">Amount (₱)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editForm.amount}
                onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2 text-sm font-mono border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1"
                disabled={updateMut.isPending || !editForm.amount}
                onClick={() => {
                  if (!editTarget) return;
                  updateMut.mutate({
                    id: editTarget.id,
                    category: editForm.category || undefined,
                    note: editForm.note || undefined,
                    method: editForm.method || undefined,
                    amount: editForm.amount || undefined,
                  });
                }}
              >
                {updateMut.isPending ? <Spinner /> : 'Save'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditTarget(null)}>Cancel</Button>
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
