-- Hardening pass from the Phase 0-4 audit.
--
-- RLS decides who can touch rows. These triggers additionally enforce that
-- workspace-scoped foreign keys point at rows in the same workspace. Without
-- this, a buggy or malicious authenticated client could create a row in its
-- own workspace that references a guessed UUID from another workspace.

-- ---------------------------------------------------------------------------
-- Workspace consistency for invoices.
-- ---------------------------------------------------------------------------

create or replace function private.enforce_invoice_workspace_refs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
      from public.profiles p
     where p.id = new.profile_id
       and p.workspace_id = new.workspace_id
  ) then
    raise exception 'profile_workspace_mismatch'
      using message = 'Invoice profile must belong to the invoice workspace.';
  end if;

  if new.client_id is not null and not exists (
    select 1
      from public.clients c
     where c.id = new.client_id
       and c.workspace_id = new.workspace_id
  ) then
    raise exception 'client_workspace_mismatch'
      using message = 'Invoice client must belong to the invoice workspace.';
  end if;

  return new;
end;
$$;
revoke all on function private.enforce_invoice_workspace_refs() from public;

drop trigger if exists invoices_enforce_workspace_refs on public.invoices;
create trigger invoices_enforce_workspace_refs
  before insert or update of workspace_id, profile_id, client_id on public.invoices
  for each row execute function private.enforce_invoice_workspace_refs();

-- ---------------------------------------------------------------------------
-- Workspace consistency for invoice children that also carry workspace_id.
-- ---------------------------------------------------------------------------

create or replace function private.enforce_child_invoice_workspace()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
      from public.invoices i
     where i.id = new.invoice_id
       and i.workspace_id = new.workspace_id
  ) then
    raise exception 'invoice_workspace_mismatch'
      using message = 'Referenced invoice must belong to the row workspace.';
  end if;

  return new;
end;
$$;
revoke all on function private.enforce_child_invoice_workspace() from public;

drop trigger if exists invoice_payments_enforce_workspace_refs on public.invoice_payments;
create trigger invoice_payments_enforce_workspace_refs
  before insert or update of workspace_id, invoice_id on public.invoice_payments
  for each row execute function private.enforce_child_invoice_workspace();

drop trigger if exists invoice_events_enforce_workspace_refs on public.invoice_events;
create trigger invoice_events_enforce_workspace_refs
  before insert or update of workspace_id, invoice_id on public.invoice_events
  for each row execute function private.enforce_child_invoice_workspace();

drop trigger if exists public_invoice_links_enforce_workspace_refs on public.public_invoice_links;
create trigger public_invoice_links_enforce_workspace_refs
  before insert or update of workspace_id, invoice_id on public.public_invoice_links
  for each row execute function private.enforce_child_invoice_workspace();

drop trigger if exists invoice_pdf_versions_enforce_workspace_refs on public.invoice_pdf_versions;
create trigger invoice_pdf_versions_enforce_workspace_refs
  before insert or update of workspace_id, invoice_id on public.invoice_pdf_versions
  for each row execute function private.enforce_child_invoice_workspace();

-- ---------------------------------------------------------------------------
-- Workspace consistency for per-member active profiles.
-- ---------------------------------------------------------------------------

create or replace function private.enforce_member_active_profile_workspace()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.active_profile_id is not null and not exists (
    select 1
      from public.profiles p
     where p.id = new.active_profile_id
       and p.workspace_id = new.workspace_id
  ) then
    raise exception 'active_profile_workspace_mismatch'
      using message = 'Active profile must belong to the member workspace.';
  end if;

  return new;
end;
$$;
revoke all on function private.enforce_member_active_profile_workspace() from public;

drop trigger if exists workspace_members_enforce_active_profile_workspace on public.workspace_members;
create trigger workspace_members_enforce_active_profile_workspace
  before insert or update of workspace_id, active_profile_id on public.workspace_members
  for each row execute function private.enforce_member_active_profile_workspace();

-- The previous self-update policy let future non-owner members update any
-- column on their own membership row, including `role`. In v1 only owners need
-- to update membership rows, and owner updates still cover active-profile
-- changes for the current single-user workspace flow.
drop policy if exists ws_members_update_self on public.workspace_members;

-- ---------------------------------------------------------------------------
-- Public invoice links should not keep rendering voided invoices.
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
  if v_invoice.status in ('draft', 'void') then return null; end if;

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
