import type { Discount, Invoice, LineItem } from './types';

const minorUnitsCache = new Map<string, number>();

function minorUnitsFor(currency: string): number {
  const cached = minorUnitsCache.get(currency);
  if (cached !== undefined) return cached;
  try {
    const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency });
    const opts = fmt.resolvedOptions();
    const digits = opts.maximumFractionDigits ?? 2;
    minorUnitsCache.set(currency, digits);
    return digits;
  } catch {
    minorUnitsCache.set(currency, 2);
    return 2;
  }
}

export function formatMoney(minor: number, currency: string, locale = 'en-US'): string {
  const digits = minorUnitsFor(currency);
  const major = minor / Math.pow(10, digits);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(major);
}

export function toMinor(major: number, currency: string): number {
  const digits = minorUnitsFor(currency);
  return Math.round(major * Math.pow(10, digits));
}

export function toMajor(minor: number, currency: string): number {
  const digits = minorUnitsFor(currency);
  return minor / Math.pow(10, digits);
}

// A bare `YYYY-MM-DD` is parsed by `new Date()` as UTC midnight, which then shifts
// back a day when formatted in a negative-UTC-offset locale. Parse as a local date
// so the displayed day always matches what the user typed.
function parseISODate(iso: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(iso);
}

export function formatDate(iso: string, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(parseISODate(iso));
}

export function formatDateShort(iso: string, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  }).format(parseISODate(iso));
}

export function lineSubtotal(item: LineItem): number {
  return Math.round(item.quantity * item.unitPrice);
}

export function lineTax(item: LineItem, fallbackRate?: number): number {
  const rate = item.taxRate ?? fallbackRate ?? 0;
  return Math.round((lineSubtotal(item) * rate) / 100);
}

export function applyDiscount(subtotal: number, discount?: Discount): number {
  if (!discount) return 0;
  if (discount.type === 'percent') {
    return Math.round((subtotal * discount.value) / 100);
  }
  return Math.min(discount.value, subtotal);
}

export type InvoiceTotals = {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
};

export function computeTotals(invoice: Invoice): InvoiceTotals {
  const subtotal = invoice.lineItems.reduce((s, i) => s + lineSubtotal(i), 0);
  const discount = applyDiscount(subtotal, invoice.discount);
  const taxable = subtotal - discount;
  const tax = invoice.lineItems.reduce((s, i) => {
    const ls = lineSubtotal(i);
    const share = subtotal === 0 ? 0 : (ls - (ls * discount) / subtotal);
    const rate = i.taxRate ?? invoice.defaultTaxRate ?? 0;
    return s + Math.round((share * rate) / 100);
  }, 0);
  void taxable;
  return { subtotal, discount, tax, total: subtotal - discount + tax };
}

export function balance(invoice: Invoice, paidAmount: number): number {
  return computeTotals(invoice).total - paidAmount;
}

export function isOverdue(invoice: Invoice, paidAmount: number, now = new Date()): boolean {
  if (invoice.status === 'paid' || invoice.status === 'void' || invoice.status === 'draft') return false;
  if (balance(invoice, paidAmount) <= 0) return false;
  return new Date(invoice.dueDate) < now;
}
