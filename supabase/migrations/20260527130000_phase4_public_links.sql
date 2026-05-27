-- sheetPress SaaS fork — Phase 4: hosted invoice links + file storage.
--
-- Adds:
--   public.public_invoice_links     opaque tokens for /pay/[token]
--   public.invoice_pdf_versions     audit of which PDF blob was sent/downloaded
--   public.get_public_invoice_by_token  controlled bridge for anon reads
--   storage buckets: invoice-pdfs, logos, exports  (all private)
--
-- The function is the ONLY path that exposes invoice data to the anon role.
-- Direct table reads stay blocked by RLS.

-- ---------------------------------------------------------------------------
-- public_invoice_links
-- ---------------------------------------------------------------------------

create table if not exists public.public_invoice_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index public_invoice_links_invoice_idx on public.public_invoice_links(invoice_id);
-- Partial index — token lookups for the public RPC skip revoked rows.
create index public_invoice_links_active_token_idx
  on public.public_invoice_links(token)
  where revoked_at is null;

alter table public.public_invoice_links enable row level security;

create policy public_invoice_links_select_member
  on public.public_invoice_links for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create policy public_invoice_links_insert_member
  on public.public_invoice_links for insert
  to authenticated
  with check (
    private.is_workspace_member(workspace_id)
    and (created_by is null or created_by = (select auth.uid()))
  );

-- Update is used only to set revoked_at. Members can revoke any link in their
-- workspace; no other field is meaningfully updatable.
create policy public_invoice_links_update_member
  on public.public_invoice_links for update
  to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

create policy public_invoice_links_delete_member
  on public.public_invoice_links for delete
  to authenticated
  using (private.is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- invoice_pdf_versions  (Phase 4 schema — populated later)
-- ---------------------------------------------------------------------------

create table if not exists public.invoice_pdf_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  storage_path text not null,
  reason text not null check (reason in ('sent', 'downloaded', 'emailed', 'public_link')),
  byte_size bigint,
  sha256 text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index invoice_pdf_versions_invoice_idx on public.invoice_pdf_versions(invoice_id, created_at desc);

alter table public.invoice_pdf_versions enable row level security;

create policy invoice_pdf_versions_select_member
  on public.invoice_pdf_versions for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create policy invoice_pdf_versions_insert_member
  on public.invoice_pdf_versions for insert
  to authenticated
  with check (private.is_workspace_member(workspace_id));

-- No update / delete: PDF versions are append-only audit history.

-- ---------------------------------------------------------------------------
-- get_public_invoice_by_token — the only path anon can take to invoice data.
--
-- Returns a jsonb payload with everything a customer needs to view the
-- invoice (frozen snapshots, line items, totals, paid amount). Returns NULL
-- when the token is missing, revoked, expired, or points at a draft.
--
-- SECURITY DEFINER on purpose: anon has no direct access to the underlying
-- tables. This function is the controlled bridge and re-validates every gate
-- (revoked_at, expires_at, status != 'draft') before returning anything.
-- ---------------------------------------------------------------------------

create or replace function public.get_public_invoice_by_token(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_link public.public_invoice_links%rowtype;
  v_invoice public.invoices%rowtype;
  v_paid bigint;
begin
  if p_token is null or length(p_token) = 0 then
    return null;
  end if;

  select * into v_link from public.public_invoice_links where token = p_token;
  if not found then return null; end if;
  if v_link.revoked_at is not null then return null; end if;
  if v_link.expires_at is not null and v_link.expires_at < now() then return null; end if;

  select * into v_invoice from public.invoices where id = v_link.invoice_id;
  if not found then return null; end if;
  if v_invoice.status = 'draft' then return null; end if;

  select coalesce(sum(amount), 0)
    into v_paid
    from public.invoice_payments
    where invoice_id = v_invoice.id;

  return jsonb_build_object(
    'number', v_invoice.number,
    'issueDate', v_invoice.issue_date,
    'dueDate', v_invoice.due_date,
    'currency', v_invoice.currency,
    'status', v_invoice.status,
    'discount', v_invoice.discount,
    'defaultTaxRate', v_invoice.default_tax_rate,
    'notes', v_invoice.notes,
    'paymentInstructions', v_invoice.payment_instructions,
    'stripePaymentLink', v_invoice.stripe_payment_link,
    'clientSnapshot', v_invoice.client_snapshot,
    'profileSnapshot', v_invoice.profile_snapshot,
    'lineItems', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'description', description,
          'quantity', quantity,
          'unitPrice', unit_price,
          'taxRate', tax_rate
        ) order by position
      ), '[]'::jsonb)
      from public.invoice_line_items
      where invoice_id = v_invoice.id
    ),
    'paidAmount', v_paid
  );
end;
$$;

revoke all on function public.get_public_invoice_by_token(text) from public;
grant execute on function public.get_public_invoice_by_token(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage buckets — created idempotently so `supabase db reset` works.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('invoice-pdfs', 'invoice-pdfs', false),
  ('logos',         'logos',        false),
  ('exports',       'exports',      false)
on conflict (id) do nothing;

-- Storage RLS — Supabase storage objects are gated by policies on
-- storage.objects. The convention here: every object lives under a path
-- prefixed with its workspace_id, so the first path segment is the gate.
--
-- Example object name: "9d0a…f3/invoice-uuid/v1.pdf"
--                       ^^^^^^^ workspace_id

create policy "workspace members can read invoice PDFs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'invoice-pdfs'
    and private.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

create policy "workspace members can write invoice PDFs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'invoice-pdfs'
    and private.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

create policy "workspace members can update invoice PDFs"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'invoice-pdfs'
    and private.is_workspace_member((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'invoice-pdfs'
    and private.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

create policy "workspace members can delete invoice PDFs"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'invoice-pdfs'
    and private.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

create policy "workspace members can read logos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'logos'
    and private.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

create policy "workspace members can write logos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'logos'
    and private.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

create policy "workspace members can update logos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'logos'
    and private.is_workspace_member((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'logos'
    and private.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

create policy "workspace members can delete logos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'logos'
    and private.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

create policy "workspace members can read exports"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'exports'
    and private.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

create policy "workspace members can write exports"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'exports'
    and private.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

create policy "workspace members can delete exports"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'exports'
    and private.is_workspace_member((storage.foldername(name))[1]::uuid)
  );
