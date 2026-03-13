export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
  CLAIMED: 'claimed',
  CANCELLED: 'cancelled',
} as const;

export type TransactionStatus =
  (typeof TRANSACTION_STATUS)[keyof typeof TRANSACTION_STATUS];

export const ITEM_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
  CLAIMED: 'claimed',
  CANCELLED: 'cancelled',
} as const;

export type ItemStatus = (typeof ITEM_STATUS)[keyof typeof ITEM_STATUS];

export const PAYMENT_METHOD = {
  CASH: 'cash',
  GCASH: 'gcash',
  CARD: 'card',
  BANK_DEPOSIT: 'bank_deposit',
} as const;

export type PaymentMethod =
  (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

export const SERVICE_TYPE = {
  PRIMARY: 'primary',
  ADD_ON: 'add_on',
} as const;

export type ServiceType = (typeof SERVICE_TYPE)[keyof typeof SERVICE_TYPE];

export const USER_TYPE = {
  ADMIN: 'admin',
  STAFF: 'staff',
  SUPERADMIN: 'superadmin',
} as const;

export type UserType = (typeof USER_TYPE)[keyof typeof USER_TYPE];

export const AUDIT_TYPE = {
  TRANSACTION_CREATED: 'TRANSACTION_CREATED',
  TRANSACTION_UPDATED: 'TRANSACTION_UPDATED',
  PICKUP_RESCHEDULED: 'PICKUP_RESCHEDULED',
  TRANSACTION_STATUS_CHANGED: 'TRANSACTION_STATUS_CHANGED',
  TRANSACTION_CLAIMED: 'TRANSACTION_CLAIMED',
  TRANSACTION_CANCELLED: 'TRANSACTION_CANCELLED',
  ITEM_STATUS_CHANGED: 'ITEM_STATUS_CHANGED',
  PAYMENT_ADDED: 'PAYMENT_ADDED',
  EXPENSE_CREATED: 'EXPENSE_CREATED',
  SERVICE_UPDATED: 'SERVICE_UPDATED',
  TRANSACTION_ASSIGNED: 'TRANSACTION_ASSIGNED',
  TRANSACTION_DELETED: 'TRANSACTION_DELETED',
  TRANSACTION_RESTORED: 'TRANSACTION_RESTORED',
  SMS_SENT: 'SMS_SENT',
} as const;

export type AuditType = (typeof AUDIT_TYPE)[keyof typeof AUDIT_TYPE];

// Monetary audit types — used for revenue/collection deduplication in reports
export const MONETARY_AUDIT_TYPES: AuditType[] = [
  AUDIT_TYPE.TRANSACTION_CREATED,
  AUDIT_TYPE.PAYMENT_ADDED,
];
