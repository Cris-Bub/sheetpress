import type { Invoice, InvoiceStatus, Payment } from './types';
import { computeTotals, isOverdue } from './format';

export function paidAmountFor(invoiceId: string, payments: Payment[]): number {
  return payments
    .filter((p) => p.invoiceId === invoiceId)
    .reduce((s, p) => s + p.amount, 0);
}

export function paymentRatio(invoice: Invoice, payments: Payment[]): number {
  const total = computeTotals(invoice).total;
  if (total === 0) return 0;
  const paid = paidAmountFor(invoice.id, payments);
  return Math.min(1, Math.max(0, paid / total));
}

export function effectiveStatus(invoice: Invoice, payments: Payment[], now = new Date()): InvoiceStatus {
  if (invoice.status === 'draft' || invoice.status === 'void' || invoice.status === 'paid') {
    return invoice.status;
  }
  const paid = paidAmountFor(invoice.id, payments);
  if (isOverdue(invoice, paid, now)) return 'overdue';
  return invoice.status;
}

export function daysOverdue(invoice: Invoice, now = new Date()): number {
  const due = new Date(invoice.dueDate);
  const ms = now.getTime() - due.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export type Money = { amount: number; currency: string };

function add(map: Map<string, number>, currency: string, amount: number) {
  map.set(currency, (map.get(currency) ?? 0) + amount);
}

export function outstandingByCurrency(invoices: Invoice[], payments: Payment[]): Money[] {
  const m = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.status === 'draft' || inv.status === 'void' || inv.status === 'paid') continue;
    const total = computeTotals(inv).total;
    const paid = paidAmountFor(inv.id, payments);
    const due = Math.max(0, total - paid);
    if (due === 0) continue;
    add(m, inv.currency, due);
  }
  return Array.from(m.entries()).map(([currency, amount]) => ({ currency, amount }));
}

export function paidThisYearByCurrency(invoices: Invoice[], payments: Payment[], year: number): Money[] {
  const m = new Map<string, number>();
  for (const p of payments) {
    if (new Date(p.date).getFullYear() !== year) continue;
    const inv = invoices.find((i) => i.id === p.invoiceId);
    if (!inv || inv.status === 'void') continue;
    add(m, inv.currency, p.amount);
  }
  return Array.from(m.entries()).map(([currency, amount]) => ({ currency, amount }));
}

export function overdueCount(invoices: Invoice[], payments: Payment[], now = new Date()): number {
  return invoices.filter((inv) => effectiveStatus(inv, payments, now) === 'overdue').length;
}

/** Pulls one currency's total from a Money[] (default 0). */
export function pickCurrency(monies: Money[], currency: string): number {
  return monies.find((m) => m.currency === currency)?.amount ?? 0;
}

/** Returns Money entries excluding the given currency. */
export function otherCurrencies(monies: Money[], currency: string): Money[] {
  return monies.filter((m) => m.currency !== currency && m.amount > 0);
}

/** Breakdown of YTD billings in a single currency by effective status. */
export type StatusBreakdown = Record<InvoiceStatus, number>;

export function ytdBreakdown(
  invoices: Invoice[],
  payments: Payment[],
  year: number,
  currency: string,
  now = new Date(),
): { totals: StatusBreakdown; total: number } {
  const totals: StatusBreakdown = {
    draft: 0, sent: 0, partial: 0, overdue: 0, paid: 0, void: 0,
  };
  for (const inv of invoices) {
    if (inv.currency !== currency) continue;
    if (new Date(inv.issueDate).getFullYear() !== year) continue;
    const status = effectiveStatus(inv, payments, now);
    if (status === 'void') continue;
    totals[status] += computeTotals(inv).total;
  }
  const total = Object.values(totals).reduce((s, v) => s + v, 0);
  return { totals, total };
}

/** Monthly payment totals for a given currency, returning 12 months [Jan..Dec]. */
export function monthlyPaymentsForYear(
  invoices: Invoice[],
  payments: Payment[],
  year: number,
  currency: string,
): number[] {
  const months = new Array(12).fill(0);
  for (const p of payments) {
    const d = new Date(p.date);
    if (d.getFullYear() !== year) continue;
    const inv = invoices.find((i) => i.id === p.invoiceId);
    if (!inv || inv.currency !== currency || inv.status === 'void') continue;
    months[d.getMonth()] += p.amount;
  }
  return months;
}

/** EU member states (ISO 3166-1 alpha-2). Used to detect intra-community supplies. */
const EU_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI',
  'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT',
  'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
]);

/** True if the seller (profile) and client are in two different EU member states
 *  and the seller has a VAT ID — a reverse-charge / intra-community supply scenario. */
export function isIntraCommunitySupply(invoice: Invoice): boolean {
  const sellerCountry = invoice.profileSnapshot.address?.country?.toUpperCase();
  const buyerCountry = invoice.clientSnapshot?.address?.country?.toUpperCase();
  if (!sellerCountry || !buyerCountry) return false;
  if (!EU_COUNTRIES.has(sellerCountry) || !EU_COUNTRIES.has(buyerCountry)) return false;
  if (sellerCountry === buyerCountry) return false;
  if (!invoice.profileSnapshot.taxId) return false;
  return true;
}

/** Years that have any invoice or payment activity. Current year always included. Descending. */
export function availableYears(invoices: Invoice[], payments: Payment[], now = new Date()): number[] {
  const years = new Set<number>([now.getFullYear()]);
  for (const inv of invoices) years.add(new Date(inv.issueDate).getFullYear());
  for (const p of payments) years.add(new Date(p.date).getFullYear());
  return Array.from(years).sort((a, b) => b - a);
}

/** Total tax collected on the PAID portion of invoices in a given year, by currency.
 *  Tax is allocated pro-rata: a half-paid invoice contributes half its tax. */
export function taxCollectedByCurrency(
  invoices: Invoice[],
  payments: Payment[],
  year: number,
): Money[] {
  const m = new Map<string, number>();
  for (const p of payments) {
    if (new Date(p.date).getFullYear() !== year) continue;
    const inv = invoices.find((i) => i.id === p.invoiceId);
    if (!inv || inv.status === 'void') continue;
    const totals = computeTotals(inv);
    if (totals.total === 0) continue;
    const share = (p.amount / totals.total) * totals.tax;
    add(m, inv.currency, Math.round(share));
  }
  return Array.from(m.entries()).map(([currency, amount]) => ({ currency, amount }));
}
