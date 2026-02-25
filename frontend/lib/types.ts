import { ItemStatus, PaymentMethod, ServiceType, TransactionStatus } from './constants';

export interface User {
  id: string;
  email?: string;
  phone?: string;
}

export type { TransactionStatus, ItemStatus, PaymentMethod, ServiceType } from './constants';

export interface Service {
  id: number;
  name: string;
  type: ServiceType;
  price: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface Promo {
  id: number;
  name: string;
  code: string;
  percent: string;
  dateFrom: string | null;
  dateTo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface TransactionItem {
  id: number;
  transactionId: number;
  shoeDescription: string | null;
  serviceId: number | null;
  status: ItemStatus;
  beforeImageUrl: string | null;
  afterImageUrl: string | null;
  price: string | null;
}

export interface ClaimPayment {
  id: number;
  transactionId: number;
  method: PaymentMethod;
  amount: string;
  paidAt: string;
}

export interface Transaction {
  id: number;
  number: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  status: TransactionStatus;
  note: string | null;
  pickupDate: string | null;
  total: string;
  paid: string;
  promoId: number | null;
  createdAt: string;
  claimedAt: string | null;
  updatedAt: string | null;
  items?: TransactionItem[];
  payments?: ClaimPayment[];
}

export interface Expense {
  id: number;
  dateKey: string;
  category: string | null;
  note: string | null;
  amount: string;
  createdAt: string;
}

export interface ExpenseSummary {
  dateKey: string;
  total: string;
}

export interface AuditEntry {
  id: number;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string | null;
  source: string | null;
  performedBy: string | null;
  details: Record<string, unknown> | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
}

export interface AppUser {
  id: string;
  email: string;
  userType: 'admin' | 'staff' | 'superadmin';
  createdAt: string;
}
