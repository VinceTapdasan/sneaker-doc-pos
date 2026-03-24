'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { TrashIcon, PencilSimpleIcon } from '@phosphor-icons/react';
import { formatDate } from '@/lib/utils';
import { toTitleCase } from '@/utils/text';
import { Switch } from '@/components/ui/switch';
import type { Promo } from '@/lib/types';

export interface PromoEditForm {
  name: string;
  code: string;
  percent: string;
  dateFrom: string;
  dateTo: string;
}

interface PromoColumnsOptions {
  onDelete: (promo: Promo) => void;
  onToggle: (id: number, isActive: boolean) => void;
  onStartEdit?: (p: Promo) => void;
}

const isPromoActive = (p: Promo): boolean => {
  if (!p.isActive) return false;
  const today = new Date().toISOString().split('T')[0];
  if (p.dateFrom && p.dateFrom > today) return false;
  if (p.dateTo && p.dateTo < today) return false;
  if (p.maxUses != null && (p.usageCount ?? 0) >= p.maxUses) return false;
  return true;
};

export const createPromoColumns = ({
  onDelete,
  onToggle,
  onStartEdit,
}: PromoColumnsOptions): ColumnDef<Promo>[] => [
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
    cell: ({ row }) => {
      const p = row.original;
      return (
        <span className="text-zinc-500 text-xs">
          {p.dateFrom || p.dateTo
            ? `${formatDate(p.dateFrom)} — ${formatDate(p.dateTo)}`
            : 'No expiry'}
        </span>
      );
    },
  },
  {
    id: 'usage',
    header: 'Uses',
    cell: ({ row }) => {
      const p = row.original;
      if (p.maxUses == null) {
        return <span className="text-xs text-zinc-400">{p.usageCount ?? 0} / ∞</span>;
      }
      const used = p.usageCount ?? 0;
      const exhausted = used >= p.maxUses;
      return (
        <span className={`text-xs font-mono ${exhausted ? 'text-red-500 font-medium' : 'text-zinc-600'}`}>
          {used} / {p.maxUses}
          {exhausted && <span className="ml-1 text-[10px] bg-red-100 text-red-600 px-1 py-0.5 rounded">full</span>}
        </span>
      );
    },
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
    cell: ({ row }) => {
      const p = row.original;
      return (
        <div className="flex items-center justify-end gap-3">
          <Switch
            checked={p.isActive}
            onCheckedChange={(checked) => { onToggle(p.id, checked); }}
            onClick={(e) => e.stopPropagation()}
          />
          {onStartEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onStartEdit(p); }}
              className="p-2 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded transition-all"
            >
              <PencilSimpleIcon size={16} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(p); }}
            className="p-2 text-red-500 bg-red-50 hover:text-red-600 hover:bg-red-100 rounded transition-all"
          >
            <TrashIcon size={16} />
          </button>
        </div>
      );
    },
  },
];
