import { createClient } from './supabase/client';
import type {
  Transaction,
  Customer,
  Service,
  Promo,
  Expense,
  ExpenseSummary,
  AuditEntry,
  ClaimPayment,
  TransactionItem,
  AppUser,
  Branch,
  TodayCollection,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function getAuthHeaders(): Promise<HeadersInit> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...authHeaders, ...init?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

export const api = {
  transactions: {
    list: (params?: Record<string, string>) => {
      const qs = new URLSearchParams(params);
      return apiFetch<Transaction[]>(`/transactions?${qs}`);
    },
    recent: (limit = 10) => apiFetch<Transaction[]>(`/transactions/recent?limit=${limit}`),
    upcoming: () => apiFetch<Transaction[]>('/transactions/upcoming'),
    todayCollections: () => apiFetch<TodayCollection[]>('/transactions/today-collections'),
    get: (id: number) => apiFetch<Transaction>(`/transactions/${id}`),
    getByNumber: (number: string) => apiFetch<Transaction>(`/transactions/number/${number}`),
    create: (body: Partial<Omit<Transaction, 'items'>> & { items?: Record<string, unknown>[] }) =>
      apiFetch<Transaction>('/transactions', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: Partial<Transaction>) =>
      apiFetch<Transaction>(`/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    updateItem: (txnId: number, itemId: number, body: Partial<TransactionItem>) =>
      apiFetch<TransactionItem>(`/transactions/${txnId}/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    addPayment: (id: number, body: { method: string; amount: string }) =>
      apiFetch<ClaimPayment>(`/transactions/${id}/payments`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    delete: (id: number) => apiFetch<void>(`/transactions/${id}`, { method: 'DELETE' }),
  },

  services: {
    list: (activeOnly?: boolean) =>
      apiFetch<Service[]>(`/services${activeOnly ? '?active=1' : ''}`),
    get: (id: number) => apiFetch<Service>(`/services/${id}`),
    create: (body: Partial<Service>) =>
      apiFetch<Service>('/services', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: Partial<Service>) =>
      apiFetch<Service>(`/services/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: number) => apiFetch<void>(`/services/${id}`, { method: 'DELETE' }),
  },

  promos: {
    list: (activeOnly?: boolean) => apiFetch<Promo[]>(`/promos${activeOnly ? '?active=1' : ''}`),
    get: (id: number) => apiFetch<Promo>(`/promos/${id}`),
    findByCode: (code: string) => apiFetch<Promo | null>(`/promos/code/${code}`),
    create: (body: Partial<Promo>) =>
      apiFetch<Promo>('/promos', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: Partial<Promo>) =>
      apiFetch<Promo>(`/promos/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: number) => apiFetch<void>(`/promos/${id}`, { method: 'DELETE' }),
  },

  expenses: {
    listByDate: (date: string) => apiFetch<Expense[]>(`/expenses?date=${date}`),
    listByMonth: (year: number, month: number) =>
      apiFetch<Expense[]>(`/expenses/monthly?year=${year}&month=${month}`),
    summary: (date: string) => apiFetch<ExpenseSummary>(`/expenses/summary?date=${date}`),
    create: (body: Partial<Expense>) =>
      apiFetch<Expense>('/expenses', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: Partial<Expense>) =>
      apiFetch<Expense>(`/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: number) => apiFetch<void>(`/expenses/${id}`, { method: 'DELETE' }),
  },

  audit: {
    list: () => apiFetch<AuditEntry[]>('/audit'),
  },

  customers: {
    findByPhone: (phone: string) => apiFetch<Customer | null>(`/customers/by-phone/${encodeURIComponent(phone)}`),
  },

  users: {
    me: () => apiFetch<AppUser>('/users/me'),
    onboard: (branchId: number) =>
      apiFetch<AppUser>('/users/me/onboard', {
        method: 'PATCH',
        body: JSON.stringify({ branchId }),
      }),
  },

  branches: {
    list: (activeOnly?: boolean) =>
      apiFetch<Branch[]>(`/branches${activeOnly ? '?active=1' : ''}`),
  },
};
