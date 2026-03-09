import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toTitleCase } from '@/utils/text';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPeso(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '₱0.00';
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  // If already a full ISO datetime, parse directly; otherwise append time to avoid UTC shift
  const d = new Date(value.includes('T') ? value : value + 'T00:00:00');
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Format PH address as "Purok III Dapitan, Cordova, Cebu" — country omitted from display
export function formatAddress(parts: {
  streetName?: string | null;
  barangay?: string | null;
  city?: string | null;
  province?: string | null;
}): string {
  const { streetName, barangay, city, province } = parts;
  const localPart = [toTitleCase(streetName), toTitleCase(barangay)].filter(Boolean).join(' ');
  return [localPart, toTitleCase(city), toTitleCase(province)].filter(Boolean).join(', ') || '—';
}

export function formatDatetime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function today(): string {
  return new Date().toISOString().split('T')[0];
}

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Done',
  claimed: 'Claimed',
  cancelled: 'Cancelled',
};

export const STATUS_COLORS: Record<string, string> = {
  pending: 'text-zinc-600 bg-zinc-100',
  in_progress: 'text-blue-600 bg-blue-100',
  done: 'text-emerald-700 bg-emerald-100',
  claimed: 'text-violet-700 bg-violet-100',
  cancelled: 'text-red-500 bg-red-100',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  gcash: 'GCash',
  card: 'Card',
  bank_deposit: 'Bank Deposit',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? 'text-zinc-500 bg-zinc-100';
}
