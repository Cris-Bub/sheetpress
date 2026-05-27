import 'server-only';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { paymentFromRow, paymentToInsert } from '@/lib/server/mapping';
import { requireWorkspace } from '@/lib/server/workspace';
import { getInvoice } from './invoices';
import { computeTotals } from '@/lib/format';
import type { Payment } from '@/lib/types';

export async function listPayments(): Promise<Payment[]> {
  const supabase = await getSupabaseServerClient();
  const { workspaceId } = await requireWorkspace();
  const { data, error } = await supabase
    .from('invoice_payments')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('payment_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(paymentFromRow);
}

export async function listPaymentsForInvoice(invoiceId: string): Promise<Payment[]> {
  const supabase = await getSupabaseServerClient();
  await requireWorkspace();
  const { data, error } = await supabase
    .from('invoice_payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('payment_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(paymentFromRow);
}

/**
 * Records a payment and updates invoice status based on the new paid total.
 * Status recompute is NOT atomic with the payment insert — the race window
 * between two concurrent payments on the same invoice can leave the status
 * one tick stale. Acceptable for v1 (single freelancer editing); revisit if
 * batched/concurrent payments become a real flow.
 */
export async function recordPayment(input: Omit<Payment, 'id'>): Promise<Payment> {
  const supabase = await getSupabaseServerClient();
  const { workspaceId } = await requireWorkspace();

  const invoice = await getInvoice(input.invoiceId);
  if (!invoice) throw new Error('Invoice not found.');
  if (invoice.status === 'draft') throw new Error('Cannot record payment on a draft.');
  if (invoice.status === 'void') throw new Error('Cannot record payment on a voided invoice.');

  const { data, error } = await supabase
    .from('invoice_payments')
    .insert(paymentToInsert(input, workspaceId))
    .select('*')
    .single();
  if (error) throw error;
  const payment = paymentFromRow(data);

  await recomputeInvoiceStatus(invoice.id);
  return payment;
}

export async function deletePayment(id: string): Promise<void> {
  const supabase = await getSupabaseServerClient();
  await requireWorkspace();
  const { data: row, error: readErr } = await supabase
    .from('invoice_payments')
    .select('invoice_id')
    .eq('id', id)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!row) return;

  const { error } = await supabase.from('invoice_payments').delete().eq('id', id);
  if (error) throw error;
  await recomputeInvoiceStatus(row.invoice_id);
}

async function recomputeInvoiceStatus(invoiceId: string): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const invoice = await getInvoice(invoiceId);
  if (!invoice) return;
  if (invoice.status === 'draft' || invoice.status === 'void') return;

  const payments = await listPaymentsForInvoice(invoiceId);
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const total = computeTotals(invoice).total;
  const next = paid >= total && total > 0 ? 'paid' : paid > 0 ? 'partial' : 'sent';
  if (next !== invoice.status) {
    const { error } = await supabase.from('invoices').update({ status: next }).eq('id', invoiceId);
    if (error) throw error;
  }
}
