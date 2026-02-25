'use client';

import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { PlusIcon, TrashIcon, ArrowLeftIcon } from '@phosphor-icons/react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/ui/page-header';
import type { Service } from '@/lib/types';

const itemSchema = z.object({
  shoeDescription: z.string().min(1, 'Shoe description is required'),
  serviceId: z.string().min(1, 'Select a service'),
});

const schema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  pickupDate: z.string().optional(),
  note: z.string().optional(),
  items: z.array(itemSchema).min(1, 'Add at least one item'),
});

type FormData = z.infer<typeof schema>;

export function NewTransactionForm() {
  const router = useRouter();

  const { data: services = [] } = useQuery({
    queryKey: ['services', 'active'],
    queryFn: () => api.services.list(true),
  });

  const primaryServices = (services as Service[]).filter((s) => s.type === 'primary');
  const addonServices = (services as Service[]).filter((s) => s.type === 'add_on');

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      pickupDate: '',
      note: '',
      items: [{ shoeDescription: '', serviceId: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const watchedItems = useWatch({ control, name: 'items' });

  const total = (watchedItems ?? []).reduce((sum, item) => {
    if (!item?.serviceId) return sum;
    const svc = (services as Service[]).find((s) => s.id === parseInt(item.serviceId, 10));
    return sum + (svc ? parseFloat(svc.price) : 0);
  }, 0);

  const createMut = useMutation({
    mutationFn: (data: FormData) =>
      api.transactions.create({
        customerName: data.customerName || undefined,
        customerPhone: data.customerPhone || undefined,
        customerEmail: data.customerEmail || undefined,
        pickupDate: data.pickupDate || undefined,
        note: data.note || undefined,
        total: String(total),
        paid: '0',
        items: data.items.map((i) => {
          const svc = i.serviceId
            ? (services as Service[]).find((s) => s.id === parseInt(i.serviceId, 10))
            : null;
          return {
            shoeDescription: i.shoeDescription || undefined,
            serviceId: i.serviceId ? parseInt(i.serviceId, 10) : undefined,
            status: 'pending',
            price: svc ? svc.price : undefined,
          };
        }),
      }),
    onSuccess: (txn) => {
      toast.success('Transaction created');
      router.push(`/transactions/${txn.id}`);
    },
    onError: (err: Error) => {
      toast.error('Failed to create transaction', { description: err.message });
    },
  });

  return (
    <div>
      <PageHeader
        title="New Transaction"
        backButton={
          <Link href="/transactions">
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon size={14} />
            </Button>
          </Link>
        }
      />

      <form onSubmit={handleSubmit((data) => createMut.mutate(data))}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="col-span-2 space-y-6">
            {/* Customer */}
            <div className="bg-white border border-zinc-200 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-zinc-950 mb-4">Customer</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-2 flex flex-col gap-1.5">
                  <Input
                    label="Name"
                    placeholder="Juan dela Cruz"
                    {...register('customerName')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Input
                    label="Phone"
                    placeholder="09XX XXX XXXX"
                    {...register('customerPhone')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Input
                    label="Email"
                    type="email"
                    placeholder="juan@example.com"
                    {...register('customerEmail')}
                  />
                  {errors.customerEmail && (
                    <p className="text-xs text-red-500">{errors.customerEmail.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="bg-white border border-zinc-200 rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-zinc-950">Shoes & Services</h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => append({ shoeDescription: '', serviceId: '' })}
                >
                  <PlusIcon size={13} weight="bold" />
                  Add Item
                </Button>
              </div>

              {errors.items?.root && (
                <p className="text-xs text-red-500 mb-3">{errors.items.root.message}</p>
              )}

              <div className="space-y-3">
                {fields.map((field, idx) => (
                  <div
                    key={field.id}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-start p-3 bg-zinc-50 rounded-md"
                  >
                    <div className="flex flex-col gap-1.5">
                      <span className={cn('text-xs font-medium text-zinc-700', idx !== 0 && 'invisible')}>
                        Shoe Description
                      </span>
                      <Input
                        placeholder="e.g. Nike Air Max 1, White/Black"
                        {...register(`items.${idx}.shoeDescription`)}
                      />
                      <p className="h-4 text-xs text-red-500">
                        {errors.items?.[idx]?.shoeDescription?.message ?? ''}
                      </p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className={cn('text-xs font-medium text-zinc-700', idx !== 0 && 'invisible')}>
                        Service
                      </span>
                      <Select
                        onValueChange={(v) => setValue(`items.${idx}.serviceId`, v)}
                        defaultValue=""
                      >
                        <SelectTrigger className="h-9 text-sm w-full">
                          <SelectValue placeholder="— Select service —" />
                        </SelectTrigger>
                        <SelectContent>
                          {primaryServices.length > 0 && (
                            <SelectGroup>
                              <SelectLabel>Primary</SelectLabel>
                              {primaryServices.map((s) => (
                                <SelectItem key={s.id} value={String(s.id)}>
                                  {s.name} — ₱{parseFloat(s.price).toFixed(2)}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                          {addonServices.length > 0 && (
                            <SelectGroup>
                              <SelectLabel>Add-ons</SelectLabel>
                              {addonServices.map((s) => (
                                <SelectItem key={s.id} value={String(s.id)}>
                                  {s.name} — ₱{parseFloat(s.price).toFixed(2)}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                        </SelectContent>
                      </Select>
                      <p className="h-4 text-xs text-red-500">
                        {errors.items?.[idx]?.serviceId?.message ?? ''}
                      </p>
                    </div>

                    <div className="flex flex-col">
                      <span className={cn('text-xs', idx !== 0 && 'invisible')}>‎</span>
                      <button
                        type="button"
                        onClick={() => remove(idx)}
                        disabled={fields.length === 1}
                        className="p-2 text-zinc-400 hover:text-red-500 transition-colors disabled:opacity-30"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            <div className="bg-white border border-zinc-200 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-zinc-950 mb-4">Details</h2>
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <Input
                    label="Pickup Date"
                    type="date"
                    {...register('pickupDate')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Input
                    label="Promo Code"
                    placeholder="SAVE20"
                    className="font-mono uppercase"
                    name="promoCode"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-700">Note</label>
                  <textarea
                    rows={3}
                    placeholder="Internal note..."
                    {...register('note')}
                    className="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-zinc-950 mb-3">Summary</h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Items</span>
                  <span className="font-mono text-zinc-950">
                    {(watchedItems ?? []).filter((i) => i?.serviceId).length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm border-t border-zinc-100 pt-2">
                  <span className="font-medium text-zinc-950">Total</span>
                  <span className="font-mono font-semibold text-zinc-950">
                    ₱{total.toFixed(2)}
                  </span>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full mt-4"
                disabled={createMut.isPending}
              >
                {createMut.isPending ? <Spinner /> : 'Create Transaction'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
