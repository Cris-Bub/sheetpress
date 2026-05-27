import 'server-only';
import type { Database, Json } from '@/lib/supabase/types';
import type {
  Address,
  Client,
  Discount,
  EditableInvoicePatch,
  Invoice,
  LineItem,
  Payment,
  Profile,
} from '@/lib/types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type ClientRow = Database['public']['Tables']['clients']['Row'];
type InvoiceRow = Database['public']['Tables']['invoices']['Row'];
type LineItemRow = Database['public']['Tables']['invoice_line_items']['Row'];
type PaymentRow = Database['public']['Tables']['invoice_payments']['Row'];

// ---------- Profile ----------

export function profileFromRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    businessName: row.business_name,
    legalName: row.legal_name ?? undefined,
    taxId: row.tax_id ?? undefined,
    taxIdLabel: row.tax_id_label ?? undefined,
    email: row.email,
    phone: row.phone ?? undefined,
    address: row.address as unknown as Address,
    logoDataUrl: row.logo_data_url ?? undefined,
    defaultPaymentInstructions: row.default_payment_instructions ?? undefined,
    defaultPaymentTermsDays: row.default_payment_terms_days,
    defaultNotes: row.default_notes ?? undefined,
    defaultCurrency: row.default_currency,
    defaultTaxRate: row.default_tax_rate ?? undefined,
    accentColor: row.accent_color,
    invoiceNumberFormat: row.invoice_number_format,
    nextInvoiceNumber: row.next_invoice_number,
  };
}

export function profileToInsert(p: Omit<Profile, 'id'>, workspaceId: string) {
  return {
    workspace_id: workspaceId,
    business_name: p.businessName,
    legal_name: p.legalName ?? null,
    tax_id: p.taxId ?? null,
    tax_id_label: p.taxIdLabel ?? null,
    email: p.email,
    phone: p.phone ?? null,
    address: p.address as unknown as Json,
    logo_data_url: p.logoDataUrl ?? null,
    default_payment_instructions: p.defaultPaymentInstructions ?? null,
    default_payment_terms_days: p.defaultPaymentTermsDays,
    default_notes: p.defaultNotes ?? null,
    default_currency: p.defaultCurrency,
    default_tax_rate: p.defaultTaxRate ?? null,
    accent_color: p.accentColor,
    invoice_number_format: p.invoiceNumberFormat,
    next_invoice_number: p.nextInvoiceNumber,
  } satisfies Database['public']['Tables']['profiles']['Insert'];
}

export function profileToUpdate(patch: Partial<Profile>): Database['public']['Tables']['profiles']['Update'] {
  const out: Database['public']['Tables']['profiles']['Update'] = {};
  if (patch.businessName !== undefined) out.business_name = patch.businessName;
  if (patch.legalName !== undefined) out.legal_name = patch.legalName ?? null;
  if (patch.taxId !== undefined) out.tax_id = patch.taxId ?? null;
  if (patch.taxIdLabel !== undefined) out.tax_id_label = patch.taxIdLabel ?? null;
  if (patch.email !== undefined) out.email = patch.email;
  if (patch.phone !== undefined) out.phone = patch.phone ?? null;
  if (patch.address !== undefined) out.address = patch.address as unknown as Json;
  if (patch.logoDataUrl !== undefined) out.logo_data_url = patch.logoDataUrl ?? null;
  if (patch.defaultPaymentInstructions !== undefined)
    out.default_payment_instructions = patch.defaultPaymentInstructions ?? null;
  if (patch.defaultPaymentTermsDays !== undefined) out.default_payment_terms_days = patch.defaultPaymentTermsDays;
  if (patch.defaultNotes !== undefined) out.default_notes = patch.defaultNotes ?? null;
  if (patch.defaultCurrency !== undefined) out.default_currency = patch.defaultCurrency;
  if (patch.defaultTaxRate !== undefined) out.default_tax_rate = patch.defaultTaxRate ?? null;
  if (patch.accentColor !== undefined) out.accent_color = patch.accentColor;
  if (patch.invoiceNumberFormat !== undefined) out.invoice_number_format = patch.invoiceNumberFormat;
  if (patch.nextInvoiceNumber !== undefined) out.next_invoice_number = patch.nextInvoiceNumber;
  return out;
}

// ---------- Client ----------

export function clientFromRow(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contact_name ?? undefined,
    email: row.email ?? undefined,
    taxId: row.tax_id ?? undefined,
    address: (row.address as unknown as Address | null) ?? undefined,
    defaultCurrency: row.default_currency ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    archivedAt: row.archived_at ?? undefined,
  };
}

