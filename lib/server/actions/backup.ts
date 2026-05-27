'use server';

import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireWorkspace } from '@/lib/server/workspace';
import {
  clientToInsert,
  lineItemToJson,
  paymentToInsert,
  profileToInsert,
} from '@/lib/server/mapping';
import type { Json } from '@/lib/supabase/types';
import type { Client, Invoice, Payment, Profile } from '@/lib/types';

const AddressSchema = z.object({
  line1: z.string().default(''),
  line2: z.string().optional(),
  city: z.string().default(''),
  region: z.string().optional(),
  postalCode: z.string().default(''),
  country: z.string().default(''),
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
  clientSnapshot: ClientSchema.passthrough(),
  profileSnapshot: ProfileSchema.passthrough(),
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
  stripePaymentLink: z.string().optional(),
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

export type ImportResult = {
  profiles: number;
  clients: number;
  invoices: number;
  payments: number;
  skipped: number;
};

/**
 * Import a sheetPress backup JSON payload into the current workspace.
 *
 * Re-ids profiles/clients/invoices to fresh UUIDs to avoid colliding with any
 * existing rows. The local-first export's `(number, issueDate)` dedupe key is
 * preserved against the workspace's existing invoices so re-imports stay
 * idempotent.
 *
 * Accepts the JSON payload as a string so server actions don't have to deal
 * with serializing the full backup-ZIP File. The client extracts data.json
 * from the ZIP and calls this with the parsed JSON.
 */
export async function importBackupJsonAction(jsonText: string): Promise<ImportResult> {
  const supabase = await getSupabaseServerClient();
  const { workspaceId } = await requireWorkspace();

  const raw = JSON.parse(jsonText);
  const parsed = BackupSchema.parse(raw);

  // --- Pre-fetch existing invoices for dedupe. ---
  const { data: existing, error: existingErr } = await supabase
    .from('invoices')
    .select('number, issue_date')
    .eq('workspace_id', workspaceId);
  if (existingErr) throw existingErr;
  const existingRows = (existing ?? []) as Array<{ number: string; issue_date: string }>;
  const seen = new Set(existingRows.map((i) => `${i.number}@${i.issue_date}`));

  // --- Profile re-id map ---
  const profileIdMap = new Map<string, string>();
  for (const p of parsed.profiles) {
    const insert = profileToInsert(stripId(p) as Omit<Profile, 'id'>, workspaceId);
    const { data, error } = await supabase
      .from('profiles')
      .insert(insert)
      .select('id')
      .single();
    if (error) throw error;
    profileIdMap.set(p.id, data.id);
  }

  // --- Client re-id map ---
  const clientIdMap = new Map<string, string>();
  for (const c of parsed.clients) {
    const insert = clientToInsert(stripClientId(c) as Omit<Client, 'id' | 'createdAt'>, workspaceId);
    const { data, error } = await supabase
      .from('clients')
      .insert({ ...insert, created_at: c.createdAt, archived_at: c.archivedAt ?? null })
      .select('id')
      .single();
    if (error) throw error;
    clientIdMap.set(c.id, data.id);
  }

  // --- Invoices + line items ---
  const invoiceIdMap = new Map<string, string>();
  let skipped = 0;
  for (const inv of parsed.invoices as Invoice[]) {
    const key = `${inv.number}@${inv.issueDate}`;
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);

    const profileId = profileIdMap.get(inv.profileId);
    if (!profileId) {
      throw new Error(`Invoice ${inv.number} references unknown profile ${inv.profileId}.`);
    }
    const clientId = inv.clientId ? clientIdMap.get(inv.clientId) : null;

    const { data, error } = await supabase
      .from('invoices')
      .insert({
        workspace_id: workspaceId,
        profile_id: profileId,
        client_id: clientId ?? null,
        number: inv.number,
        issue_date: inv.issueDate,
        due_date: inv.dueDate,
        currency: inv.currency,
        default_tax_rate: inv.defaultTaxRate ?? null,
        discount: (inv.discount ?? null) as unknown as Json | null,
        notes: inv.notes ?? null,
        payment_instructions: inv.paymentInstructions ?? null,
        stripe_payment_link: inv.stripePaymentLink ?? null,
        client_snapshot: inv.clientSnapshot as unknown as Json,
        profile_snapshot: inv.profileSnapshot as unknown as Json,
        status: inv.status,
        created_at: inv.createdAt,
        updated_at: inv.updatedAt,
      })
      .select('id')
      .single();
    if (error) throw error;
    invoiceIdMap.set(inv.id, data.id);

    if (inv.lineItems.length > 0) {
      const itemRows = inv.lineItems.map((item, position) => ({
        invoice_id: data.id,
        position,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        tax_rate: item.taxRate ?? null,
      }));
      // line items insert
      const { error: liErr } = await supabase.from('invoice_line_items').insert(itemRows);
      if (liErr) throw liErr;
      void lineItemToJson;
    }
  }

  // --- Payments ---
  let payCount = 0;
  for (const p of parsed.payments as Payment[]) {
    const invoiceId = invoiceIdMap.get(p.invoiceId);
    if (!invoiceId) continue; // payment for a skipped/missing invoice
    const insert = paymentToInsert({ ...p, invoiceId }, workspaceId);
    const { error } = await supabase.from('invoice_payments').insert(insert);
    if (error) throw error;
    payCount++;
  }

  return {
    profiles: parsed.profiles.length,
    clients: parsed.clients.length,
    invoices: invoiceIdMap.size,
    payments: payCount,
    skipped,
  };
}

function stripId<T extends { id: string }>(value: T) {
  const { id: _id, ...rest } = value;
  void _id;
  return rest;
}
function stripClientId<T extends { id: string; createdAt: string }>(value: T) {
  const { id: _id, createdAt: _createdAt, ...rest } = value;
  void _id;
  void _createdAt;
  return rest;
}
