'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export const PROMOS_KEY = ['promos'] as const;

export function usePromosQuery() {
  return useQuery({
    queryKey: PROMOS_KEY,
    queryFn: () => api.promos.list(true),
  });
}

export function useCreatePromoMutation(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; code: string; percent: string; dateFrom?: string; dateTo?: string; maxUses?: number }) =>
      api.promos.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROMOS_KEY });
      toast.success('Promo created');
      onSuccess?.();
    },
    onError: (err: Error) => toast.error('Failed to create promo', { description: err.message }),
  });
}

export function useUpdatePromoMutation(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; isActive?: boolean; name?: string; code?: string; percent?: string; dateFrom?: string; dateTo?: string; maxUses?: number | null }) =>
      api.promos.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROMOS_KEY });
      toast.success('Promo updated');
      onSuccess?.();
    },
    onError: (err: Error) => toast.error('Failed to update promo', { description: err.message }),
  });
}

export function useDeletePromoMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.promos.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROMOS_KEY });
      toast.success('Promo deleted');
    },
    onError: (err: Error) => toast.error('Failed to delete promo', { description: err.message }),
  });
}
