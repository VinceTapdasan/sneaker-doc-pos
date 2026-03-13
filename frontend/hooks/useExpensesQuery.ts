'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export const EXPENSES_BASE_KEY = 'expenses';
export const EXPENSES_SUMMARY_BASE_KEY = 'expenses-summary';

export const expensesKey = (date: string) => [EXPENSES_BASE_KEY, date] as const;
export const expensesSummaryKey = (date: string) => [EXPENSES_SUMMARY_BASE_KEY, date] as const;

export function useExpensesQuery(date: string) {
  return useQuery({
    queryKey: expensesKey(date),
    queryFn: () => api.expenses.listByDate(date),
  });
}

export function useExpensesSummaryQuery(date: string) {
  return useQuery({
    queryKey: expensesSummaryKey(date),
    queryFn: () => api.expenses.summary(date),
  });
}

export function useMonthlyExpensesQuery(year: number, month: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['expenses-monthly', year, month],
    queryFn: () => api.expenses.listByMonth(year, month),
    enabled: options?.enabled ?? true,
  });
}

export function useCreateExpenseMutation(date: string, onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { method?: string; category?: string; note?: string; amount: string }) =>
      api.expenses.create({ ...body, dateKey: date }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expensesKey(date) });
      qc.invalidateQueries({ queryKey: expensesSummaryKey(date) });
      toast.success('Expense recorded');
      onSuccess?.();
    },
    onError: (err: Error) => toast.error('Failed to record expense', { description: err.message }),
  });
}

export function useUpdateExpenseMutation(date: string, onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; category?: string; note?: string; method?: string; amount?: string }) =>
      api.expenses.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expensesKey(date) });
      qc.invalidateQueries({ queryKey: expensesSummaryKey(date) });
      toast.success('Expense updated');
      onSuccess?.();
    },
    onError: (err: Error) => toast.error('Failed to update expense', { description: err.message }),
  });
}

export function useDeleteExpenseMutation(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.expenses.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expensesKey(date) });
      qc.invalidateQueries({ queryKey: expensesSummaryKey(date) });
      toast.success('Expense deleted');
    },
    onError: (err: Error) => toast.error('Failed to delete expense', { description: err.message }),
  });
}
