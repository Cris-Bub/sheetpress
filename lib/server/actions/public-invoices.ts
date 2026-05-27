'use server';

import { getSupabaseServerClient } from '@/lib/supabase/server';
import {
  createPublicLink,
  listPublicLinks,
  revokePublicLink,
  type PublicInvoiceLink,
} from '@/lib/server/repo/public-invoices';
import type { Client, Discount, LineItem, Profile } from '@/lib/types';

export type PublicInvoiceView = {
  number: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  status: 'sent' | 'paid' | 'partial' | 'overdue';
  discount: Discount | null;
  defaultTaxRate: number | null;
  notes: string | null;
  paymentInstructions: string | null;
  stripePaymentLink: string | null;
  clientSnapshot: Client | null;
  profileSnapshot: Profile | null;
  lineItems: LineItem[];
  paidAmount: number;
};

// ---- Authenticated link management (called from the detail view) ----

export async function listPublicLinksAction(invoiceId: string): Promise<PublicInvoiceLink[]> {
  return listPublicLinks(invoiceId);
}

export async function createPublicLinkAction(
  invoiceId: string,
  expiresInDays?: number,
): Promise<PublicInvoiceLink> {
  return createPublicLink(invoiceId, { expiresInDays });
}

export async function revokePublicLinkAction(linkId: string): Promise<void> {
  return revokePublicLink(linkId);
}

// ---- Public token resolution (called from /pay/[token] — anon allowed) ----

/**
 * Resolves a token to a frozen invoice view. Returns null for missing,
 * revoked, expired, draft, or void invoices. Never exposes internal IDs.
 */
export async function getPublicInvoiceByTokenAction(
  token: string,
): Promise<PublicInvoiceView | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc('get_public_invoice_by_token', { p_token: token });
  if (error) throw error;
  if (!data) return null;
  return data as PublicInvoiceView;
}