export function clientToInsert(c: Omit<Client, 'id' | 'createdAt'>, workspaceId: string) {
  return {
    workspace_id: workspaceId,
    name: c.name,
    contact_name: c.contactName ?? null,
    email: c.email ?? null,
    tax_id: c.taxId ?? null,
    address: (c.address ?? null) as unknown as Json | null,
    default_currency: c.defaultCurrency ?? null,
    notes: c.notes ?? null,
    archived_at: c.archivedAt ?? null,
  } satisfies Database['public']['Tables']['clients']['Insert'];
}

export function clientToUpdate(patch: Partial<Client>): Database['public']['Tables']['clients']['Update'] {
  const out: Database['public']['Tables']['clients']['Update'] = {};
  if (patch.name !== undefined) out.name = patch.name;
  if (patch.contactName !== undefined) out.contact_name = patch.contactName ?? null;
  if (patch.email !== undefined) out.email = patch.email ?? null;
  if (patch.taxId !== undefined) out.tax_id = patch.taxId ?? null;
  if (patch.address !== undefined) out.address = (patch.address ?? null) as unknown as Json | null;
  if (patch.defaultCurrency !== undefined) out.default_currency = patch.defaultCurrency ?? null;
  if (patch.notes !== undefined) out.notes = patch.notes ?? null;
  if (patch.archivedAt !== undefined) out.archived_at = patch.archivedAt ?? null;
  return out;
}

// ---------- Line item ----------

export function lineItemFromRow(row: LineItemRow): LineItem {
  return {
    id: row.id,
    description: row.description,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    taxRate: row.tax_rate === null ? undefined : Number(row.tax_rate),
  };
}

export function lineItemToJson(item: LineItem) {
  return {
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    tax_rate: item.taxRate === undefined || item.taxRate === null ? '' : item.taxRate,
  };
}

// ---------- Invoice ----------

export type InvoiceRowWithItems = InvoiceRow & {
  invoice_line_items?: LineItemRow[] | null;
};

export function invoiceFromRow(row: InvoiceRowWithItems): Invoice {
  const items = (row.invoice_line_items ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(lineItemFromRow);

  return {
    id: row.id,
    number: row.number,
    profileId: row.profile_id,
    clientId: row.client_id ?? '',
    issueDate: row.issue_date,
    dueDate: row.due_date,
    currency: row.currency,
    lineItems: items,
    defaultTaxRate: row.default_tax_rate ?? undefined,
    discount: (row.discount as unknown as Discount | null) ?? undefined,
    notes: row.notes ?? undefined,
    paymentInstructions: row.payment_instructions ?? undefined,
    stripePaymentLink: row.stripe_payment_link ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Snapshots are populated only after send. Pre-send the editor renders
    // from the live profile and client picker, so we fall back to empty.
    clientSnapshot: (row.client_snapshot as unknown as Client | null) ?? {
      id: row.client_id ?? '',
      name: '',
      createdAt: row.created_at,
    },
    profileSnapshot: (row.profile_snapshot as unknown as Profile | null) ?? ({} as Profile),
  };
}

export function invoiceToUpdate(patch: EditableInvoicePatch): Database['public']['Tables']['invoices']['Update'] {
  const out: Database['public']['Tables']['invoices']['Update'] = {};
  if (patch.clientId !== undefined) out.client_id = patch.clientId === '' ? null : patch.clientId;
  if (patch.number !== undefined) out.number = patch.number;
  if (patch.issueDate !== undefined) out.issue_date = patch.issueDate;
  if (patch.dueDate !== undefined) out.due_date = patch.dueDate;
  if (patch.currency !== undefined) out.currency = patch.currency;
  if (patch.defaultTaxRate !== undefined) out.default_tax_rate = patch.defaultTaxRate ?? null;
  if (patch.discount !== undefined) out.discount = (patch.discount ?? null) as unknown as Json | null;
  if (patch.notes !== undefined) out.notes = patch.notes ?? null;
  if (patch.paymentInstructions !== undefined) out.payment_instructions = patch.paymentInstructions ?? null;
  if (patch.stripePaymentLink !== undefined) out.stripe_payment_link = patch.stripePaymentLink ?? null;
  return out;
}

// ---------- Payment ----------

export function paymentFromRow(row: PaymentRow): Payment {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    date: row.payment_date,
    amount: Number(row.amount),
    method: row.method ?? undefined,
    note: row.note ?? undefined,
  };
}

export function paymentToInsert(
  p: Omit<Payment, 'id'>,
  workspaceId: string,
): Database['public']['Tables']['invoice_payments']['Insert'] {
  return {
    workspace_id: workspaceId,
    invoice_id: p.invoiceId,
    payment_date: p.date,
    amount: p.amount,
    method: p.method ?? null,
    note: p.note ?? null,
  };
}
