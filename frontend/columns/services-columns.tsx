'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { TrashIcon, PencilSimpleIcon, CheckIcon, XIcon } from '@phosphor-icons/react';
import { formatPeso } from '@/lib/utils';
import { toTitleCase } from '@/utils/text';
import type { Service } from '@/lib/types';

interface EditForm {
  name: string;
  type: 'primary' | 'add_on';
  price: string;
}

interface ServicesColumnsOptions {
  editId: number | null;
  form: EditForm;
  setForm: (updater: (f: EditForm) => EditForm) => void;
  onUpdate: () => void;
  onCancelEdit: () => void;
  onStartEdit: (s: Service) => void;
  onToggle: (id: number, isActive: boolean) => void;
  onDelete: (s: Service) => void;
}

export const createServicesColumns = ({
  editId,
  form,
  setForm,
  onUpdate,
  onCancelEdit,
  onStartEdit,
  onToggle,
  onDelete,
}: ServicesColumnsOptions): ColumnDef<Service>[] => [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => {
      const s = row.original;
      if (editId === s.id) {
        return (
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full px-2 py-1 text-sm border border-zinc-200 rounded focus:outline-none focus:border-blue-500"
          />
        );
      }
      return (
        <span className={`font-medium ${s.isActive ? 'text-zinc-950' : 'text-zinc-400 line-through'}`}>
          {toTitleCase(s.name)}
        </span>
      );
    },
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => {
      const s = row.original;
      if (editId === s.id) {
        return (
          <select
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'primary' | 'add_on' }))}
            className="text-sm border border-zinc-200 rounded px-2 py-1 focus:outline-none"
          >
            <option value="primary">Primary</option>
            <option value="add_on">Add-on</option>
          </select>
        );
      }
      return (
        <span className="text-xs text-zinc-400">{s.type === 'primary' ? 'Primary' : 'Add-on'}</span>
      );
    },
  },
  {
    accessorKey: 'price',
    header: 'Price',
    cell: ({ row }) => {
      const s = row.original;
      if (editId === s.id) {
        return (
          <input
            type="number"
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            className="w-full px-2 py-1 text-sm border border-zinc-200 rounded font-mono focus:outline-none focus:border-blue-500"
          />
        );
      }
      return <span className="font-mono text-zinc-700">{formatPeso(s.price)}</span>;
    },
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => {
      const s = row.original;
      if (editId === s.id) {
        return (
          <div className="flex items-center justify-end gap-1">
            <button onClick={onUpdate} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors">
              <CheckIcon size={14} weight="bold" />
            </button>
            <button onClick={onCancelEdit} className="p-1.5 text-zinc-400 hover:bg-zinc-100 rounded transition-colors">
              <XIcon size={14} />
            </button>
          </div>
        );
      }
      return (
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onToggle(s.id, !s.isActive)}
            className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded transition-colors"
          >
            {s.isActive ? 'Deactivate' : 'Activate'}
          </button>
          <button
            onClick={() => onStartEdit(s)}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded transition-colors"
          >
            <PencilSimpleIcon size={13} />
          </button>
          <button
            onClick={() => onDelete(s)}
            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
          >
            <TrashIcon size={13} />
          </button>
        </div>
      );
    },
  },
];
