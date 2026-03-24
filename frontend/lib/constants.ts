export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
  CLAIMED: 'claimed',
  CANCELLED: 'cancelled',
} as const;

export type TransactionStatus = typeof TRANSACTION_STATUS[keyof typeof TRANSACTION_STATUS];

export const ITEM_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
  CLAIMED: 'claimed',
  CANCELLED: 'cancelled',
} as const;

export type ItemStatus = typeof ITEM_STATUS[keyof typeof ITEM_STATUS];

export const PAYMENT_METHOD = {
  CASH: 'cash',
  GCASH: 'gcash',
  CARD: 'card',
  BANK_DEPOSIT: 'bank_deposit',
} as const;

export type PaymentMethod = typeof PAYMENT_METHOD[keyof typeof PAYMENT_METHOD];

// ---------------------------------------------------------------------------
// Card bank options — must mirror backend CARD_BANK_FEES in db/constants.ts
// Frontend uses for display only; authoritative fee always computed server-side
// ---------------------------------------------------------------------------
export const CARD_BANK_OPTIONS = [
  { value: '', label: 'Default (3%)' },
  { value: 'bpi', label: 'BPI (3.5%)' },
] as const;

/** Display-only fee rate for the payment dialog preview.
 *  Actual authoritative fee is computed and stored by the backend. */
export function getCardFeeRatePreview(cardBank: string): number {
  if (cardBank === 'bpi') return 0.035;
  return 0.03;
}

export const SERVICE_TYPE = {
  PRIMARY: 'primary',
  ADD_ON: 'add_on',
} as const;

export type ServiceType = typeof SERVICE_TYPE[keyof typeof SERVICE_TYPE];

export const TRANSACTION_STATUS_VALUES = Object.values(TRANSACTION_STATUS);
export const ITEM_STATUS_VALUES = Object.values(ITEM_STATUS);
export const PAYMENT_METHOD_VALUES = Object.values(PAYMENT_METHOD);
