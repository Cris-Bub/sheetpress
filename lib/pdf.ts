import { pdf, type DocumentProps } from '@react-pdf/renderer';
import { InvoicePdfDocument } from '@/components/app/invoice-pdf-document';
import type { Invoice } from './types';
import { createElement, type ReactElement } from 'react';

function sanitizeFileNamePart(s: string): string {
  return s.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'sheetpress';
}

export function pdfFileName(invoice: Invoice): string {
  const biz = sanitizeFileNamePart(invoice.profileSnapshot.businessName);
  return `${biz}-${invoice.number}.pdf`;
}

export async function renderInvoiceToBlob(invoice: Invoice): Promise<Blob> {
  // InvoicePdfDocument returns <Document>; cast to satisfy react-pdf's `pdf()` typing.
  const doc = createElement(InvoicePdfDocument, { invoice }) as unknown as ReactElement<DocumentProps>;
  return pdf(doc).toBlob();
}

export async function downloadInvoicePdf(invoice: Invoice): Promise<void> {
  const blob = await renderInvoiceToBlob(invoice);
  const filename = pdfFileName(invoice);

  // Prefer the File System Access API (Chrome 86+). It opens a browser-
  // managed save dialog that works reliably after async operations — the
  // anchor-click fallback can be silently blocked by Chrome when the
  // original user-gesture activation has expired during PDF rendering.
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as unknown as FilePickerWindow).showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

type FilePickerWindow = {
  showSaveFilePicker(opts?: {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }): Promise<{ createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }> }>;
};
