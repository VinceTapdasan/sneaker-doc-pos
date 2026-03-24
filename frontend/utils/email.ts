import { formatDate, formatPeso } from '@/lib/utils';
import { toTitleCase } from './text';

interface EmailTemplate {
  subject: string;
  body: string;
}

interface TransactionEmailContext {
  number: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  pickupDate: string | null;
  newPickupDate?: string | null;
  total: string;
  paid: string;
  items?: { shoeDescription: string | null; price: string | null }[];
}

function balance(ctx: TransactionEmailContext): number {
  return parseFloat(ctx.total) - parseFloat(ctx.paid);
}

export const EMAIL_TEMPLATES = {
  pickup_ready: 'pickup_ready',
  payment_reminder: 'payment_reminder',
  new_pickup_date: 'new_pickup_date',
  claim_stub: 'claim_stub',
} as const;

export type EmailTemplateKey = typeof EMAIL_TEMPLATES[keyof typeof EMAIL_TEMPLATES];

export const EMAIL_TEMPLATE_LABELS: Record<EmailTemplateKey, string> = {
  pickup_ready: 'Shoes Ready for Pickup',
  payment_reminder: 'Payment Reminder',
  new_pickup_date: 'Updated Pickup Date',
  claim_stub: 'Claim Stub',
};

function buildTemplate(key: EmailTemplateKey, ctx: TransactionEmailContext): EmailTemplate {
  const name = toTitleCase(ctx.customerName) || 'Customer';
  const bal = balance(ctx);

  switch (key) {
    case EMAIL_TEMPLATES.pickup_ready: {
      const effectiveDate = ctx.newPickupDate ?? ctx.pickupDate;
      return {
        subject: `Your sneakers are ready for pickup! — Txn #${ctx.number}`,
        body: [
          `Hi ${name},`,
          '',
          `Great news! Your shoe(s) from Sneaker Doctor are ready for pickup.`,
          '',
          `Transaction: #${ctx.number}`,
          `Pickup Date: ${formatDate(effectiveDate)}`,
          ...(bal > 0 ? [`Balance due: ${formatPeso(bal)}`] : ['Balance: Fully paid']),
          '',
          `Please bring this reference number when you come in.`,
          '',
          `See you soon!`,
          `— Sneaker Doctor`,
        ].join('\n'),
      };
    }

    case EMAIL_TEMPLATES.payment_reminder:
      return {
        subject: `Payment reminder — Txn #${ctx.number} — Sneaker Doctor`,
        body: [
          `Hi ${name},`,
          '',
          `This is a friendly reminder that you have an outstanding balance for your transaction with Sneaker Doctor.`,
          '',
          `Transaction: #${ctx.number}`,
          `Total: ${formatPeso(ctx.total)}`,
          `Paid: ${formatPeso(ctx.paid)}`,
          `Balance due: ${formatPeso(bal)}`,
          '',
          `Please settle your balance upon pickup. Thank you!`,
          '',
          `— Sneaker Doctor`,
        ].join('\n'),
      };

    case EMAIL_TEMPLATES.new_pickup_date:
      return {
        subject: `Pickup date updated — Txn #${ctx.number} — Sneaker Doctor`,
        body: [
          `Hi ${name},`,
          '',
          `We wanted to let you know that your pickup date for transaction #${ctx.number} has been updated.`,
          '',
          `New Pickup Date: ${formatDate(ctx.newPickupDate ?? ctx.pickupDate)}`,
          '',
          `We appreciate your patience and will have your shoes ready by then.`,
          '',
          `— Sneaker Doctor`,
        ].join('\n'),
      };

    case EMAIL_TEMPLATES.claim_stub: {
      const sep = '--------------------------------';
      const itemLines = (ctx.items ?? []).map(
        (item, i) => `${i + 1}. ${item.shoeDescription || 'Item'}`.padEnd(24) + formatPeso(item.price ?? '0'),
      );
      return {
        subject: `Your Claim Stub — #${ctx.number} | Sneaker Doctor`,
        body: [
          `         SNEAKER DOCTOR`,
          `           CLAIM STUB`,
          sep,
          `           #${ctx.number}`,
          sep,
          `Customer : ${name}`,
          `Phone    : ${ctx.customerPhone || '—'}`,
          `Pickup   : ${formatDate(ctx.pickupDate)}`,
          sep,
          ...itemLines,
          sep,
          `Total    : ${formatPeso(ctx.total)}`,
          `Paid     : ${formatPeso(ctx.paid)}`,
          `Balance  : ${bal <= 0 ? 'Fully Paid' : formatPeso(bal)}`,
          sep,
          `Present this stub when claiming your shoes.`,
          '',
          `— Sneaker Doctor`,
        ].join('\n'),
      };
    }
  }
}

const SENDER_EMAIL = 'info.sneakerdoctorph@gmail.com';

export function generateGmailLink(ctx: TransactionEmailContext, templateKey: EmailTemplateKey): string {
  if (!ctx.customerEmail) return '';
  const { subject, body } = buildTemplate(templateKey, ctx);
  const params = new URLSearchParams({ view: 'cm', to: ctx.customerEmail, su: subject, body });
  return `https://mail.google.com/mail/u/?authuser=${SENDER_EMAIL}&${params.toString()}`;
}

// Opens Gmail compose with only to + subject pre-filled (no body) — used when body is pasted manually
export function generateGmailLinkNoBody(ctx: TransactionEmailContext, templateKey: EmailTemplateKey): string {
  if (!ctx.customerEmail) return '';
  const { subject } = buildTemplate(templateKey, ctx);
  const params = new URLSearchParams({ view: 'cm', to: ctx.customerEmail, su: subject });
  return `https://mail.google.com/mail/u/?authuser=${SENDER_EMAIL}&${params.toString()}`;
}

/**
 * Opens a URL in a new tab in a way that works reliably across:
 * - Desktop browsers
 * - Mobile browsers (iOS Safari, Android Chrome)
 * - PWA standalone mode (where window.open is often blocked)
 *
 * Uses a temporary anchor element instead of window.open to bypass
 * mobile popup blockers and PWA restrictions.
 */
export function openLinkReliably(url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
