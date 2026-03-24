'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';

const schema = z.object({
  name: z.string().min(1, 'Promo name is required'),
  code: z.string().min(1, 'Promo code is required').toUpperCase(),
  percent: z.string()
    .min(1, 'Discount is required')
    .refine(
      (v) => parseFloat(v) > 0 && parseFloat(v) <= 100,
      'Must be between 1 and 100',
    ),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  maxUses: z.string().optional().refine(
    (v) => !v || (parseInt(v, 10) >= 1 && !isNaN(parseInt(v, 10))),
    'Must be a number ≥ 1',
  ),
}).refine(
  (data) => {
    if (data.dateFrom && data.dateTo) {
      return data.dateTo >= data.dateFrom;
    }
    return true;
  },
  { message: 'End date must be after start date', path: ['dateTo'] },
);

type FormData = z.infer<typeof schema>;

interface PromoFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function PromoForm({ onSuccess, onCancel }: PromoFormProps) {
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', code: '', percent: '', dateFrom: '', dateTo: '', maxUses: '' },
  });

  const createMut = useMutation({
    mutationFn: (data: FormData) =>
      api.promos.create({
        name: data.name,
        code: data.code,
        percent: data.percent,
        dateFrom: data.dateFrom || undefined,
        dateTo: data.dateTo || undefined,
        maxUses: data.maxUses ? parseInt(data.maxUses, 10) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promos'] });
      toast.success('Promo created');
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error('Failed to create promo', { description: err.message });
    },
  });

  return (
    <form
      onSubmit={handleSubmit((data) => createMut.mutate(data))}
      className="bg-white border border-zinc-200 rounded-lg p-5 mb-6"
    >
      <h3 className="text-sm font-semibold text-zinc-950 mb-4">New Promo</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Input
            label="Promo Name"
            placeholder="e.g. Opening Month Special"
            {...register('name')}
          />
          {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Input
            label="Code"
            placeholder="SAVE20"
            className="font-mono uppercase"
            {...register('code')}
          />
          {errors.code && <p className="text-xs text-red-500">{errors.code.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Input
            label="Discount %"
            type="number"
            min="1"
            max="100"
            step="0.5"
            placeholder="20"
            {...register('percent')}
          />
          {errors.percent && <p className="text-xs text-red-500">{errors.percent.message}</p>}
        </div>

        <div />

        <div className="flex flex-col gap-1.5">
          <Input
            label="Max Uses (optional)"
            type="number"
            min="1"
            step="1"
            placeholder="Unlimited"
            {...register('maxUses')}
          />
          {errors.maxUses && <p className="text-xs text-red-500">{errors.maxUses.message}</p>}
          <p className="text-[11px] text-zinc-400">Leave blank for unlimited uses</p>
        </div>

        <div />

        <div className="flex flex-col gap-1.5">
          <Input
            label="Valid From (optional)"
            type="date"
            {...register('dateFrom')}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Input
            label="Valid Until (optional)"
            type="date"
            {...register('dateTo')}
          />
          {errors.dateTo && <p className="text-xs text-red-500">{errors.dateTo.message}</p>}
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <Button type="submit" size="sm" disabled={createMut.isPending}>
          {createMut.isPending ? <Spinner /> : 'Save Promo'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
