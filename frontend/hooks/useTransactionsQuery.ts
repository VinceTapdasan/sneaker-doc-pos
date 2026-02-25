'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { Transaction, TransactionStatus, PaymentMethod } from '@/lib/types';

export const TRANSACTIONS_KEY = ['transactions'] as const;

export const transactionDetailKey = (id: string) => ['transaction', id] as const;

export function useTransactionsQuery(params?: Record<string, string>) {
  return useQuery({
    queryKey: params ? [...TRANSACTIONS_KEY, params] : TRANSACTIONS_KEY,
    queryFn: () => api.transactions.list(params),
    staleTime: 30 * 1000,
  });
}

export function useTransactionReportQuery(year: number, month: number, options?: { enabled?: boolean }) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return useQuery({
    queryKey: ['transactions-report', year, month],
    queryFn: () => api.transactions.list({ from, to, limit: '500' }),
    staleTime: 2 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

export function useDailyStatsQuery() {
  const today = new Date().toISOString().split('T')[0];
  return useQuery({
    queryKey: ['transactions-daily', today],
    queryFn: () => api.transactions.list({ limit: '100' }),
    staleTime: 30 * 1000,
    select: (data: Transaction[]) => data.filter((t) => t.createdAt.split('T')[0] === today),
  });
}

export function useRecentTransactionsQuery(limit = 20) {
  return useQuery({
    queryKey: ['transactions-recent', limit],
    queryFn: () => api.transactions.recent(limit),
    staleTime: 30 * 1000,
  });
}

export function useUpcomingPickupsQuery() {
  return useQuery({
    queryKey: ['transactions-upcoming'],
    queryFn: () => api.transactions.upcoming(),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useTransactionDetailQuery(id: string) {
  const numericId = parseInt(id, 10);
  const qc = useQueryClient();
  return useQuery({
    queryKey: transactionDetailKey(id),
    queryFn: () => api.transactions.get(numericId),
    enabled: !!numericId,
    staleTime: 30 * 1000,
    initialData: () => {
      const queries = qc.getQueriesData<Transaction[]>({ queryKey: TRANSACTIONS_KEY });
      for (const [, data] of queries) {
        const found = data?.find((t) => t.id === numericId);
        if (found) return found;
      }
    },
    initialDataUpdatedAt: () => {
      const queries = qc.getQueriesData<Transaction[]>({ queryKey: TRANSACTIONS_KEY });
      let latest = 0;
      for (const [key] of queries) {
        const ts = qc.getQueryState(key)?.dataUpdatedAt ?? 0;
        if (ts > latest) latest = ts;
      }
      return latest;
    },
  });
}

export function useUpdateTransactionStatusMutation(id: string) {
  const numericId = parseInt(id, 10);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: TransactionStatus) => api.transactions.update(numericId, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transactionDetailKey(id) });
      toast.success('Status updated');
    },
    onError: (err: Error) => toast.error('Failed to update status', { description: err.message }),
  });
}

export function useUpdateItemStatusMutation(txnId: string) {
  const numericTxnId = parseInt(txnId, 10);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, status }: { itemId: number; status: 'pending' | 'in_progress' | 'done' }) =>
      api.transactions.updateItem(numericTxnId, itemId, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transactionDetailKey(txnId) });
      toast.success('Item updated');
    },
    onError: (err: Error) => toast.error('Failed to update item', { description: err.message }),
  });
}

export function useAddPaymentMutation(txnId: string, onSuccess?: () => void) {
  const numericTxnId = parseInt(txnId, 10);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ method, amount }: { method: PaymentMethod; amount: string }) =>
      api.transactions.addPayment(numericTxnId, { method, amount }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transactionDetailKey(txnId) });
      toast.success('Payment recorded');
      onSuccess?.();
    },
    onError: (err: Error) => toast.error('Failed to record payment', { description: err.message }),
  });
}

export function useDeleteTransactionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.transactions.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
      toast.success('Transaction deleted');
    },
    onError: (err: Error) => toast.error('Failed to delete transaction', { description: err.message }),
  });
}
