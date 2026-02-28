import type { Service, Promo } from '@/lib/types';

interface PricedItem {
  primaryServiceId?: string;
  addonServiceIds?: string[];
}

// Price for a single item: primary service + all add-ons
export function calcItemPrice(item: PricedItem, services: Service[]): number {
  const primarySvc = item.primaryServiceId
    ? services.find((s) => s.id === parseInt(item.primaryServiceId!, 10))
    : null;
  const addonTotal = (item.addonServiceIds ?? []).reduce((sum, id) => {
    const svc = services.find((s) => s.id === parseInt(id, 10));
    return sum + (svc ? parseFloat(svc.price) : 0);
  }, 0);
  return (primarySvc ? parseFloat(primarySvc.price) : 0) + addonTotal;
}

// Sum of all item prices before promo
export function calcRawTotal(items: PricedItem[], services: Service[]): number {
  return items.reduce((sum, item) => sum + calcItemPrice(item, services), 0);
}

// Find a promo by id string, returns null for 'none'/empty/not found
export function findPromo(promoId: string | undefined, promos: Promo[]): Promo | null {
  if (!promoId || promoId === 'none') return null;
  return promos.find((p) => String(p.id) === promoId) ?? null;
}

// Apply promo discount to a raw total
export function applyPromo(rawTotal: number, promo: Promo | null): number {
  if (!promo) return rawTotal;
  return rawTotal * (1 - parseFloat(promo.percent) / 100);
}
