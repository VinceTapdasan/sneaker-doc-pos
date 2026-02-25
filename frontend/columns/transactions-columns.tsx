'use client';

import { type ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { TrashIcon, DiamondIcon } from '@phosphor-icons/react';
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
      <div className="flex items-center justify-end gap-1">
        <span className="font-mono text-sm text-zinc-950">
          {formatPeso(row.original.total)}
        </span>
        {row.original.promoId && (
          <DiamondIcon size={11} weight="fill" className="text-emerald-500 shrink-0" />
        )}
      </div>
    ),
  },
  {
    accessorKey: 'paid',
    header: () => <span className="block text-right">Balance</span>,
    cell: ({ row }) => {
      const balance = parseFloat(row.original.total) - parseFloat(row.original.paid);
      const paid = parseFloat(row.original.paid);
      const isPartial = balance > 0 && paid > 0;
      const isUnpaid = balance > 0 && paid === 0;
      const pillClass = isUnpaid
        ? 'bg-red-100 text-red-600'
        : isPartial
          ? 'bg-amber-100 text-amber-700'
          : 'bg-emerald-100 text-emerald-700';
      return (
        <div className="flex justify-end">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-mono ${pillClass}`}>
            {isUnpaid ? formatPeso(balance) : isPartial ? 'Partial' : 'Paid'}
          </span>
        </div>
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
