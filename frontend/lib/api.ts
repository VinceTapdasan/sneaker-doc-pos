import { createClient } from './supabase/client';
import type {
  Transaction,
  TransactionPhoto,
  AssignableUser,
  Customer,
  Service,
  Promo,
  Expense,
  ExpenseSummary,
  AuditEntry,
  ClaimPayment,
  TransactionItem,
  AppUser,
  StaffDocument,
  Branch,
  TodayCollection,
  DashboardSummary,
  DepositAuditEntry,
  ReportSummary,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

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
    throw new ApiError(res.status, (err as { message?: string }).message ?? 'Request failed');
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
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
    upcomingByMonth: (year: number, month: number) =>
      apiFetch<Transaction[]>(`/transactions/upcoming/monthly?year=${year}&month=${month}`),
    todayCollections: () => apiFetch<TodayCollection[]>('/transactions/today-collections'),
    dashboardSummary: (year: number, month: number, branchId?: number) => {
      const qs = new URLSearchParams({ year: String(year), month: String(month) });
      if (branchId) qs.set('branchId', String(branchId));
      return apiFetch<DashboardSummary>(`/transactions/dashboard?${qs}`);
    },
    collectionsSummary: (year: number, month: number, branchId?: number) => {
      const qs = new URLSearchParams({ year: String(year), month: String(month) });
      if (branchId) qs.set('branchId', String(branchId));
      return apiFetch<Record<string, string>>(`/transactions/collections/summary?${qs}`);
    },
    get: (id: number) => apiFetch<Transaction>(`/transactions/${id}`),
    getByNumber: (number: string) => apiFetch<Transaction>(`/transactions/number/${number}`),
    create: (body: Partial<Omit<Transaction, 'items'>> & { items?: Record<string, unknown>[]; isExistingCustomer?: boolean; customerStreetName?: string; customerCity?: string; customerCountry?: string }) =>
      apiFetch<Transaction>('/transactions', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: Partial<Transaction>) =>
      apiFetch<Transaction>(`/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    updateItem: (txnId: number, itemId: number, body: Partial<TransactionItem>) =>
      apiFetch<TransactionItem>(`/transactions/${txnId}/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    addPayment: (id: number, body: { method: string; amount: string; referenceNumber?: string }) =>
      apiFetch<ClaimPayment>(`/transactions/${id}/payments`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    sendPickupReadySms: (id: number) =>
      apiFetch<{ phone: string }>(`/transactions/${id}/sms/pickup-ready`, { method: 'POST' }),
    savePhoto: (id: number, body: { type: 'before' | 'after'; url: string }) =>
      apiFetch<TransactionPhoto>(`/transactions/${id}/photos`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    deletePhoto: (txnId: number, photoId: number) =>
      apiFetch<void>(`/transactions/${txnId}/photos/${photoId}`, { method: 'DELETE' }),
    deleted: () => apiFetch<Transaction[]>('/transactions/deleted'),
    restore: (id: number) => apiFetch<Transaction>(`/transactions/${id}/restore`, { method: 'PATCH' }),
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
    list: (params?: { month?: number; year?: number; performedBy?: string }) => {
      const qs = new URLSearchParams();
      if (params?.month) qs.set('month', String(params.month));
      if (params?.year) qs.set('year', String(params.year));
      if (params?.performedBy) qs.set('performedBy', params.performedBy);
      return apiFetch<AuditEntry[]>(`/audit?${qs}`);
    },
  },

  customers: {
    list: () => apiFetch<Customer[]>('/customers'),
    findByPhone: (phone: string) => apiFetch<Customer | null>(`/customers/by-phone/${encodeURIComponent(phone)}`),
  },

  users: {
    me: () => apiFetch<AppUser>('/users/me'),
    onboard: (branchId: number) =>
      apiFetch<AppUser>('/users/me/onboard', {
        method: 'PATCH',
        body: JSON.stringify({ branchId }),
      }),
    list: () => apiFetch<AppUser[]>('/users'),
    listAssignable: () => apiFetch<AssignableUser[]>('/users/assignable'),
    updateRole: (id: string, userType: string) =>
      apiFetch<AppUser>(`/users/${id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ userType }),
      }),
    updateBranch: (id: string, branchId: number) =>
      apiFetch<AppUser>(`/users/${id}/branch`, {
        method: 'PATCH',
        body: JSON.stringify({ branchId }),
      }),
    get: (id: string) => apiFetch<AppUser>(`/users/${id}`),
    updateProfile: (id: string, body: Partial<AppUser>) =>
      apiFetch<AppUser>(`/users/${id}/profile`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    delete: (id: string) => apiFetch<void>(`/users/${id}`, { method: 'DELETE' }),
    getDocuments: (id: string) => apiFetch<StaffDocument[]>(`/users/${id}/documents`),
    addDocument: (id: string, body: { url: string; label?: string }) =>
      apiFetch<StaffDocument>(`/users/${id}/documents`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    deleteDocument: (userId: string, docId: number) =>
      apiFetch<void>(`/users/${userId}/documents/${docId}`, { method: 'DELETE' }),
  },

  deposits: {
    get: (year: number, month: number, branchId?: number) => {
      const qs = new URLSearchParams({ year: String(year), month: String(month) });
      if (branchId) qs.set('branchId', String(branchId));
      return apiFetch<Record<string, string>>(`/deposits?${qs}`);
    },
    upsert: (body: { year: number; month: number; method: string; amount: string; branchId?: number; origin?: string }) =>
      apiFetch<{ id: number; amount: string }>('/deposits', { method: 'PATCH', body: JSON.stringify(body) }),
    getAudit: (year: number, month: number, branchId?: number, method?: string) => {
      const qs = new URLSearchParams({ year: String(year), month: String(month) });
      if (branchId) qs.set('branchId', String(branchId));
      if (method) qs.set('method', method);
      return apiFetch<DepositAuditEntry[]>(`/deposits/audit?${qs}`);
    },
  },

  branches: {
    list: (activeOnly?: boolean) =>
      apiFetch<Branch[]>(`/branches${activeOnly ? '?active=1' : ''}`),
    create: (body: { name: string; streetName?: string; barangay?: string; city?: string; province?: string; country?: string; phone?: string }) =>
      apiFetch<Branch>('/branches', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: Partial<{ name: string; streetName: string | null; barangay: string | null; city: string | null; province: string | null; country: string | null; phone: string | null; isActive: boolean }>) =>
      apiFetch<Branch>(`/branches/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  },

  uploads: {
    presignedUrl: (body: { txnId: number; itemId?: number; type: 'before' | 'after'; extension: string }) =>
      apiFetch<{ signedUrl: string; token: string; path: string; publicUrl: string }>('/uploads/presigned-url', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },

  reports: {
    summary: (year: number, month: number, branchId?: number) => {
      const qs = new URLSearchParams({ year: String(year), month: String(month) });
      if (branchId) qs.set('branchId', String(branchId));
      return apiFetch<ReportSummary>(`/reports/summary?${qs}`);
    },
  },
};
