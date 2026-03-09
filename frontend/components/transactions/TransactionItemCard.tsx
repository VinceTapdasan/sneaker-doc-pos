'use client';

import { type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { TrashIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import type { Service } from '@/lib/types';
import type { TransactionFormData } from '@/schemas/transaction.schema';

export type PendingPhoto = { file: File; previewUrl: string };

interface TransactionItemCardProps {
  index: number;
  register: UseFormRegister<TransactionFormData>;
  errors: FieldErrors<TransactionFormData>;
  primaryServices: Service[];
  addonServices: Service[];
  primaryServiceId: string;
  addonServiceIds: string[];
  canRemove: boolean;
  onRemove: () => void;
  onPrimaryServiceChange: (serviceId: string) => void;
  onAddonServiceChange: (addonIds: string[]) => void;
}

export function TransactionItemCard({
  index,
  register,
  errors,
  primaryServices,
  addonServices,
  primaryServiceId,
  addonServiceIds,
  canRemove,
  onRemove,
  onPrimaryServiceChange,
  onAddonServiceChange,
}: TransactionItemCardProps) {
  return (
    <div className="py-4 space-y-3">
      {/* Row 1: Shoe name + trash */}
      <div className="flex gap-2 items-start">
        <div className="flex-1 space-y-1">
          <Input
            placeholder="e.g. Nike Air Max 1, White/Black"
            {...register(`items.${index}.shoeDescription`)}
          />
          {errors.items?.[index]?.shoeDescription && (
            <p className="text-xs text-red-500">
              {errors.items[index].shoeDescription?.message}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          className="w-9 h-9 flex items-center justify-center rounded-md bg-red-400 text-white hover:bg-red-500 transition-colors disabled:opacity-30 shrink-0"
        >
          <TrashIcon size={14} />
        </button>
      </div>

      {/* Row 2: Services */}
      <div className="flex gap-3 sm:gap-4">
        <div className="flex-1 min-w-0 space-y-2.5">
          {/* Primary Service */}
          <div>
            <span className="text-xs font-medium text-zinc-500 block mb-1.5">Primary Service</span>
            {primaryServices.length === 0 ? (
              <p className="text-xs text-zinc-400">No primary services available.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {primaryServices.map((s) => {
                  const selected = primaryServiceId === String(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onPrimaryServiceChange(selected ? '' : String(s.id))}
                      className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border transition-colors duration-100',
                        selected
                          ? 'bg-zinc-950 text-white border-zinc-950'
                          : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50',
                      )}
                    >
                      {s.name}
                      <span className={cn('font-mono', selected ? 'opacity-60' : 'text-zinc-400')}>
                        ₱{parseFloat(s.price).toLocaleString()}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {errors.items?.[index]?.primaryServiceId && (
              <p className="text-xs text-red-500 mt-1">
                {errors.items[index].primaryServiceId?.message}
              </p>
            )}
          </div>

          {/* Add-ons */}
          {addonServices.length > 0 && (
            <div>
              <span className="text-xs font-medium text-zinc-500 block mb-1.5">Add-ons</span>
              <div className="flex flex-wrap gap-1.5">
                {addonServices.map((s) => {
                  const selected = addonServiceIds.includes(String(s.id));
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        const next = selected
                          ? addonServiceIds.filter((id) => id !== String(s.id))
                          : [...addonServiceIds, String(s.id)];
                        onAddonServiceChange(next);
                      }}
                      className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border transition-colors duration-100',
                        selected
                          ? 'bg-zinc-700 text-white border-zinc-700'
                          : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50',
                      )}
                    >
                      {s.name}
                      <span className={cn('font-mono', selected ? 'opacity-60' : 'text-zinc-400')}>
                        +₱{parseFloat(s.price).toLocaleString()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
