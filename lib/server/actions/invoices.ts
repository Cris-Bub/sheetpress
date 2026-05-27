'use server';

import {
  createInvoiceDraft,
  deleteInvoiceDraft,
  duplicateInvoice,
  getInvoice,
  listInvoices,
  markInvoiceSent,
  replaceInvoiceLineItems,
  updateInvoice,
  voidInvoice,
} from '@/lib/server/repo/invoices';
import type { Invoice, LineItem } from '@/lib/types';

export async function listInvoicesAction(): Promise<Invoice[]> {
  return listInvoices();
}

export async function getInvoiceAction(id: string): Promise<Invoice | null> {
  return getInvoice(id);
}

export async function createInvoiceDraftAction(): Promise<Invoice> {
  return createInvoiceDraft();
}

export async function updateInvoiceAction(
  id: string,
  patch: Partial<Omit<Invoice, 'lineItems' | 'createdAt' | 'updatedAt'>>,
  items?: LineItem[],
): Promise<void> {
  if (Object.keys(patch).length > 0) {
    await updateInvoice(id, patch);
  }
  if (items) {
    await replaceInvoiceLineItems(id, items);
  }
}

export async function deleteInvoiceDraftAction(id: string): Promise<void> {
  return deleteInvoiceDraft(id);
}

export async function markInvoiceSentAction(id: string): Promise<void> {
  return markInvoiceSent(id);
}

export async function voidInvoiceAction(id: string): Promise<void> {
  return voidInvoice(id);
}

export async function duplicateInvoiceAction(sourceId: string): Promise<Invoice> {
  return duplicateInvoice(sourceId);
}
