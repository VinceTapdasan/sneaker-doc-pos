'use client';

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { Transaction, TransactionStatus, PaymentMethod, ItemStatus } from '@/lib/types';

export const TRANSACTIONS_KEY = ['transactions'] as const;

export const transactionDetailKey = (id: string) => ['transaction', id] as const;

export function useTransactionsQuery(params?: Record<string, string>) {
  return useQuery({
    queryKey: params ? [...TRANSACTIONS_KEY, params] : TRANSACTIONS_KEY,
    queryFn: () => api.transactions.list(params),
  });
}

const TRANSACTIONS_PAGE_LIMIT = 50;

export function useInfiniteTransactionsQuery(params: Record<string, string> = {}) {
  return useInfiniteQuery({
    queryKey: [...TRANSACTIONS_KEY, 'infinite', params],
    queryFn: ({ pageParam }) =>
      api.transactions.list({ ...params, limit: String(TRANSACTIONS_PAGE_LIMIT), page: String(pageParam) }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === TRANSACTIONS_PAGE_LIMIT ? allPages.length + 1 : undefined,
  });
}

export function useTransactionReportQuery(
  year: number,
  month: number, // 0 = full year
  options?: { enabled?: boolean; branchId?: number },
) {
  const from = month === 0 ? `${year}-01-01` : `${year}-${String(month).padStart(2, '0')}-01`;
  const to = month === 0
    ? `${year}-12-31`
    : `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  const params: Record<string, string> = { from, to, limit: '1000' };
  if (options?.branchId) params.branchId = String(options.branchId);
  return useQuery({
    queryKey: ['transactions-report', year, month, options?.branchId],
    queryFn: () => api.transactions.list(params),
    enabled: options?.enabled ?? true,
  });
}

export function useDailyStatsQuery() {
  const today = new Date().toISOString().split('T')[0];
  return useQuery({
    queryKey: ['transactions-daily', today],
    queryFn: () => api.transactions.list({ limit: '100' }),
    select: (data: Transaction[]) => data.filter((t) => t.createdAt.split('T')[0] === today),
  });
}

export function useRecentTransactionsQuery(limit = 20) {
  return useQuery({
    queryKey: ['transactions-recent', limit],
    queryFn: () => api.transactions.recent(limit),
  });
}

export function useUpcomingPickupsQuery() {
  return useQuery({
    queryKey: ['transactions-upcoming'],
    queryFn: () => api.transactions.upcoming(),
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useUpcomingByMonthQuery(year: number, month: number) {
  return useQuery({
    queryKey: ['transactions-upcoming-month', year, month],
    queryFn: () => api.transactions.upcomingByMonth(year, month),
  });
}

export function useTransactionDetailQuery(id: string) {
  const numericId = parseInt(id, 10);
  const qc = useQueryClient();
  return useQuery({
    queryKey: transactionDetailKey(id),
    queryFn: () => api.transactions.get(numericId),
    enabled: !!numericId,
    initialData: () => {
      const queries = qc.getQueriesData({ queryKey: TRANSACTIONS_KEY });
      for (const [, data] of queries) {
        if (!data) continue;
        // Infinite query shape: { pages: Transaction[][], pageParams: ... }
        const rows: Transaction[] = Array.isArray(data)
          ? (data as Transaction[])
          : ((data as { pages?: Transaction[][] }).pages ?? []).flat();
        const found = rows.find((t) => t.id === numericId);
        if (found) return found;
      }
    },
    initialDataUpdatedAt: 0,
  });
}

export function useUpdateTransactionMutation(id: string) {
  const numericId = parseInt(id, 10);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { newPickupDate?: string | null; note?: string | null; paid?: string; staffId?: string | null; promoId?: number | null }) =>
      api.transactions.update(numericId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transactionDetailKey(id) });
      toast.success('Transaction updated');
    },
    onError: (err: Error) => toast.error('Failed to update transaction', { description: err.message }),
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
    mutationFn: ({ itemId, status }: { itemId: number; status: ItemStatus }) =>
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
    mutationFn: ({ method, amount, referenceNumber, cardBank }: { method: PaymentMethod; amount: string; referenceNumber?: string; cardBank?: string }) =>
      api.transactions.addPayment(numericTxnId, { method, amount, referenceNumber, cardBank }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transactionDetailKey(txnId) });
      qc.invalidateQueries({ queryKey: ['today-collections'] });
      toast.success('Payment recorded');
      onSuccess?.();
    },
    onError: (err: Error) => toast.error('Failed to record payment', { description: err.message }),
  });
}

export function useUpdatePaymentMethodMutation(txnId: string, onSuccess?: (bankDepositWarning: boolean) => void) {
  const numericTxnId = parseInt(txnId, 10);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, method, referenceNumber, cardBank }: { paymentId: number; method: string; referenceNumber?: string; cardBank?: string }) =>
      api.transactions.updatePaymentMethod(numericTxnId, paymentId, { method, referenceNumber, cardBank }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: transactionDetailKey(txnId) });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      onSuccess?.(data.bankDepositWarning);
    },
    onError: (err: Error) => toast.error('Failed to update payment method', { description: err.message }),
  });
}

export function useDashboardSummaryQuery(
  year: number,
  month: number,
  options?: { branchId?: number; enabled?: boolean },
) {
  return useQuery({
    queryKey: ['dashboard-summary', year, month, options?.branchId],
    queryFn: () => api.transactions.dashboardSummary(year, month, options?.branchId),
    enabled: options?.enabled ?? true,
  });
}

export function useCollectionsSummaryQuery(
  year: number,
  month: number,
  options?: { branchId?: number; enabled?: boolean },
) {
  return useQuery({
    queryKey: ['collections-summary', year, month, options?.branchId],
    queryFn: () => api.transactions.collectionsSummary(year, month, options?.branchId),
    enabled: options?.enabled ?? true,
  });
}

export function useCollectionsHistoryQuery(
  year: number,
  month: number,
  method: string,
  options?: { branchId?: number; enabled?: boolean },
) {
  return useQuery({
    queryKey: ['collections-history', year, month, method, options?.branchId],
    queryFn: () => api.transactions.collectionsHistory(year, month, method, options?.branchId),
    enabled: (options?.enabled ?? true) && !!method,
  });
}

export function useTodayCollectionsQuery() {
  return useQuery({
    queryKey: ['today-collections'],
    queryFn: () => api.transactions.todayCollections(),
    refetchInterval: 60 * 1000,
  });
}

export function useDeleteTransactionMutation(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.transactions.delete(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
      qc.removeQueries({ queryKey: transactionDetailKey(String(id)) });
      toast.success('Transaction deleted');
      onSuccess?.();
    },
    onError: (err: Error) => toast.error('Failed to delete transaction', { description: err.message }),
  });
}

export function useDeletedTransactionsQuery() {
  return useQuery({
    queryKey: ['transactions-deleted'],
    queryFn: () => api.transactions.deleted(),
  });
}

export function useRestoreTransactionMutation(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.transactions.restore(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
      qc.invalidateQueries({ queryKey: ['transactions-deleted'] });
      qc.removeQueries({ queryKey: transactionDetailKey(String(id)) });
      toast.success('Transaction restored');
      onSuccess?.();
    },
    onError: (err: Error) => toast.error('Failed to restore transaction', { description: err.message }),
  });
}
