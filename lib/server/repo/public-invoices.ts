import 'server-only';
import { randomBytes } from 'node:crypto';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireWorkspace } from '@/lib/server/workspace';

export type PublicInvoiceLink = {
  id: string;
  invoiceId: string;
  token: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

type LinkRow = {
  id: string;
  workspace_id: string;
  invoice_id: string;
  token: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  created_by: string | null;
};

function linkFromRow(row: LinkRow): PublicInvoiceLink {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    token: row.token,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

/** 24 bytes → 32-char URL-safe base64. Enough entropy that collisions never happen. */
function newToken(): string {
  return randomBytes(24).toString('base64url');
}

export async function listPublicLinks(invoiceId: string): Promise<PublicInvoiceLink[]> {
  const supabase = await getSupabaseServerClient();
  await requireWorkspace();
  const { data, error } = await supabase
    .from('public_invoice_links')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as LinkRow[]).map(linkFromRow);
}

export async function createPublicLink(
  invoiceId: string,
  options?: { expiresInDays?: number },
): Promise<PublicInvoiceLink> {
  const supabase = await getSupabaseServerClient();
  const { workspaceId, userId } = await requireWorkspace();

  // Sanity: the invoice must belong to this workspace and be an active issued invoice.
  const { data: inv, error: invErr } = await supabase
    .from('invoices')
    .select('id, status, workspace_id')
    .eq('id', invoiceId)
    .maybeSingle();
  if (invErr) throw invErr;
  if (!inv) throw new Error('Invoice not found.');
  if (inv.workspace_id !== workspaceId) throw new Error('Forbidden.');
  if (inv.status === 'draft') {
    throw new Error('Send the invoice before creating a share link.');
  }
  if (inv.status === 'void') {
    throw new Error('Voided invoices cannot be shared.');
  }

  const expiresAt = options?.expiresInDays
    ? new Date(Date.now() + options.expiresInDays * 86_400_000).toISOString()
    : null;

  const { data, error } = await supabase
    .from('public_invoice_links')
    .insert({
      workspace_id: workspaceId,
      invoice_id: invoiceId,
      token: newToken(),
      expires_at: expiresAt,
      created_by: userId,
    })
    .select('*')
    .single();
  if (error) throw error;
  return linkFromRow(data as LinkRow);
}

export async function revokePublicLink(linkId: string): Promise<void> {
  const supabase = await getSupabaseServerClient();
  await requireWorkspace();
  const { error } = await supabase
    .from('public_invoice_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', linkId);
  if (error) throw error;
}
