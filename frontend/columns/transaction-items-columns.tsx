'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { CameraIcon } from '@phosphor-icons/react';
import { formatPeso, STATUS_LABELS } from '@/lib/utils';
import { toTitleCase } from '@/utils/text';
import type { TransactionItem, ItemStatus } from '@/lib/types';

interface TransactionItemColumnsOptions {
  onStatusChange: (itemId: number, status: ItemStatus) => void;
  onImageClick?: (url: string, label: string) => void;
}

const ITEM_STATUSES: ItemStatus[] = ['pending', 'in_progress', 'done', 'claimed', 'cancelled'];

function ImageCell({ url, label, onImageClick }: { url: string | null; label: string; onImageClick?: (url: string, label: string) => void }) {
  if (!url) {
    return (
      <div className="w-9 h-9 rounded border border-dashed border-zinc-200 flex items-center justify-center">
        <CameraIcon size={14} className="text-zinc-300" />
      </div>
    );
  }
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onImageClick?.(url, label); }}
      className="w-9 h-9 rounded border border-zinc-200 overflow-hidden hover:opacity-80 transition-opacity duration-150 shrink-0"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label} className="w-full h-full object-cover" />
    </button>
  );
}

export const createTransactionItemColumns = ({ onStatusChange, onImageClick }: TransactionItemColumnsOptions): ColumnDef<TransactionItem>[] => [
  {
    accessorKey: 'shoeDescription',
    header: 'Shoe',
    cell: ({ row }) => (
      <span className="text-zinc-950">{toTitleCase(row.original.shoeDescription) || '—'}</span>
    ),
  },
  {
    accessorKey: 'beforeImageUrl',
    header: 'Before',
    cell: ({ row }) => (
      <ImageCell url={row.original.beforeImageUrl} label="Before" onImageClick={onImageClick} />
    ),
  },
  {
    accessorKey: 'afterImageUrl',
    header: 'After',
    cell: ({ row }) => (
      <ImageCell url={row.original.afterImageUrl} label="After" onImageClick={onImageClick} />
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
