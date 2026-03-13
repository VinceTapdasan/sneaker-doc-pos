import { ItemStatus, PaymentMethod, ServiceType, TransactionStatus } from './constants';

export interface Branch {
  id: number;
  name: string;
  streetName: string | null;
  barangay: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  email?: string;
  phone?: string;
}

export type { TransactionStatus, ItemStatus, PaymentMethod, ServiceType } from './constants';

export interface Customer {
  id: number;
  phone: string;
  name: string | null;
  email: string | null;
  streetName: string | null;
  city: string | null;
  country: string | null;
  createdAt: string;
  updatedAt: string | null;
  shoesCount?: number;
}

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
  service?: { id: number; name: string; type: string } | null;
  addonServices?: { id: number; name: string; type: string }[] | null;
}

export interface ClaimPayment {
  id: number;
  transactionId: number;
  method: PaymentMethod;
  amount: string;
  referenceNumber: string | null;
  paidAt: string;
}

export interface TransactionPhoto {
  id: number;
  transactionId: number;
  type: 'before' | 'after';
  url: string;
  createdAt: string;
}

export interface AssignableUser {
  id: string;
  nickname: string | null;
  fullName: string | null;
  email: string;
  userType: string;
  branchId: number | null;
}

export interface Transaction {
  id: number;
  number: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerStreetName: string | null;
  customerCity: string | null;
  status: TransactionStatus;
  note: string | null;
  pickupDate: string | null;
  newPickupDate: string | null;
  total: string;
  paid: string;
  promoId: number | null;
  branchId: number | null;
  staffId?: string | null;
  createdAt: string;
  claimedAt: string | null;
  deletedAt: string | null;
  updatedAt: string | null;
  staffNickname?: string | null;
  branchName?: string | null;
  branchStreetName?: string | null;
  branchBarangay?: string | null;
  branchCity?: string | null;
  branchProvince?: string | null;
  branchPhone?: string | null;
  promo?: Promo | null;
  items?: TransactionItem[];
  payments?: ClaimPayment[];
  photos?: TransactionPhoto[];
}

export interface Expense {
  id: number;
  dateKey: string;
  category: string | null;
  note: string | null;
  method: string | null;
  amount: string;
  staffId: string | null;
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
  auditType: string | null;
  entityType: string;
  entityId: string | null;
  source: string | null;
  performedBy: string | null;
  performedByEmail: string | null;
  performedByFullName: string | null;
  branchId: number | null;
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
  nickname: string | null;
  fullName: string | null;
  contactNumber: string | null;
  birthday: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactNumber: string | null;
  userType: 'admin' | 'staff' | 'superadmin';
  branchId: number | null;
  isActive: boolean;
  createdAt: string;
}

export interface StaffDocument {
  id: number;
  staffId: string;
  url: string;
  label: string | null;
  uploadedAt: string;
}

export interface DepositAuditEntry {
  id: number;
  createdAt: string;
  performedBy: string | null;
  performedByEmail: string | null;
  branchId: number | null;
  details: {
    year: number;
    month: number;
    method: string;
    added: string;
    total: string;
  } | null;
}

export interface TodayCollection {
  id: number;
  transactionId: number;
  method: string;
  amount: string;
  paidAt: string;
  txnNumber: string;
  customerName: string | null;
}

export interface DashboardSummary {
  monthly: {
    transactionCount: number;
    totalRevenue: string;
    totalPaid: string;
    totalBalance: string;
    totalExpenses: string;
    netIncome: string;
    byStatus: Record<string, number> & { total: number };
  };
  collections: {
    cash: string;
    gcash: string;
    card: string;
    bank_deposit: string;
  };
  todayCollections: TodayCollection[];
  todayCollectionTotal: string;
  daily: {
    count: number;
    totalRevenue: string;
    totalPaid: string;
    totalBalance: string;
  };
}

export interface ReportSummary {
  collections: {
    cash: string;
    gcash: string;
    card: string;
    bank_deposit: string;
    total: string;
  };
  expenses: {
    total: string;
    items: Expense[];
  };
  transactions: {
    total: number;
    claimed: number;
    cancelled: number;
    pending: number;
    in_progress: number;
    done: number;
  };
  shoesCount: number;
  net: string;
  topServices: {
    name: string;
    count: number;
    revenue: string;
  }[];
  txnList: {
    id: number;
    number: string;
    customerName: string | null;
    createdAt: string;
    status: TransactionStatus;
    total: string;
    paid: string;
    itemCount: number;
  }[];
}
