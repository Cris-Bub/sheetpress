-- Fix: mark_invoice_sent used to_jsonb(row) which produces snake_case keys
-- (business_name, default_currency, etc.), but the TS layer reads snapshots
-- as camelCase (businessName, defaultCurrency, …). Rewriting the function to
-- emit camelCase explicitly, and backfilling existing sent invoices.

create or replace function public.mark_invoice_sent(p_invoice_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_client public.clients%rowtype;
  v_profile public.profiles%rowtype;
  v_line_count int;
  v_client_snap jsonb;
  v_profile_snap jsonb;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'invoice_not_found' using errcode = '23503'; end if;
  if v_invoice.status <> 'draft' then
    raise exception 'invoice_not_draft' using message = format('Invoice %s is already %s.', v_invoice.number, v_invoice.status);
  end if;
  if v_invoice.client_id is null then
    raise exception 'no_client' using message = 'Add a client before marking as sent.';
  end if;

  select count(*) into v_line_count from public.invoice_line_items where invoice_id = p_invoice_id;
  if v_line_count = 0 then
    raise exception 'no_line_items' using message = 'Add at least one line item before marking as sent.';
  end if;

  select * into v_client from public.clients where id = v_invoice.client_id;
  if not found then raise exception 'client_missing' using message = 'Selected client no longer exists.'; end if;

  select * into v_profile from public.profiles where id = v_invoice.profile_id;
  if not found then raise exception 'profile_missing' using errcode = '23503'; end if;

  v_client_snap := private.client_to_snapshot(v_client);
  v_profile_snap := private.profile_to_snapshot(v_profile);

  update public.invoices
     set status = 'sent',
         client_snapshot = v_client_snap,
         profile_snapshot = v_profile_snap
   where id = p_invoice_id;

  insert into public.invoice_events(workspace_id, invoice_id, type, actor_id)
    values (v_invoice.workspace_id, p_invoice_id, 'sent', v_user_id);
end;
$$;
revoke all on function public.mark_invoice_sent(uuid) from public;
grant execute on function public.mark_invoice_sent(uuid) to authenticated;

-- camelCase builder helpers — kept in `private` so they're not part of the API.

create or replace function private.client_to_snapshot(c public.clients)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'contactName', c.contact_name,
    'email', c.email,
    'taxId', c.tax_id,
    'address', c.address,
    'defaultCurrency', c.default_currency,
    'notes', c.notes,
    'createdAt', c.created_at,
    'archivedAt', c.archived_at
  ))
$$;
revoke all on function private.client_to_snapshot(public.clients) from public;
grant execute on function private.client_to_snapshot(public.clients) to authenticated;

create or replace function private.profile_to_snapshot(p public.profiles)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', p.id,
    'businessName', p.business_name,
    'legalName', p.legal_name,
    'taxId', p.tax_id,
    'taxIdLabel', p.tax_id_label,
    'email', p.email,
    'phone', p.phone,
    'address', p.address,
    'logoDataUrl', p.logo_data_url,
    'defaultPaymentInstructions', p.default_payment_instructions,
    'defaultPaymentTermsDays', p.default_payment_terms_days,
    'defaultNotes', p.default_notes,
    'defaultCurrency', p.default_currency,
    'defaultTaxRate', p.default_tax_rate,
    'accentColor', p.accent_color,
    'invoiceNumberFormat', p.invoice_number_format,
    'nextInvoiceNumber', p.next_invoice_number
  ))
$$;
revoke all on function private.profile_to_snapshot(public.profiles) from public;
grant execute on function private.profile_to_snapshot(public.profiles) to authenticated;

-- Backfill: re-stamp existing non-draft invoices using current profile/client
-- data. Safe because no real edits have happened yet on this branch.
update public.invoices i
   set client_snapshot = private.client_to_snapshot(c),
       profile_snapshot = private.profile_to_snapshot(p)
  from public.clients c, public.profiles p
 where i.client_id = c.id
   and i.profile_id = p.id
   and i.status in ('sent', 'paid', 'partial', 'overdue', 'void');
