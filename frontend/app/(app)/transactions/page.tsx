'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MagnifyingGlassIcon, PlusIcon, XIcon } from '@phosphor-icons/react';
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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  const params: Record<string, string> = { limit: '200' };
  if (statusFilter !== 'all') params.status = statusFilter;
  if (search) params.search = search;
  if (dateFrom) params.from = dateFrom;
  if (dateTo) params.to = dateTo;

  const { data: transactions = [], isLoading } = useTransactionsQuery(params);
  const deleteMut = useDeleteTransactionMutation();

  const statusCounts = useMemo(() =>
    transactions.reduce(
      (acc, t) => { acc[t.status] = (acc[t.status] ?? 0) + 1; return acc; },
      {} as Record<string, number>,
    ),
    [transactions],
  );

  const columns = useMemo(
    () => createTransactionColumns({ onDelete: setDeleteTarget }),
    [],
  );

  const hasDateFilter = dateFrom || dateTo;

  function clearDateFilter() {
    setDateFrom('');
    setDateTo('');
  }

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle={`${transactions.length} results`}
        action={
          <Link href="/transactions/new">
            <Button>
              <PlusIcon size={14} weight="bold" />
              New Transaction
            </Button>
          </Link>
        }
      />

      {/* Status tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {['all', 'pending', 'in_progress', 'done', 'claimed', 'cancelled'].map((s) => (
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
      </div>

      {/* Search + Date filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="relative">
          <MagnifyingGlassIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search #number, name, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm bg-white border border-zinc-200 rounded-md text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-56 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-400">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-2 py-1.5 text-sm bg-white border border-zinc-200 rounded-md text-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          />
          <span className="text-xs text-zinc-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-2 py-1.5 text-sm bg-white border border-zinc-200 rounded-md text-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          />
          {hasDateFilter && (
            <button
              onClick={clearDateFilter}
              className="p-1 text-zinc-400 hover:text-zinc-700 transition-colors"
              title="Clear date filter"
            >
              <XIcon size={14} />
            </button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={transactions}
        isLoading={isLoading}
        loadingRows={8}
        emptyTitle="No transactions"
        emptyDescription={
          search || statusFilter !== 'all' || hasDateFilter
            ? 'Try adjusting your filters.'
            : 'Create the first transaction to get started.'
        }
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
