'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { createTransactionColumns } from '@/columns/transactions-columns';
import { useUpcomingPickupsQuery } from '@/hooks/useTransactionsQuery';
import type { Transaction } from '@/lib/types';

export default function UpcomingPickupsPage() {
  const router = useRouter();
  const { data = [], isLoading } = useUpcomingPickupsQuery();
  const transactions = data as Transaction[];

  const columns = useMemo(
    () => createTransactionColumns({ onDelete: () => {} }),
    [],
  );

  return (
    <div>
      <PageHeader
        title="Upcoming Pickups"
        subtitle={
          transactions.length > 0
            ? `${transactions.length} pickup${transactions.length === 1 ? '' : 's'} within 3 days`
            : 'Transactions with pickup date within 3 days'
        }
      />

      <DataTable
        columns={columns}
        data={transactions}
        isLoading={isLoading}
        loadingRows={5}
        hidePagination
        emptyTitle="No upcoming pickups"
        emptyDescription="No transactions with a pickup date in the next 3 days."
        onRowClick={(txn) => router.push(`/transactions/${txn.id}`)}
      />
    </div>
  );
}
