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
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = pdfFileName(invoice);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
