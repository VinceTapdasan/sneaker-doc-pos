'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MagnifyingGlassIcon, PlusIcon } from '@phosphor-icons/react';
import { STATUS_LABELS, cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { createTransactionColumns } from '@/columns/transactions-columns';
import { useTransactionsQuery, useDeleteTransactionMutation } from '@/hooks/useTransactionsQuery';
import type { Transaction } from '@/lib/types';

export default function TransactionsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  const { data: transactions = [], isLoading } = useTransactionsQuery({ limit: '200' });
  const deleteMut = useDeleteTransactionMutation();

  const filtered = transactions.filter((t) => {
    const matchesSearch =
      !search ||
      t.number.includes(search) ||
      t.customerName?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = transactions.reduce(
    (acc, t) => { acc[t.status] = (acc[t.status] ?? 0) + 1; return acc; },
    {} as Record<string, number>,
  );

  const columns = useMemo(
    () => createTransactionColumns({ onDelete: setDeleteTarget }),
    [],
  );

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle={`${transactions.length} total`}
        action={
          <Link href="/transactions/new">
            <Button>
              <PlusIcon size={14} weight="bold" />
              New Transaction
            </Button>
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {['all', 'pending', 'in_progress', 'done', 'claimed'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150',
              statusFilter === s ? 'bg-zinc-950 text-white' : 'text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100',
            )}
          >
            {s === 'all' ? 'All' : STATUS_LABELS[s]}
            {s !== 'all' && statusCounts[s] ? <span className="ml-1.5 opacity-60">{statusCounts[s]}</span> : null}
          </button>
        ))}
        <div className="ml-auto relative">
          <MagnifyingGlassIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search #number or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm bg-white border border-zinc-200 rounded-md text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-56 transition-colors"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        loadingRows={8}
        emptyTitle="No transactions"
        emptyDescription={search || statusFilter !== 'all' ? 'Try adjusting your filters.' : 'Create the first transaction to get started.'}
        onRowClick={(txn) => router.push(`/transactions/${txn.id}`)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete transaction?"
        description={`Delete #${deleteTarget?.number}? This cannot be undone.`}
        onConfirm={() => { if (deleteTarget) deleteMut.mutate(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMut.isPending}
      />
    </div>
  );
}
