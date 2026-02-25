'use client';

import { useEffect, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { PlusIcon, TrashIcon, ArrowLeftIcon, CameraIcon } from '@phosphor-icons/react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCustomerByPhoneQuery } from '@/hooks/useCustomersQuery';
import type { Service, Promo } from '@/lib/types';

const itemSchema = z.object({
  shoeDescription: z.string().min(1, 'Shoe description is required'),
  primaryServiceId: z.string().min(1, 'Select a primary service'),
  addonServiceIds: z.array(z.string()),
});

const schema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().min(1, 'Phone number is required'),
  customerEmail: z.string().min(1, 'Email is required').email('Invalid email format'),
  pickupDate: z.string().optional(),
  promoId: z.string().optional(),
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

  const { data: promos = [] } = useQuery({
    queryKey: ['promos', 'active'],
    queryFn: () => api.promos.list(true),
  });

  const today = new Date().toISOString().split('T')[0];
  const validPromos = (promos as Promo[]).filter((p) => {
    if (p.dateFrom && p.dateFrom > today) return false;
    if (p.dateTo && p.dateTo < today) return false;
    return true;
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
      promoId: '',
      note: '',
      items: [{ shoeDescription: '', primaryServiceId: '', addonServiceIds: [] }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const watchedItems = useWatch({ control, name: 'items' });
  const watchedPromoId = useWatch({ control, name: 'promoId' }) ?? 'none';
  const phoneValue = useWatch({ control, name: 'customerPhone' }) ?? '';

  const [debouncedPhone, setDebouncedPhone] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedPhone(phoneValue), 400);
    return () => clearTimeout(t);
  }, [phoneValue]);

  const { data: existingCustomer, isFetching: customerLookingUp } = useCustomerByPhoneQuery(debouncedPhone);

  useEffect(() => {
    if (existingCustomer) {
      if (existingCustomer.name) setValue('customerName', existingCustomer.name);
      if (existingCustomer.email) setValue('customerEmail', existingCustomer.email);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingCustomer]);

  const rawTotal = (watchedItems ?? []).reduce((sum, item) => {
    const primarySvc = item?.primaryServiceId
      ? (services as Service[]).find((s) => s.id === parseInt(item.primaryServiceId, 10))
      : null;
    const addonTotal = (item?.addonServiceIds ?? []).reduce((aSum, id) => {
      const svc = (services as Service[]).find((s) => s.id === parseInt(id, 10));
      return aSum + (svc ? parseFloat(svc.price) : 0);
    }, 0);
    return sum + (primarySvc ? parseFloat(primarySvc.price) : 0) + addonTotal;
  }, 0);

  const selectedPromo = watchedPromoId && watchedPromoId !== 'none'
    ? validPromos.find((p) => String(p.id) === watchedPromoId) ?? null
    : null;
  const total = selectedPromo
    ? rawTotal * (1 - parseFloat(selectedPromo.percent) / 100)
    : rawTotal;

  const createMut = useMutation({
    mutationFn: (data: FormData) => {
      const allItems = data.items.map((i) => {
        const primarySvc = i.primaryServiceId
          ? (services as Service[]).find((s) => s.id === parseInt(i.primaryServiceId, 10))
          : null;
        const addonTotal = (i.addonServiceIds ?? []).reduce((sum, id) => {
          const svc = (services as Service[]).find((s) => s.id === parseInt(id, 10));
          return sum + (svc ? parseFloat(svc.price) : 0);
        }, 0);
        const itemPrice = (primarySvc ? parseFloat(primarySvc.price) : 0) + addonTotal;
        return {
          shoeDescription: i.shoeDescription || undefined,
          serviceId: i.primaryServiceId ? parseInt(i.primaryServiceId, 10) : undefined,
          status: 'pending' as const,
          price: itemPrice > 0 ? String(itemPrice) : undefined,
        };
      });
      return api.transactions.create({
        customerName: data.customerName || undefined,
        customerPhone: data.customerPhone || undefined,
        customerEmail: data.customerEmail || undefined,
        pickupDate: data.pickupDate || undefined,
        note: data.note || undefined,
        promoId: data.promoId && data.promoId !== 'none' ? parseInt(data.promoId, 10) : undefined,
        total: total.toFixed(2),
        paid: '0',
        items: allItems,
      });
    },
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
                  {errors.customerName && (
                    <p className="text-xs text-red-500">{errors.customerName.message}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-700">Phone</span>
                    {customerLookingUp && debouncedPhone.length >= 7 && (
                      <span className="text-xs text-zinc-400">Looking up...</span>
                    )}
                    {!customerLookingUp && existingCustomer && (
                      <span className="text-xs text-emerald-600 font-medium">Customer found</span>
                    )}
                    {!customerLookingUp && debouncedPhone.length >= 7 && existingCustomer === null && (
                      <span className="text-xs text-zinc-400">New customer</span>
                    )}
                  </div>
                  <Input
                    placeholder="09XX XXX XXXX"
                    {...register('customerPhone')}
                  />
                  {errors.customerPhone && (
                    <p className="text-xs text-red-500">{errors.customerPhone.message}</p>
                  )}
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
                  variant="dark"
                  size="sm"
                  onClick={() => append({ shoeDescription: '', primaryServiceId: '', addonServiceIds: [] })}
                >
                  <PlusIcon size={13} weight="bold" />
                  Add Item
                </Button>
              </div>

              {errors.items?.root && (
                <p className="text-xs text-red-500 mb-3">{errors.items.root.message}</p>
              )}

              <div className="space-y-3">
                {fields.map((field, idx) => {
                  const primaryServiceId = watchedItems?.[idx]?.primaryServiceId ?? '';
                  const addonServiceIds = watchedItems?.[idx]?.addonServiceIds ?? [];

                  return (
                    <div
                      key={field.id}
                      className="p-3 bg-zinc-50 rounded-md space-y-3"
                    >
                      {/* Shoe description row */}
                      <div className="flex gap-2 items-start">
                        <div className="flex-1 space-y-1">
                          <Input
                            placeholder="e.g. Nike Air Max 1, White/Black"
                            {...register(`items.${idx}.shoeDescription`)}
                          />
                          {errors.items?.[idx]?.shoeDescription && (
                            <p className="text-xs text-red-500">
                              {errors.items[idx].shoeDescription?.message}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 pt-0.5">
                          <div
                            title="Photo upload available after save"
                            className="w-9 h-9 rounded-md border-2 border-dashed border-zinc-300 flex items-center justify-center bg-zinc-100 cursor-not-allowed shrink-0"
                          >
                            <CameraIcon size={14} className="text-zinc-500" />
                          </div>
                          <button
                            type="button"
                            onClick={() => remove(idx)}
                            disabled={fields.length === 1}
                            className="w-9 h-9 flex items-center justify-center rounded-md bg-red-400 text-white hover:bg-red-500 transition-colors disabled:opacity-30 shrink-0"
                          >
                            <TrashIcon size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Primary service picker */}
                      <div>
                        <span className="text-xs font-medium text-zinc-500 block mb-1.5">
                          Primary Service
                        </span>
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
                                  onClick={() =>
                                    setValue(
                                      `items.${idx}.primaryServiceId`,
                                      selected ? '' : String(s.id),
                                    )
                                  }
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
                        {errors.items?.[idx]?.primaryServiceId && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors.items[idx].primaryServiceId?.message}
                          </p>
                        )}
                      </div>

                      {/* Add-on picker */}
                      {addonServices.length > 0 && (
                        <div>
                          <span className="text-xs font-medium text-zinc-500 block mb-1.5">
                            Add-ons
                          </span>
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
                                    setValue(`items.${idx}.addonServiceIds`, next);
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
                  );
                })}
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
                  <label className="text-xs font-medium text-zinc-700">Promo Code</label>
                  <Select
                    value={watchedPromoId || 'none'}
                    onValueChange={(v) => setValue('promoId', v === 'none' ? '' : v)}
                  >
                    <SelectTrigger className="h-9 text-sm w-full border-zinc-200 font-mono">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {validPromos.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          <span className="font-mono">{p.code}</span>
                          <span className="text-zinc-400 ml-1.5">· -{parseFloat(p.percent).toFixed(0)}%</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <span className="text-zinc-500">Shoes</span>
                  <span className="font-mono text-zinc-950">
                    {(watchedItems ?? []).filter((i) => i?.primaryServiceId).length}
                  </span>
                </div>
                {selectedPromo && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Promo</span>
                    <span className="font-mono text-emerald-600">-{parseFloat(selectedPromo.percent).toFixed(0)}%</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm border-t border-zinc-100 pt-2">
                  <span className="font-medium text-zinc-950">Total</span>
                  <div className="text-right">
                    {selectedPromo && (
                      <p className="font-mono text-xs text-zinc-400 line-through">₱{rawTotal.toFixed(2)}</p>
                    )}
                    <span className="font-mono font-semibold text-zinc-950">
                      ₱{total.toFixed(2)}
                    </span>
                  </div>
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
