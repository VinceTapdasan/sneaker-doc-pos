'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { TrashIcon, ReceiptIcon, PencilSimpleIcon, ImageIcon } from '@phosphor-icons/react';
import { formatPeso, PAYMENT_METHOD_LABELS } from '@/lib/utils';
import { toTitleCase } from '@/utils/text';
import type { Expense } from '@/lib/types';

const METHOD_STYLES: Record<string, string> = {
  cash: 'bg-emerald-50 text-emerald-700',
  gcash: 'bg-blue-50 text-blue-700',
  card: 'bg-violet-50 text-violet-700',
  bank_deposit: 'bg-amber-50 text-amber-700',
};

export interface ExpenseEditForm {
  category: string;
  note: string;
  method: string;
  amount: string;
}

interface ExpenseColumnsOptions {
  onDelete: (expense: Expense) => void;
  onStartEdit?: (e: Expense) => void;
  isAdmin?: boolean;
}

export const createExpenseColumns = ({
  onDelete,
  onStartEdit,
  isAdmin,
}: ExpenseColumnsOptions): ColumnDef<Expense>[] => [
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => {
      const e = row.original;
      return (
        <div className="flex items-center gap-2">
          <ReceiptIcon size={13} className="text-zinc-400 shrink-0" />
          <span className="font-medium text-zinc-950">{toTitleCase(e.category) || '—'}</span>
        </div>
      );
    },
  },
  {
    accessorKey: 'note',
    header: 'Note',
    cell: ({ row }) => (
      <span className="text-zinc-500">{toTitleCase(row.original.note) || '—'}</span>
    ),
  },
  {
    accessorKey: 'method',
    header: 'Method',
    cell: ({ row }) => {
      const m = row.original.method;
      if (!m) return <span className="text-xs text-zinc-400">—</span>;
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${METHOD_STYLES[m] ?? 'bg-zinc-100 text-zinc-500'}`}>
          {PAYMENT_METHOD_LABELS[m] ?? m}
        </span>
      );
    },
  },
  {
    accessorKey: 'amount',
    header: () => <span className="block text-right">Amount</span>,
    cell: ({ row }) => (
      <span className="block text-right font-mono text-zinc-950">{formatPeso(row.original.amount)}</span>
    ),
  },
  {
    id: 'receipt',
    header: '',
    cell: ({ row }) => {
      const url = row.original.photoUrl;
      if (!url) return null;
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-blue-600 hover:bg-blue-50 transition-colors"
          title="View receipt"
        >
          <ImageIcon size={13} />
          <span className="hidden sm:inline">Receipt</span>
        </a>
      );
    },
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => {
      const e = row.original;
      if (!isAdmin) return null;
      return (
        <div className="flex items-center justify-end gap-3">
          {onStartEdit && (
            <button
              onClick={(ev) => { ev.stopPropagation(); onStartEdit(e); }}
              className="p-2 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded transition-colors"
            >
              <PencilSimpleIcon size={16} />
            </button>
          )}
          <button
            onClick={(ev) => { ev.stopPropagation(); onDelete(e); }}
            className="p-2 text-red-500 bg-red-50 hover:text-red-600 hover:bg-red-100 rounded transition-all"
          >
            <TrashIcon size={16} />
          </button>
        </div>
      );
    },
  },
];
