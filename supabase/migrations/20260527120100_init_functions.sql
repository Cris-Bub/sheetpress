-- sheetPress SaaS fork — RPC functions for atomic business operations.
--
-- Things that need transactional atomicity live here. Everything else lives in
-- the TS server-action layer at lib/server/actions/*.

-- ---------------------------------------------------------------------------
-- Membership helper. SECURITY DEFINER + private schema to avoid recursing
-- into workspace_members RLS from policies that themselves protect that table.
-- ---------------------------------------------------------------------------

create or replace function private.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = auth.uid()
  );
$$;
revoke all on function private.is_workspace_member(uuid) from public;
grant execute on function private.is_workspace_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Invoice number formatter — mirrors lib/numbering.ts.
-- Tokens: {YYYY}, {YY}, {MM}, {#+}. The hash-group width sets zero-padding.
-- ---------------------------------------------------------------------------

create or replace function public.format_invoice_number(
  p_format text,
  p_counter int,
  p_when date default current_date
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_out text := p_format;
  v_hash_match text;
  v_hash_len int;
begin
  v_out := replace(v_out, '{YYYY}', to_char(p_when, 'YYYY'));
  v_out := replace(v_out, '{YY}', to_char(p_when, 'YY'));
  v_out := replace(v_out, '{MM}', to_char(p_when, 'MM'));
  v_hash_match := substring(v_out from '\{(#+)\}');
  if v_hash_match is not null then
    v_hash_len := length(v_hash_match);
    v_out := regexp_replace(v_out, '\{#+\}', lpad(p_counter::text, v_hash_len, '0'), 'g');
  end if;
  return v_out;
end;
$$;
revoke all on function public.format_invoice_number(text, int, date) from public;
grant execute on function public.format_invoice_number(text, int, date) to authenticated;

-- ---------------------------------------------------------------------------
-- create_invoice_draft — transaction-safe numbering scoped to profile_id.
--
-- Locks the profile row, reads/increments next_invoice_number, formats the
-- number, inserts the invoice + one empty line item, writes a 'created' event.
-- Returns the new invoice id.
--
-- The counter is permanent — even if the caller later deletes the draft, the
-- number stays consumed (mirrors the Dexie behavior).
-- ---------------------------------------------------------------------------

create or replace function public.create_invoice_draft(p_profile_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workspace_id uuid;
  v_counter int;
  v_format text;
  v_currency text;
  v_tax_rate numeric;
  v_notes text;
  v_pay_instr text;
  v_terms int;
  v_number text;
  v_invoice_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  select workspace_id, next_invoice_number, invoice_number_format,
         default_currency, default_tax_rate, default_notes,
         default_payment_instructions, default_payment_terms_days
    into v_workspace_id, v_counter, v_format,
         v_currency, v_tax_rate, v_notes, v_pay_instr, v_terms
    from public.profiles
    where id = p_profile_id
    for update;

  if not found then
    raise exception 'profile_not_found' using errcode = '23503';
  end if;

  v_number := public.format_invoice_number(v_format, v_counter);

  insert into public.invoices(
    workspace_id, profile_id, number, issue_date, due_date, currency,
    default_tax_rate, notes, payment_instructions, status
  ) values (
    v_workspace_id, p_profile_id, v_number,
    current_date, current_date + (coalesce(v_terms, 14) || ' days')::interval,
    v_currency, v_tax_rate, v_notes, v_pay_instr, 'draft'
  ) returning id into v_invoice_id;

  insert into public.invoice_line_items(invoice_id, position, description, quantity, unit_price)
    values (v_invoice_id, 0, '', 1, 0);

  update public.profiles
    set next_invoice_number = v_counter + 1
    where id = p_profile_id;

  insert into public.invoice_events(workspace_id, invoice_id, type, actor_id)
    values (v_workspace_id, v_invoice_id, 'created', v_user_id);

  return v_invoice_id;
end;
$$;
revoke all on function public.create_invoice_draft(uuid) from public;
grant execute on function public.create_invoice_draft(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- mark_invoice_sent — freeze snapshots, flip status, write event.
-- Atomicity matters: status flip and snapshot capture must happen together.
-- ---------------------------------------------------------------------------

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

  v_client_snap := to_jsonb(v_client);
  v_profile_snap := to_jsonb(v_profile);

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

-- ---------------------------------------------------------------------------
-- void_invoice — status flip + event. Drafts cannot be voided (delete them
-- instead). Voided invoices are never re-opened.
-- ---------------------------------------------------------------------------

create or replace function public.void_invoice(p_invoice_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invoice public.invoices%rowtype;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'invoice_not_found' using errcode = '23503'; end if;
  if v_invoice.status = 'draft' then
    raise exception 'cannot_void_draft' using message = 'Cannot void a draft — delete it instead.';
  end if;
  if v_invoice.status = 'void' then
    raise exception 'already_void' using message = 'Invoice is already void.';
  end if;

  update public.invoices set status = 'void' where id = p_invoice_id;

  insert into public.invoice_events(workspace_id, invoice_id, type, actor_id)
    values (v_invoice.workspace_id, p_invoice_id, 'voided', v_user_id);
end;
$$;
revoke all on function public.void_invoice(uuid) from public;
grant execute on function public.void_invoice(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- replace_invoice_line_items — atomic delete-all + insert-all used by the
-- editor's autosave. Called as `supabase.rpc('replace_invoice_line_items', ...)`.
-- ---------------------------------------------------------------------------

create or replace function public.replace_invoice_line_items(
  p_invoice_id uuid,
  p_items jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item jsonb;
  v_position int := 0;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  -- RLS on invoice_line_items enforces ownership via the invoice's workspace.
  delete from public.invoice_line_items where invoice_id = p_invoice_id;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.invoice_line_items(
      invoice_id, position, description, quantity, unit_price, tax_rate
    ) values (
      p_invoice_id,
      v_position,
      coalesce(v_item->>'description', ''),
      coalesce(nullif(v_item->>'quantity', '')::numeric, 0),
      coalesce(nullif(v_item->>'unit_price', '')::bigint, 0),
      nullif(v_item->>'tax_rate', '')::numeric
    );
    v_position := v_position + 1;
  end loop;
end;
$$;
revoke all on function public.replace_invoice_line_items(uuid, jsonb) from public;
grant execute on function public.replace_invoice_line_items(uuid, jsonb) to authenticated;
