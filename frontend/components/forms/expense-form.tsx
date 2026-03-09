'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_deposit', label: 'Bank Deposit' },
] as const;

const schema = z.object({
  category: z.string().optional(),
  note: z.string().optional(),
  amount: z.string().min(1, 'Amount is required').refine(
    (v) => parseFloat(v) > 0,
    'Amount must be greater than 0',
  ),
});

type FormData = z.infer<typeof schema>;

interface ExpenseFormProps {
  dateKey: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ExpenseForm({ dateKey, onSuccess, onCancel }: ExpenseFormProps) {
  const qc = useQueryClient();
  const [method, setMethod] = useState<string | undefined>(undefined);
  const [methodError, setMethodError] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { category: '', note: '', amount: '' },
  });

  const createMut = useMutation({
    mutationFn: (data: FormData) =>
      api.expenses.create({
        dateKey,
        category: data.category || undefined,
        note: data.note || undefined,
        method: method || undefined,
        amount: data.amount,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', dateKey] });
      qc.invalidateQueries({ queryKey: ['expenses-summary', dateKey] });
      toast.success('Expense recorded');
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error('Failed to save expense', { description: err.message });
    },
  });

  return (
    <form
      onSubmit={handleSubmit((data) => {
        if (!method) { setMethodError(true); return; }
        setMethodError(false);
        createMut.mutate(data);
      })}
      className="bg-white border border-zinc-200 rounded-lg p-5 mb-6"
    >
      <h3 className="text-sm font-semibold text-zinc-950 mb-4">New Expense</h3>

      <div className="mb-4">
        <p className="text-xs font-medium text-zinc-500 mb-2">Payment Method</p>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => { setMethod(method === value ? undefined : value); setMethodError(false); }}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors duration-150',
                method === value
                  ? 'bg-zinc-950 text-white border-zinc-950'
                  : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400 hover:text-zinc-700',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {methodError && (
          <p className="text-xs text-red-500 mt-1">Payment method is required</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <Input
            label="Category"
            placeholder="e.g. Supplies, Utilities"
            {...register('category')}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Input
            label="Note"
            placeholder="Brief description"
            {...register('note')}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Input
            label="Amount (₱)"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            className="font-mono"
            {...register('amount')}
          />
          {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <Button type="submit" size="sm" disabled={createMut.isPending}>
          {createMut.isPending ? <Spinner /> : 'Save Expense'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
