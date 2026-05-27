'use client';

import JSZip from 'jszip';
import { listProfilesAction } from '@/lib/server/actions/profiles';
import { listClientsAction } from '@/lib/server/actions/clients';
import { listInvoicesAction } from '@/lib/server/actions/invoices';
import { listPaymentsAction } from '@/lib/server/actions/payments';
import { importBackupJsonAction, type ImportResult } from '@/lib/server/actions/backup';
import { setSetting, wipeAllData } from './mutations';
import { renderInvoiceToBlob, pdfFileName } from './pdf';
import { computeTotals, toMajor } from './format';
import { paidAmountFor } from './derive';
import { getQueryClient } from './query-client';
import type { Invoice, Payment } from './types';

const BACKUP_VERSION = 1;

// ---- helpers (lifted from the local-first backup.ts) ----

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

// ---- exports ----

export async function exportEverything(): Promise<{ invoiceCount: number; pdfCount: number }> {
  const [profiles, clients, invoices, payments] = await Promise.all([
    listProfilesAction(),
    listClientsAction(),
    listInvoicesAction(),
    listPaymentsAction(),
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
      console.warn(`Failed to render PDF for ${inv.number}:`, err);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(zipBlob, `sheetpress-backup-${todayStamp()}.zip`);
  await setSetting('lastBackupAt', new Date().toISOString());

  return { invoiceCount: invoices.length, pdfCount };
}

export async function exportTaxYear(year: number): Promise<{
  invoiceCount: number;
  paymentCount: number;
  pdfCount: number;
}> {
  const [invoices, payments] = await Promise.all([listInvoicesAction(), listPaymentsAction()]);

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

export async function importBackup(file: File): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(file);
  const dataFile = zip.file('data.json');
  if (!dataFile) throw new Error('Invalid backup: missing data.json');
  const json = await dataFile.async('string');
  const result = await importBackupJsonAction(json);
  if (typeof window !== 'undefined') {
    getQueryClient().clear();
  }
  return result;
}

export async function wipeWithConfirm(): Promise<void> {
  await wipeAllData();
}
