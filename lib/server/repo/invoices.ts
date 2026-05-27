import 'server-only';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import {
  invoiceFromRow,
  invoiceToUpdate,
  lineItemToJson,
  type InvoiceRowWithItems,
} from '@/lib/server/mapping';
import { requireWorkspace } from '@/lib/server/workspace';
import type { EditableInvoicePatch, Invoice, LineItem } from '@/lib/types';

const INVOICE_SELECT = `
  *,
  invoice_line_items (
    id, invoice_id, position, description, quantity, unit_price, tax_rate
  )
` as const;

export async function listInvoices(): Promise<Invoice[]> {
  const supabase = await getSupabaseServerClient();
  const { workspaceId } = await requireWorkspace();
  const { data, error } = await supabase
    .from('invoices')
    .select(INVOICE_SELECT)
    .eq('workspace_id', workspaceId)
    .order('issue_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as InvoiceRowWithItems[]).map(invoiceFromRow);
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const supabase = await getSupabaseServerClient();
  await requireWorkspace();
  const { data, error } = await supabase
    .from('invoices')
    .select(INVOICE_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return invoiceFromRow(data as unknown as InvoiceRowWithItems);
}

/**
 * Atomic numbering + insert through the create_invoice_draft RPC. The Postgres
 * function locks the profile row, increments the counter, inserts the invoice
 * and a seed line item, and writes the 'created' event in one transaction.
 */
export async function createInvoiceDraft(): Promise<Invoice> {
  const supabase = await getSupabaseServerClient();
  await requireWorkspace();

  // Resolve the active profile.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id, active_profile_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!member) throw new Error('NO_WORKSPACE');

  let profileId = member.active_profile_id;
  if (!profileId) {
    const { data: firstProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('workspace_id', member.workspace_id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!firstProfile) {
      throw new Error('No profile found — onboarding is required first.');
    }
    profileId = firstProfile.id;
  }

  const { data: invoiceId, error } = await supabase.rpc('create_invoice_draft', {
    p_profile_id: profileId,
  });
  if (error) throw error;

  const invoice = await getInvoice(invoiceId as string);
  if (!invoice) throw new Error('Draft was created but could not be read back.');
  return invoice;
}

/**
 * Updates header-level invoice fields. Line items are replaced separately via
 * replaceInvoiceLineItems so the autosave path can be atomic.
 */
export async function updateInvoice(
  id: string,
  patch: Omit<EditableInvoicePatch, 'lineItems'>,
): Promise<void> {
  const supabase = await getSupabaseServerClient();
  await requireWorkspace();
  const update = invoiceToUpdate(patch);
  if (Object.keys(update).length === 0) return;
  const { data: inv, error: readErr } = await supabase
    .from('invoices')
    .select('status')
    .eq('id', id)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!inv) throw new Error('Invoice not found.');
  if (inv.status !== 'draft') {
    throw new Error('Only draft invoices can be edited.');
  }
  const { error } = await supabase.from('invoices').update(update).eq('id', id);
  if (error) throw error;
}

export async function replaceInvoiceLineItems(invoiceId: string, items: LineItem[]): Promise<void> {
  const supabase = await getSupabaseServerClient();
  await requireWorkspace();
  const { data: inv, error: readErr } = await supabase
    .from('invoices')
    .select('status')
    .eq('id', invoiceId)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!inv) throw new Error('Invoice not found.');
  if (inv.status !== 'draft') {
    throw new Error('Only draft invoices can be edited.');
  }
  const { error } = await supabase.rpc('replace_invoice_line_items', {
    p_invoice_id: invoiceId,
    p_items: items.map(lineItemToJson),
  });
  if (error) throw error;
}

export async function deleteInvoiceDraft(id: string): Promise<void> {
  const supabase = await getSupabaseServerClient();
  await requireWorkspace();
  const { data: inv, error: readErr } = await supabase
    .from('invoices')
    .select('id, number, status')
    .eq('id', id)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!inv) return;
  if (inv.status !== 'draft') {
    throw new Error(`Cannot delete invoice ${inv.number}: only drafts can be deleted (status is ${inv.status}).`);
  }
  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) throw error;
}

export async function markInvoiceSent(id: string): Promise<void> {
  const supabase = await getSupabaseServerClient();
  await requireWorkspace();
  const { error } = await supabase.rpc('mark_invoice_sent', { p_invoice_id: id });
  if (error) throw error;
}

export async function voidInvoice(id: string): Promise<void> {
  const supabase = await getSupabaseServerClient();
  await requireWorkspace();
  const { error } = await supabase.rpc('void_invoice', { p_invoice_id: id });
  if (error) throw error;
}

/**
 * Duplicate: creates a fresh draft (new number) and copies the source's
 * editable fields into it. Snapshots and payments are NOT copied.
 */
export async function duplicateInvoice(sourceId: string): Promise<Invoice> {
  const source = await getInvoice(sourceId);
  if (!source) throw new Error('Invoice not found.');
  const draft = await createInvoiceDraft();
  await updateInvoice(draft.id, {
    clientId: source.clientId,
    currency: source.currency,
    defaultTaxRate: source.defaultTaxRate,
    discount: source.discount,
    notes: source.notes,
    paymentInstructions: source.paymentInstructions,
    stripePaymentLink: source.stripePaymentLink,
  });
  await replaceInvoiceLineItems(draft.id, source.lineItems.map((l) => ({ ...l, id: '' })));
  const refreshed = await getInvoice(draft.id);
  if (!refreshed) throw new Error('Duplicate failed.');
  return refreshed;
}
