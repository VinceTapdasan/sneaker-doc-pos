'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { TrashIcon } from '@phosphor-icons/react';
import { formatDate } from '@/lib/utils';
import { toTitleCase } from '@/utils/text';
import type { Promo } from '@/lib/types';

interface PromoColumnsOptions {
  onDelete: (promo: Promo) => void;
}

const isPromoActive = (p: Promo): boolean => {
  if (!p.isActive) return false;
  const today = new Date().toISOString().split('T')[0];
  if (p.dateFrom && p.dateFrom > today) return false;
  if (p.dateTo && p.dateTo < today) return false;
  return true;
};

export const createPromoColumns = ({ onDelete }: PromoColumnsOptions): ColumnDef<Promo>[] => [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <span className="font-medium text-zinc-950">{toTitleCase(row.original.name)}</span>
    ),
  },
  {
    accessorKey: 'code',
    header: 'Code',
    cell: ({ row }) => (
      <span className="font-mono text-sm bg-zinc-100 px-2 py-0.5 rounded text-zinc-700">
        {row.original.code}
      </span>
    ),
  },
  {
    accessorKey: 'percent',
    header: 'Discount',
    cell: ({ row }) => (
      <span className="font-mono text-zinc-700">{parseFloat(row.original.percent).toFixed(0)}%</span>
    ),
  },
  {
    accessorKey: 'dateFrom',
    header: 'Valid Period',
    cell: ({ row }) => (
      <span className="text-zinc-500 text-xs">
        {row.original.dateFrom || row.original.dateTo
          ? `${formatDate(row.original.dateFrom)} — ${formatDate(row.original.dateTo)}`
          : 'No expiry'}
      </span>
    ),
  },
  {
    accessorKey: 'isActive',
    header: 'Status',
    cell: ({ row }) => {
      const active = isPromoActive(row.original);
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${active ? 'bg-emerald-50 text-emerald-600' : 'bg-zinc-100 text-zinc-400'}`}>
          {active ? 'Active' : 'Inactive'}
        </span>
      );
    },
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(row.original); }}
        className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-red-500 rounded transition-all"
      >
        <TrashIcon size={14} />
      </button>
    ),
  },
];
