'use client';

import { type ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { TrashIcon } from '@phosphor-icons/react';
import { formatPeso, formatDate, formatDatetime } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { toTitleCase } from '@/utils/text';
import type { Transaction } from '@/lib/types';

interface TransactionColumnsOptions {
  onDelete: (txn: Transaction) => void;
}

export const createTransactionColumns = ({ onDelete }: TransactionColumnsOptions): ColumnDef<Transaction>[] => [
  {
    accessorKey: 'number',
    header: '#',
    cell: ({ row }) => (
      <Link
        href={`/transactions/${row.original.id}`}
        className="font-mono text-xs text-zinc-950 hover:text-blue-600 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        #{row.original.number}
      </Link>
    ),
  },
  {
    accessorKey: 'customerName',
    header: 'Customer',
    cell: ({ row }) => (
      <div>
        <span className="font-medium text-zinc-950">
          {toTitleCase(row.original.customerName) || '—'}
        </span>
        {row.original.customerPhone && (
          <span className="block text-xs text-zinc-400">{row.original.customerPhone}</span>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'pickupDate',
    header: 'Pickup',
    cell: ({ row }) => (
      <span className="text-sm text-zinc-500">{formatDate(row.original.pickupDate)}</span>
    ),
  },
  {
    accessorKey: 'total',
    header: () => <span className="block text-right">Total</span>,
    cell: ({ row }) => (
      <span className="block text-right font-mono text-sm text-zinc-950">
        {formatPeso(row.original.total)}
      </span>
    ),
  },
  {
    accessorKey: 'paid',
    header: () => <span className="block text-right">Balance</span>,
    cell: ({ row }) => {
      const balance = parseFloat(row.original.total) - parseFloat(row.original.paid);
      return (
        <span className={`block text-right font-mono text-sm ${balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
          {balance > 0 ? formatPeso(balance) : 'Paid'}
        </span>
      );
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => (
      <span className="text-sm text-zinc-400">{formatDatetime(row.original.createdAt)}</span>
    ),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(row.original); }}
        className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-red-500 transition-all duration-150 rounded"
      >
        <TrashIcon size={14} />
      </button>
    ),
  },
];
