'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { PlusIcon } from '@phosphor-icons/react';
import { formatPeso, today } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ExpenseForm } from '@/components/forms/expense-form';
import { createExpenseColumns } from '@/columns/expenses-columns';
import {
  useExpensesQuery,
  useExpensesSummaryQuery,
  useDeleteExpenseMutation,
} from '@/hooks/useExpensesQuery';
import type { Expense } from '@/lib/types';

export default function ExpensesPage() {
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(today());
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  useEffect(() => {
    if (searchParams.get('new') === '1') setShowForm(true);
  }, [searchParams]);

  const { data: expenses = [], isLoading } = useExpensesQuery(selectedDate);
  const { data: summary } = useExpensesSummaryQuery(selectedDate);
  const deleteMut = useDeleteExpenseMutation(selectedDate);

  const columns = useMemo(
    () => createExpenseColumns({ onDelete: setDeleteTarget }),
    [],
  );

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Daily operational expenses"
        action={
          <Button onClick={() => setShowForm((v) => !v)}>
            <PlusIcon size={14} weight="bold" />
            Add Expense
          </Button>
        }
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

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete expense?"
        description="Delete this expense? This cannot be undone."
        onConfirm={() => { if (deleteTarget) deleteMut.mutate(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMut.isPending}
      />
    </div>
  );
}
