'use client';

import { useState, useRef, useEffect } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { CameraIcon } from '@phosphor-icons/react';
import { formatPeso, STATUS_COLORS, cn } from '@/lib/utils';
import { toTitleCase } from '@/utils/text';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import type { TransactionItem, ItemStatus } from '@/lib/types';

function StatusLoadingPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
        STATUS_COLORS[status] ?? 'text-zinc-600 bg-zinc-100',
      )}
    >
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-1 h-1 rounded-full bg-current animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

interface TransactionItemColumnsOptions {
  onStatusChange: (itemId: number, status: ItemStatus) => void;
  onImageClick?: (url: string, label: string) => void;
  onUploadClick?: (itemId: number, type: 'before' | 'after') => void;
  loadingItemIds?: Set<number>;
  uploadingItemIds?: Set<string>; // `${itemId}-${type}`
  disableUploadBefore?: boolean;
  txnBalance?: number;
}

const ITEM_STATUSES: ItemStatus[] = ['pending', 'in_progress', 'done', 'claimed', 'cancelled'];


function ImageCell({
  url,
  label,
  uploading,
  onImageClick,
  onUploadClick,
}: {
  url: string | null;
  label: string;
  uploading?: boolean;
  onImageClick?: (url: string, label: string) => void;
  onUploadClick?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Handle already-cached images — onLoad won't fire for them
  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true);
  }, []);

  if (uploading) {
    return (
      <div className="w-16 h-16 rounded border border-zinc-200 flex items-center justify-center bg-zinc-50 animate-pulse">
        <CameraIcon size={18} className="text-zinc-400" />
      </div>
    );
  }
  if (!url) {
    if (!onUploadClick) {
      return <span className="text-zinc-400 text-xs">—</span>;
    }
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onUploadClick(); }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-dashed border-zinc-300 rounded-md hover:border-blue-400 hover:bg-blue-50 transition-colors group"
      >
        <CameraIcon size={13} className="text-zinc-400 group-hover:text-blue-500 transition-colors shrink-0" />
        <span className="text-xs font-medium text-zinc-500 group-hover:text-blue-600 transition-colors whitespace-nowrap">
          Upload {label.toLowerCase()}
        </span>
      </button>
    );
  }
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onImageClick?.(url, label); }}
      className="w-16 h-16 rounded border border-zinc-200 overflow-hidden hover:opacity-80 transition-opacity duration-150 shrink-0 relative"
    >
      {/* Skeleton shown until image loads */}
      {!loaded && (
        <div className="absolute inset-0 bg-zinc-100 animate-pulse" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={url}
        alt={label}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={cn(
          'w-full h-full object-cover transition-opacity duration-200',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
      />
    </button>
  );
}

export const createTransactionItemColumns = ({ onStatusChange, onImageClick, onUploadClick, loadingItemIds, uploadingItemIds, disableUploadBefore, txnBalance }: TransactionItemColumnsOptions): ColumnDef<TransactionItem>[] => [
  {
    accessorKey: 'shoeDescription',
    header: 'Shoe',
    cell: ({ row }) => (
      <span className="text-zinc-950">{toTitleCase(row.original.shoeDescription) || '—'}</span>
    ),
  },
  {
    id: 'service',
    header: 'Service',
    cell: ({ row }) => {
      const primary = row.original.service;
      const addons = row.original.addonServices ?? [];
      if (!primary && addons.length === 0) {
        return <span className="text-zinc-400 text-xs">—</span>;
      }
      return (
        <div className="flex flex-col gap-1">
          {primary && (
            <span className="inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700">
              {primary.name}
            </span>
          )}
          {addons.map((a) => (
            <span key={a.id} className="inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-500">
              +{a.name}
            </span>
          ))}
        </div>
      );
    },
  },
  {
    accessorKey: 'beforeImageUrl',
    header: 'Before',
    cell: ({ row }) => (
      <ImageCell
        url={row.original.beforeImageUrl}
        label="Before"
        uploading={uploadingItemIds?.has(`${row.original.id}-before`)}
        onImageClick={onImageClick}
        onUploadClick={disableUploadBefore ? undefined : () => onUploadClick?.(row.original.id, 'before')}
      />
    ),
  },
  {
    accessorKey: 'afterImageUrl',
    header: 'After',
    cell: ({ row }) => (
      <ImageCell
        url={row.original.afterImageUrl}
        label="After"
        uploading={uploadingItemIds?.has(`${row.original.id}-after`)}
        onImageClick={onImageClick}
        onUploadClick={() => onUploadClick?.(row.original.id, 'after')}
      />
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const isUpdating = loadingItemIds?.has(row.original.id) ?? false;
      const locked = ['cancelled', 'claimed'].includes(row.original.status);

      if (isUpdating) {
        return <StatusLoadingPill status={row.original.status} />;
      }

      if (locked) {
        return <StatusBadge status={row.original.status} />;
      }

      const hasBalance = (txnBalance ?? 0) > 0;
      const missingAfter = !row.original.afterImageUrl;

      return (
        <Select
          value={row.original.status}
          onValueChange={(v) => {
            if (v === 'claimed') {
              if (missingAfter) { return; }
              if (hasBalance) { return; }
            }
            onStatusChange(row.original.id, v as ItemStatus);
          }}
        >
          <SelectTrigger className="h-auto border-0 bg-transparent shadow-none p-0 gap-1.5 focus-visible:ring-0 w-auto">
            <StatusBadge status={row.original.status} />
          </SelectTrigger>
          <SelectContent position="popper">
            {ITEM_STATUSES.map((s) => {
              const disableClaimed = s === 'claimed' && (missingAfter || hasBalance);
              return (
                <SelectItem
                  key={s}
                  value={s}
                  disabled={disableClaimed}
                  className={disableClaimed ? 'opacity-40 cursor-not-allowed' : ''}
                  title={
                    s === 'claimed' && missingAfter
                      ? 'Upload after photo before claiming'
                      : s === 'claimed' && hasBalance
                        ? 'Settle balance before claiming'
                        : undefined
                  }
                >
                  <StatusBadge status={s} />
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      );
    },
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
