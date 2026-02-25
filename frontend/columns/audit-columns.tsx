'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { formatDatetime } from '@/lib/utils';
import { toTitleCase } from '@/utils/text';
import type { AuditEntry } from '@/lib/types';

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-50 text-emerald-700',
  update: 'bg-blue-50 text-blue-700',
  delete: 'bg-red-50 text-red-700',
  status_change: 'bg-amber-50 text-amber-700',
  payment_add: 'bg-violet-50 text-violet-700',
};

export const auditColumns: ColumnDef<AuditEntry>[] = [
  {
    accessorKey: 'createdAt',
    header: 'Timestamp',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-zinc-400">{formatDatetime(row.original.createdAt)}</span>
    ),
  },
  {
    accessorKey: 'action',
    header: 'Action',
    cell: ({ row }) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[row.original.action] ?? 'bg-zinc-100 text-zinc-500'}`}>
        {row.original.action.replace(/_/g, ' ')}
      </span>
    ),
  },
  {
    accessorKey: 'entityType',
    header: 'Entity',
    cell: ({ row }) => (
      <span className="text-zinc-600">{toTitleCase(row.original.entityType)}</span>
    ),
  },
  {
    accessorKey: 'entityId',
    header: 'Ref',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-zinc-500">{row.original.entityId ?? '—'}</span>
    ),
  },
  {
    accessorKey: 'source',
    header: 'Source',
    cell: ({ row }) => (
      <span className="text-xs text-zinc-400">{toTitleCase(row.original.source) || '—'}</span>
    ),
  },
];
