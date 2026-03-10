'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MagnifyingGlassIcon, PlusIcon, XIcon, ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import { STATUS_LABELS, formatDate, cn } from '@/lib/utils';
import { toTitleCase } from '@/utils/text';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createTransactionColumns } from '@/columns/transactions-columns';
import {
  useInfiniteTransactionsQuery,
  useDeleteTransactionMutation,
  useDeletedTransactionsQuery,
  useRestoreTransactionMutation,
} from '@/hooks/useTransactionsQuery';
import { useCurrentUserQuery } from '@/hooks/useCurrentUserQuery';
import { useBranchesQuery } from '@/hooks/useBranchesQuery';
import type { Transaction, Branch } from '@/lib/types';

export default function TransactionsPage() {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<Transaction | null>(null);

  // Draft state — what the user is typing/selecting
  const [draftSearch, setDraftSearch] = useState('');
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');

  // Committed state — what's actually sent to the API
  const [committedSearch, setCommittedSearch] = useState('');
  const [committedFrom, setCommittedFrom] = useState('');
  const [committedTo, setCommittedTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');

  const isDirty =
    draftSearch !== committedSearch ||
    draftFrom !== committedFrom ||
    draftTo !== committedTo;

  function commit() {
    setCommittedSearch(draftSearch);
    setCommittedFrom(draftFrom);
    setCommittedTo(draftTo);
  }

  function clearDates() {
    setDraftFrom('');
    setDraftTo('');
  }

  function clearAll() {
    setDraftSearch('');
    setDraftFrom('');
    setDraftTo('');
    setCommittedSearch('');
    setCommittedFrom('');
    setCommittedTo('');
    setStatusFilter('all');
    setBranchFilter('all');
  }

  const params: Record<string, string> = {};
  if (statusFilter !== 'all') params.status = statusFilter;
  if (committedSearch) params.search = committedSearch;
  if (committedFrom) params.from = committedFrom;
  if (committedTo) params.to = committedTo;
  if (branchFilter !== 'all') params.branchId = branchFilter;

  const { data: currentUser } = useCurrentUserQuery();
  const isAdmin = currentUser?.userType === 'admin' || currentUser?.userType === 'superadmin';
  const isSuperadmin = currentUser?.userType === 'superadmin';

  const { data: branches = [] } = useBranchesQuery(false);
  const branchesMap = useMemo(
    () => Object.fromEntries((branches as Branch[]).map((b) => [b.id, b.name])),
    [branches],
  );

  const query = useInfiniteTransactionsQuery(params);
  const transactions = useMemo(() => query.data?.pages.flat() ?? [], [query.data]);
  const deleteMut = useDeleteTransactionMutation();
  const { data: deletedTxns = [], isLoading: deletedLoading } = useDeletedTransactionsQuery();
  const restoreMut = useRestoreTransactionMutation(() => setRestoreTarget(null));

  const statusCounts = useMemo(() =>
    transactions.reduce(
      (acc, t) => { acc[t.status] = (acc[t.status] ?? 0) + 1; return acc; },
      {} as Record<string, number>,
    ),
    [transactions],
  );

  const columns = useMemo(
    () => createTransactionColumns({ onDelete: setDeleteTarget, isSuperadmin, branchesMap }),
    [isSuperadmin, branchesMap],
  );

  const hasActiveFilter = committedSearch || committedFrom || committedTo || statusFilter !== 'all' || branchFilter !== 'all';

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle={`${transactions.length} loaded`}
        action={(
          <Link href="/transactions/new">
            <Button>
              <PlusIcon size={14} weight="bold" />
              New Transaction
            </Button>
          </Link>
        )}
      />

      {/* Status tabs — commit immediately on click */}
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
        {isAdmin && (
          <button
            onClick={() => setStatusFilter('trash')}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150',
              statusFilter === 'trash' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100',
            )}
          >
            Trash
            {(deletedTxns as Transaction[]).length > 0 && (
              <span className="ml-1.5 opacity-70">{(deletedTxns as Transaction[]).length}</span>
            )}
          </button>
        )}
      </div>

      {/* Search + Date filters — explicit submit */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {isSuperadmin && (branches as Branch[]).length > 0 && (
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="h-8 text-sm w-40 border-zinc-200">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {(branches as Branch[]).map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>{toTitleCase(b.name)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="relative">
          <MagnifyingGlassIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search #number, name, phone..."
            value={draftSearch}
            onChange={(e) => setDraftSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
            className="pl-8 pr-3 py-1.5 text-sm bg-white border border-zinc-200 rounded-md text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-56 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-400">From</span>
          <input
            type="date"
            value={draftFrom}
            onChange={(e) => setDraftFrom(e.target.value)}
            className="px-2 py-1.5 text-sm bg-white border border-zinc-200 rounded-md text-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          />
          <span className="text-xs text-zinc-400">to</span>
          <input
            type="date"
            value={draftTo}
            onChange={(e) => setDraftTo(e.target.value)}
            className="px-2 py-1.5 text-sm bg-white border border-zinc-200 rounded-md text-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          />
          {(draftFrom || draftTo) && (
            <button
              onClick={clearDates}
              className="p-1 text-zinc-400 hover:text-zinc-700 transition-colors"
              title="Clear dates"
            >
              <XIcon size={14} />
            </button>
          )}
        </div>

        <button
          onClick={commit}
          disabled={!isDirty}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-zinc-950 text-white rounded-md hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <MagnifyingGlassIcon size={13} weight="bold" />
          Search
        </button>

        {hasActiveFilter && (
          <button
            onClick={clearAll}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {statusFilter === 'trash' ? (
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          {deletedLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : (deletedTxns as Transaction[]).length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-12">Trash is empty.</p>
          ) : (
            <div className="divide-y divide-zinc-100">
              {(deletedTxns as Transaction[]).map((txn) => (
                <div key={txn.id} className="flex items-center gap-3 px-4 py-3">
                  <Link href={`/transactions/${txn.id}`} className="flex-1 min-w-0 hover:opacity-70 transition-opacity duration-150">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs text-zinc-400">#{txn.number}</span>
                      <span className="text-xs text-zinc-400">deleted {formatDate(txn.deletedAt)}</span>
                    </div>
                    <p className="text-sm font-medium text-zinc-950 truncate">
                      {toTitleCase(txn.customerName) || '—'}
                    </p>
                  </Link>
                  <button
                    onClick={() => setRestoreTarget(txn)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors shrink-0"
                  >
                    <ArrowCounterClockwiseIcon size={12} />
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={transactions}
            isLoading={query.isLoading}
            loadingRows={8}
            hidePagination
            emptyTitle="No transactions"
            emptyDescription={
              hasActiveFilter ? 'Try adjusting your filters.' : 'Create the first transaction to get started.'
            }
            onRowClick={(txn) => router.push(`/transactions/${txn.id}`)}
          />

          {query.hasNextPage && (
            <div className="flex justify-center mt-4">
              <button
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
                className="px-4 py-2 text-sm text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:text-zinc-950 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                {query.isFetchingNextPage ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}

          {!query.isLoading && !query.hasNextPage && transactions.length > 0 && (
            <p className="text-center mt-4 text-xs text-zinc-400">All {transactions.length} results loaded</p>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete transaction?"
        description={`Delete #${deleteTarget?.number}? It will be moved to trash and can be restored by an admin.`}
        onConfirm={() => { if (deleteTarget) deleteMut.mutate(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMut.isPending}
      />

      <ConfirmDialog
        open={!!restoreTarget}
        title="Restore transaction?"
        description={`Restore #${restoreTarget?.number} back to the active list?`}
        onConfirm={() => { if (restoreTarget) restoreMut.mutate(restoreTarget.id); }}
        onCancel={() => setRestoreTarget(null)}
        loading={restoreMut.isPending}
      />
    </div>
  );
}
