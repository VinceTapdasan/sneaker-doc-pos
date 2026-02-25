'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { formatPeso, STATUS_LABELS } from '@/lib/utils';
import { toTitleCase } from '@/utils/text';
import type { TransactionItem, ItemStatus } from '@/lib/types';

interface TransactionItemColumnsOptions {
  onStatusChange: (itemId: number, status: ItemStatus) => void;
}

const ITEM_STATUSES: ItemStatus[] = ['pending', 'in_progress', 'done'];

export const createTransactionItemColumns = ({ onStatusChange }: TransactionItemColumnsOptions): ColumnDef<TransactionItem>[] => [
  {
    accessorKey: 'shoeDescription',
    header: 'Shoe',
    cell: ({ row }) => (
      <span className="text-zinc-950">{toTitleCase(row.original.shoeDescription) || '—'}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <select
        value={row.original.status}
        onChange={(e) => onStatusChange(row.original.id, e.target.value as ItemStatus)}
        className="text-xs bg-transparent border-0 text-zinc-700 focus:outline-none cursor-pointer"
        onClick={(e) => e.stopPropagation()}
      >
        {ITEM_STATUSES.map((s) => (
          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
        ))}
      </select>
    ),
  },
  {
    accessorKey: 'price',
    header: () => <span className="block text-right">Price</span>,
    cell: ({ row }) => (
      <span className="block text-right font-mono text-zinc-700">
        {row.original.price ? formatPeso(row.original.price) : '—'}
      </span>
    ),
  },
];
