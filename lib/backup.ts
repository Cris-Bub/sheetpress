import JSZip from 'jszip';
import { db } from './db';
import { setSetting, wipeAllData } from './mutations';
import { renderInvoiceToBlob, pdfFileName } from './pdf';
import { computeTotals, toMajor } from './format';
import { paidAmountFor } from './derive';
import type { Client, Invoice, Payment, Profile } from './types';
import { z } from 'zod';

const BACKUP_VERSION = 1;

const AddressSchema = z.object({
  line1: z.string(),
  line2: z.string().optional(),
  city: z.string(),
  region: z.string().optional(),
  postalCode: z.string(),
  country: z.string(),
});

const ProfileSchema = z.object({
  id: z.string(),
  businessName: z.string(),
  legalName: z.string().optional(),
  taxId: z.string().optional(),
  taxIdLabel: z.string().optional(),
  email: z.string(),
  phone: z.string().optional(),
  address: AddressSchema,
  logoDataUrl: z.string().optional(),
  defaultPaymentInstructions: z.string().optional(),
  defaultPaymentTermsDays: z.number(),
  defaultNotes: z.string().optional(),
  defaultCurrency: z.string(),
  defaultTaxRate: z.number().optional(),
  accentColor: z.string(),
  invoiceNumberFormat: z.string(),
  nextInvoiceNumber: z.number(),
});

const ClientSchema = z.object({
  id: z.string(),
  name: z.string(),
  contactName: z.string().optional(),
  email: z.string().optional(),
  taxId: z.string().optional(),
  address: AddressSchema.optional(),
  defaultCurrency: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
  archivedAt: z.string().optional(),
});

const LineItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  taxRate: z.number().optional(),
});

