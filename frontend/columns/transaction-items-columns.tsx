'use client';

import { useState, useRef, useEffect } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { CameraIcon, UploadSimpleIcon } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { formatPeso, STATUS_COLORS, cn } from '@/lib/utils';
import { toTitleCase } from '@/utils/text';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { ITEM_STATUS, ITEM_STATUS_VALUES } from '@/lib/constants';
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
  onCameraClick?: (itemId: number, type: 'before' | 'after') => void;
  loadingItemIds?: Set<number>;
  uploadingItemIds?: Set<string>; // `${itemId}-${type}`
  disableUploadBefore?: boolean;
  txnBalance?: number;
  // ID of the single remaining claimable item — only this one is balance-gated
  lastClaimableItemId?: number | null;
  // True if the transaction has at least one transaction-level "after" photo
  hasTransactionAfterPhoto?: boolean;
}

const ITEM_STATUSES = ITEM_STATUS_VALUES;


function ImageCell({
  url,
  label,
  uploading,
  onImageClick,
  onUploadClick,
  onCameraClick,
}: {
  url: string | null;
  label: string;
  uploading?: boolean;
  onImageClick?: (url: string, label: string) => void;
  onUploadClick?: () => void;
  onCameraClick?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Handle already-cached images — onLoad won't fire for them
  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true);
  }, []);

  if (uploading) {
    return (
      <div className="flex gap-1.5">
        <div className="w-11 h-11 flex items-center justify-center border border-dashed border-zinc-300 rounded-lg bg-zinc-50">
          <Spinner />
        </div>
      </div>
    );
  }
  if (!url) {
    if (!onUploadClick && !onCameraClick) {
      return <span className="text-zinc-400 text-xs">—</span>;
    }
    if (onUploadClick && onCameraClick) {
      return (
        <div className="flex gap-1.5">
          <button
            title="Take Photo"
            onClick={(e) => { e.stopPropagation(); onCameraClick(); }}
            className="w-11 h-11 flex items-center justify-center bg-white border border-dashed border-zinc-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors group"
          >
            <CameraIcon size={20} className="text-zinc-500 group-hover:text-blue-600 transition-colors" />
          </button>
          <button
            title="Upload"
            onClick={(e) => { e.stopPropagation(); onUploadClick(); }}
            className="w-11 h-11 flex items-center justify-center bg-white border border-dashed border-zinc-300 rounded-lg hover:border-zinc-400 hover:bg-zinc-50 transition-colors group"
          >
            <UploadSimpleIcon size={20} className="text-zinc-500 group-hover:text-zinc-700 transition-colors" />
          </button>
        </div>
      );
    }
    return (
      <button
        onClick={(e) => { e.stopPropagation(); (onUploadClick ?? onCameraClick)?.(); }}
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
        <div className="absolute inset-0 bg-zinc-200 animate-pulse" />
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

export const createTransactionItemColumns = ({ onStatusChange, onImageClick, onUploadClick, onCameraClick, loadingItemIds, uploadingItemIds, disableUploadBefore, txnBalance, lastClaimableItemId, hasTransactionAfterPhoto }: TransactionItemColumnsOptions): ColumnDef<TransactionItem>[] => [
  {
    accessorKey: 'shoeDescription',
    header: 'Shoe',
    cell: ({ row }) => {
      const { shoeDescription, status, price } = row.original;
      const isCancelled = status === ITEM_STATUS.CANCELLED;
      return (
        <div>
          <span className={isCancelled ? 'text-zinc-400 line-through' : 'text-zinc-950'}>
            {toTitleCase(shoeDescription) || '—'}
          </span>
          {isCancelled && price && (
            <span className="block text-[10px] text-red-400 mt-0.5">
              Refunded {formatPeso(price)}
            </span>
          )}
        </div>
      );
    },
  },
  {
    id: 'service',
    header: 'Service',
    cell: ({ row }) => {
      const primary = row.original.service;
      const addons = row.original.addonServices ?? [];
      const isCancelled = row.original.status === ITEM_STATUS.CANCELLED;
      if (!primary && addons.length === 0) {
        return <span className="text-zinc-400 text-xs">—</span>;
      }
      return (
        <div className="flex flex-col gap-1">
          {primary && (
            <span className={cn(
              'inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
              isCancelled ? 'bg-zinc-50 text-zinc-300' : 'bg-zinc-100 text-zinc-700',
            )}>
              {primary.name}
            </span>
          )}
          {addons.map((a) => (
            <span key={a.id} className={cn(
              'inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
              isCancelled ? 'bg-zinc-50 text-zinc-300' : 'bg-zinc-100 text-zinc-500',
            )}>
              +{a.name}
            </span>
          ))}
        </div>
      );
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const isUpdating = loadingItemIds?.has(row.original.id) ?? false;
      const locked = ([ITEM_STATUS.CANCELLED, ITEM_STATUS.CLAIMED] as string[]).includes(row.original.status);

      if (isUpdating) {
        return <StatusLoadingPill status={row.original.status} />;
      }

      if (locked) {
        return <StatusBadge status={row.original.status} />;
      }

      // After photo can be either per-item (afterImageUrl) or transaction-level (photos with type=after)
      const missingAfter = !row.original.afterImageUrl && !hasTransactionAfterPhoto;
      // Balance only blocks the very last claimable item — others can be claimed freely
      const isLastClaimable = lastClaimableItemId === row.original.id;
      const balanceBlocked = isLastClaimable && (txnBalance ?? 0) > 0;

      return (
        <Select
          value={row.original.status}
          onValueChange={(v) => {
            if (v === ITEM_STATUS.CLAIMED) {
              if (missingAfter) {
                toast.error('Upload an after photo before claiming this item.');
                return;
              }
              if (balanceBlocked) {
                toast.error('Settle the remaining balance before claiming the last item.');
                return;
              }
            }
            onStatusChange(row.original.id, v as ItemStatus);
          }}
        >
          <SelectTrigger className="h-auto border-0 bg-transparent shadow-none p-0 gap-1.5 focus-visible:ring-0 w-auto">
            <StatusBadge status={row.original.status} />
          </SelectTrigger>
          <SelectContent position="popper">
            {ITEM_STATUSES.map((s) => {
              const disableClaimed = s === ITEM_STATUS.CLAIMED && (missingAfter || balanceBlocked);
              return (
                <SelectItem
                  key={s}
                  value={s}
                  disabled={disableClaimed}
                  className={disableClaimed ? 'opacity-40 cursor-not-allowed' : ''}
                  title={
                    s === ITEM_STATUS.CLAIMED && missingAfter
                      ? 'Upload after photo before claiming'
                      : s === ITEM_STATUS.CLAIMED && balanceBlocked
                        ? 'Settle balance before claiming last item'
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
