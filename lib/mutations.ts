import { getQueryClient } from '@/lib/query-client';
import {
  createProfileAction,
  deleteProfileAction,
  setActiveProfileAction,
  updateProfileAction,
} from '@/lib/server/actions/profiles';
import {
  archiveClientAction,
  createClientAction,
  updateClientAction,
} from '@/lib/server/actions/clients';
import {
  createInvoiceDraftAction,
  deleteInvoiceDraftAction,
  duplicateInvoiceAction,
  markInvoiceSentAction,
  updateInvoiceAction,
  voidInvoiceAction,
} from '@/lib/server/actions/invoices';
import {
  deletePaymentAction,
  recordPaymentAction,
} from '@/lib/server/actions/payments';
import { setSettingAction } from '@/lib/server/actions/settings';
import { wipeWorkspaceDataAction } from '@/lib/server/actions/workspace';
import type { Client, Invoice, Payment, Profile } from './types';

function invalidate(keys: unknown[][]) {
  if (typeof window === 'undefined') return;
  const qc = getQueryClient();
  for (const key of keys) qc.invalidateQueries({ queryKey: key });
}

// ---------- Profile ----------

export async function createProfile(input: Omit<Profile, 'id'>): Promise<Profile> {
  const profile = await createProfileAction(input);
  invalidate([
    ['profile', 'active'],
    ['profile', 'active', 'id'],
    ['profiles'],
  ]);
  return profile;
}

export async function updateProfile(id: string, patch: Partial<Profile>): Promise<void> {
  await updateProfileAction(id, patch);
  invalidate([
    ['profile', 'active'],
    ['profile', id],
    ['profiles'],
  ]);
}

export async function setActiveProfile(id: string): Promise<void> {
  await setActiveProfileAction(id);
  invalidate([
    ['profile', 'active'],
    ['profile', 'active', 'id'],
  ]);
}

export async function deleteProfile(id: string): Promise<void> {
  await deleteProfileAction(id);
  invalidate([
    ['profiles'],
    ['profile', 'active'],
    ['profile', 'active', 'id'],
    ['profile', id],
  ]);
}

// ---------- Clients ----------

export async function createClient(input: Omit<Client, 'id' | 'createdAt'>): Promise<Client> {
  const client = await createClientAction(input);
  invalidate([['clients']]);
  return client;
}

export async function updateClient(id: string, patch: Partial<Client>): Promise<void> {
  await updateClientAction(id, patch);
  invalidate([['clients'], ['client', id]]);
}

export async function archiveClient(id: string): Promise<void> {
  await archiveClientAction(id);
  invalidate([['clients'], ['client', id]]);
}

// ---------- Invoices ----------

export async function createInvoiceDraft(): Promise<Invoice> {
  const invoice = await createInvoiceDraftAction();
  invalidate([
    ['invoices'],
    ['profile', 'active'],
    ['profiles'],
  ]);
  return invoice;
}

export async function updateInvoice(id: string, patch: Partial<Invoice>): Promise<void> {
  const { lineItems, ...header } = patch;
  await updateInvoiceAction(id, header, lineItems);
  invalidate([
    ['invoices'],
    ['invoice', id],
  ]);
}

export async function deleteInvoiceDraft(id: string): Promise<void> {
  await deleteInvoiceDraftAction(id);
  invalidate([['invoices'], ['invoice', id]]);
}

export async function markInvoiceSent(id: string): Promise<void> {
  await markInvoiceSentAction(id);
  invalidate([['invoices'], ['invoice', id]]);
}

export async function voidInvoice(id: string): Promise<void> {
  await voidInvoiceAction(id);
  invalidate([['invoices'], ['invoice', id]]);
}

export async function duplicateInvoice(sourceId: string): Promise<Invoice> {
  const invoice = await duplicateInvoiceAction(sourceId);
  invalidate([['invoices']]);
  return invoice;
}

// ---------- Payments ----------

export async function recordPayment(input: Omit<Payment, 'id'>): Promise<Payment> {
  const payment = await recordPaymentAction(input);
  invalidate([
    ['payments'],
    ['payments', 'invoice', input.invoiceId],
    ['invoices'],
    ['invoice', input.invoiceId],
  ]);
  return payment;
}

export async function deletePayment(id: string): Promise<void> {
  await deletePaymentAction(id);
  if (typeof window !== 'undefined') {
    const qc = getQueryClient();
    qc.invalidateQueries({ queryKey: ['payments'] });
    qc.invalidateQueries({ queryKey: ['invoices'] });
    qc.invalidateQueries({ queryKey: ['invoice'] });
    qc.invalidateQueries({ queryKey: ['payments', 'invoice'] });
  }
}

// ---------- Settings ----------

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await setSettingAction(key, value);
  invalidate([['setting', key]]);
}

// ---------- Bulk ops ----------

export async function wipeAllData(): Promise<void> {
  await wipeWorkspaceDataAction();
  if (typeof window !== 'undefined') {
    getQueryClient().clear();
  }
}
