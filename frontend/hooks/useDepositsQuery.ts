'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export function useDepositsQuery(year: number, month: number, branchId?: number) {
  return useQuery({
    queryKey: ['deposits', year, month, branchId],
    queryFn: () => api.deposits.get(year, month, branchId),
  });
}

export function useDepositsAuditQuery(year: number, month: number, branchId?: number, method?: string) {
  return useQuery({
    queryKey: ['deposits-audit', year, month, branchId, method],
    queryFn: () => api.deposits.getAudit(year, month, branchId, method),
  });
}

export function useUpsertDepositMutation(year: number, month: number, branchId?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { method: string; amount: string }) =>
      api.deposits.upsert({ year, month, method: body.method, amount: body.amount, branchId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['deposits', year, month, branchId] });
      void qc.invalidateQueries({ queryKey: ['deposits-audit'] });
      void qc.invalidateQueries({ queryKey: ['collections-summary'] });
    },
    onError: (err: Error) => toast.error('Failed to save deposit', { description: err.message }),
  });
}