const InvoiceSchema = z.object({
  id: z.string(),
  number: z.string(),
  profileId: z.string(),
  clientId: z.string(),
  clientSnapshot: ClientSchema,
  profileSnapshot: ProfileSchema,
  issueDate: z.string(),
  dueDate: z.string(),
  currency: z.string(),
  lineItems: z.array(LineItemSchema),
  defaultTaxRate: z.number().optional(),
  discount: z
    .union([
      z.object({ type: z.literal('percent'), value: z.number() }),
      z.object({ type: z.literal('amount'), value: z.number() }),
    ])
    .optional(),
  notes: z.string().optional(),
  paymentInstructions: z.string().optional(),
  status: z.enum(['draft', 'sent', 'paid', 'partial', 'overdue', 'void']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const PaymentSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  date: z.string(),
  amount: z.number(),
  method: z.string().optional(),
  note: z.string().optional(),
});

const BackupSchema = z.object({
  version: z.number(),
  exportedAt: z.string(),
  profiles: z.array(ProfileSchema),
  clients: z.array(ClientSchema),
  invoices: z.array(InvoiceSchema),
  payments: z.array(PaymentSchema),
});

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(cells: (string | number | undefined | null)[]): string {
  return cells.map(csvCell).join(',');
}

function invoicesCsv(invoices: Invoice[], payments: Payment[]): string {
  const header = [
    'number', 'issue_date', 'due_date', 'status',
    'client_name', 'client_tax_id', 'client_country',
    'currency', 'subtotal', 'discount', 'tax', 'total', 'paid', 'balance',
    'notes',
  ];
  const rows = [csvRow(header)];
  for (const inv of invoices) {
    const t = computeTotals(inv);
    const paid = paidAmountFor(inv.id, payments);
    const balance = Math.max(0, t.total - paid);
    rows.push(csvRow([
      inv.number,
      inv.issueDate,
      inv.dueDate,
      inv.status,
      inv.clientSnapshot?.name ?? '',
      inv.clientSnapshot?.taxId ?? '',
      inv.clientSnapshot?.address?.country ?? '',
      inv.currency,
      toMajor(t.subtotal, inv.currency).toFixed(2),
      toMajor(t.discount, inv.currency).toFixed(2),
      toMajor(t.tax, inv.currency).toFixed(2),
      toMajor(t.total, inv.currency).toFixed(2),
      toMajor(paid, inv.currency).toFixed(2),
      toMajor(balance, inv.currency).toFixed(2),
      inv.notes ?? '',
    ]));
  }
  return rows.join('\n');
}

function paymentsCsv(invoices: Invoice[], payments: Payment[]): string {
  const header = ['payment_date', 'invoice_number', 'client_name', 'amount', 'currency', 'method', 'note'];
  const rows = [csvRow(header)];
  const invById = new Map(invoices.map((i) => [i.id, i]));
  for (const p of payments) {
    const inv = invById.get(p.invoiceId);
    rows.push(csvRow([
      p.date,
      inv?.number ?? '',
      inv?.clientSnapshot?.name ?? '',
      inv ? toMajor(p.amount, inv.currency).toFixed(2) : (p.amount / 100).toFixed(2),
      inv?.currency ?? '',
      p.method ?? '',
      p.note ?? '',
    ]));
  }
  return rows.join('\n');
}

/**
 * Builds a ZIP containing `data.json`, `invoices.csv`, `payments.csv`, and one PDF
 * per non-draft, non-void invoice. Triggers a browser download and records
 * `lastBackupAt` in settings.
 */
export async function exportEverything(): Promise<{ invoiceCount: number; pdfCount: number }> {
  const [profiles, clients, invoices, payments] = await Promise.all([
    db.profiles.toArray(),
    db.clients.toArray(),
    db.invoices.toArray(),
    db.payments.toArray(),
  ]);

  const data = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    profiles, clients, invoices, payments,
  };

  const zip = new JSZip();
  zip.file('data.json', JSON.stringify(data, null, 2));
  zip.file('invoices.csv', invoicesCsv(invoices, payments));
  zip.file('payments.csv', paymentsCsv(invoices, payments));

  const printable = invoices.filter((i) => i.status !== 'draft' && i.status !== 'void');
  const pdfFolder = zip.folder('invoices');
  let pdfCount = 0;
  for (const inv of printable) {
    try {
      const blob = await renderInvoiceToBlob(inv);
      pdfFolder!.file(pdfFileName(inv), blob);
      pdfCount++;
    } catch (err) {
      // PDF failures shouldn't block the whole export — the JSON still has the data.
      console.warn(`Failed to render PDF for ${inv.number}:`, err);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(zipBlob, `sheetpress-backup-${todayStamp()}.zip`);
  await setSetting('lastBackupAt', new Date().toISOString());

  return { invoiceCount: invoices.length, pdfCount };
}

/**
 * Builds a ZIP scoped to a single tax year: includes invoices issued OR paid in
 * the year, plus all payments dated in the year. Result is `sheetpress-{year}-tax.zip`.
 */
export async function exportTaxYear(year: number): Promise<{ invoiceCount: number; paymentCount: number; pdfCount: number }> {
  const [invoices, payments] = await Promise.all([
    db.invoices.toArray(),
    db.payments.toArray(),
  ]);

  const yearPayments = payments.filter((p) => new Date(p.date).getFullYear() === year);
  const paymentInvoiceIds = new Set(yearPayments.map((p) => p.invoiceId));
  const yearInvoices = invoices.filter((inv) => {
    if (inv.status === 'void') return false;
    const issuedInYear = new Date(inv.issueDate).getFullYear() === year;
    return issuedInYear || paymentInvoiceIds.has(inv.id);
  });

  const zip = new JSZip();
  zip.file('invoices.csv', invoicesCsv(yearInvoices, yearPayments));
  zip.file('payments.csv', paymentsCsv(yearInvoices, yearPayments));
  zip.file(
    'README.txt',
    [
      `sheetPress — tax year ${year} export`,
      '',
      `Generated: ${new Date().toISOString()}`,
      `Invoices: ${yearInvoices.length} (issued or paid in ${year}; void excluded)`,
      `Payments: ${yearPayments.length} (dated in ${year})`,
      '',
      'Files:',
      '  invoices.csv  — one row per invoice with subtotal, tax, total, paid, balance.',
      '  payments.csv  — one row per payment with date, method, amount.',
      '  invoices/     — PDF copy of each non-draft invoice.',
      '',
      'Money columns are in major units (e.g. 50.00 = $50.00).',
    ].join('\n'),
  );

  const printable = yearInvoices.filter((i) => i.status !== 'draft');
  const pdfFolder = zip.folder('invoices');
  let pdfCount = 0;
  for (const inv of printable) {
    try {
      const blob = await renderInvoiceToBlob(inv);
      pdfFolder!.file(pdfFileName(inv), blob);
      pdfCount++;
    } catch (err) {
      console.warn(`Failed to render PDF for ${inv.number}:`, err);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(zipBlob, `sheetpress-${year}-tax.zip`);

  return { invoiceCount: yearInvoices.length, paymentCount: yearPayments.length, pdfCount };
}

/**
 * Reads a backup ZIP, validates the JSON shape with Zod, and writes the data
 * back to Dexie in a single transaction. Dedupes invoices by (number, issueDate).
 */
export async function importBackup(file: File): Promise<{
  profiles: number; clients: number; invoices: number; payments: number; skipped: number;
}> {
  const zip = await JSZip.loadAsync(file);
  const dataFile = zip.file('data.json');
  if (!dataFile) throw new Error('Invalid backup: missing data.json');
  const json = JSON.parse(await dataFile.async('string'));
  const parsed = BackupSchema.parse(json);

  return db.transaction('rw', db.profiles, db.clients, db.invoices, db.payments, async () => {
    const existingInvoices = await db.invoices.toArray();
    const seen = new Set(existingInvoices.map((i) => `${i.number}@${i.issueDate}`));

    await db.profiles.bulkPut(parsed.profiles);
    await db.clients.bulkPut(parsed.clients);

    let skipped = 0;
    const toAdd: Invoice[] = [];
    for (const inv of parsed.invoices as Invoice[]) {
      const key = `${inv.number}@${inv.issueDate}`;
      if (seen.has(key)) { skipped++; continue; }
      seen.add(key);
      toAdd.push(inv);
    }
    await db.invoices.bulkPut(toAdd);
    await db.payments.bulkPut(parsed.payments as Payment[]);

    return {
      profiles: parsed.profiles.length,
      clients: parsed.clients.length,
      invoices: toAdd.length,
      payments: parsed.payments.length,
      skipped,
    };
  });
}

export async function wipeWithConfirm(): Promise<void> {
  await wipeAllData();
}

// Reuse the type-only marker
export type _Unused = Profile & Client & Invoice & Payment;
