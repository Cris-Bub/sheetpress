-- Guard the invoice state machine at the database boundary.
--
-- RLS answers "is this row in the user's workspace?" These triggers answer the
-- next question: "is this mutation legal for an invoice record?" They keep the
-- manual/Dexie-era flexibility for drafts while preventing issued invoice
-- content and public share links from being rewritten through direct table DML.
--
-- Note: line items remain a Phase 5/production-hardening follow-up. A strict
-- "line items only change while draft" trigger would currently break backup
-- import, because imports recreate already-issued invoices and then insert
-- their historical line items.

-- ---------------------------------------------------------------------------
-- Invoices: drafts are editable; issued invoices are frozen except status.
-- ---------------------------------------------------------------------------

create or replace function private.guard_invoice_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_client public.clients%rowtype;
  v_profile public.profiles%rowtype;
  v_line_count int;
  v_old_without_status jsonb;
  v_new_without_status jsonb;
begin
  -- Drafts can be edited freely while they remain drafts.
  if old.status = 'draft' and new.status = 'draft' then
    return new;
  end if;

  -- Draft -> sent is the only transition that may create snapshots. They must
  -- exactly match the current profile/client rows so the frozen legal record is
  -- not caller-controlled JSON.
  if old.status = 'draft' and new.status = 'sent' then
    if new.client_id is null then
      raise exception 'no_client'
        using message = 'Add a client before marking as sent.';
    end if;

    select * into v_client from public.clients where id = new.client_id;
    if not found then
      raise exception 'client_missing'
        using message = 'Selected client no longer exists.';
    end if;

    select * into v_profile from public.profiles where id = new.profile_id;
    if not found then
      raise exception 'profile_missing'
        using message = 'Selected profile no longer exists.';
    end if;

    if v_client.workspace_id <> new.workspace_id or v_profile.workspace_id <> new.workspace_id then
      raise exception 'invoice_workspace_mismatch'
        using message = 'Invoice profile and client must belong to the invoice workspace.';
    end if;

    select count(*) into v_line_count
      from public.invoice_line_items
     where invoice_id = new.id;
    if v_line_count = 0 then
      raise exception 'no_line_items'
        using message = 'Add at least one line item before marking as sent.';
    end if;

    new.client_snapshot := private.client_to_snapshot(v_client);
    new.profile_snapshot := private.profile_to_snapshot(v_profile);
    return new;
  end if;

  -- Once issued, the invoice document is frozen. Later operations may only
  -- update status; `updated_at` is excluded because the existing trigger bumps it.
  v_old_without_status := to_jsonb(old) - 'status' - 'updated_at';
  v_new_without_status := to_jsonb(new) - 'status' - 'updated_at';
  if old.status <> 'draft' and v_old_without_status = v_new_without_status then
    if old.status = 'void' and new.status <> 'void' then
      raise exception 'cannot_reopen_void'
        using message = 'Voided invoices cannot be reopened.';
    end if;

    if new.status in ('sent', 'partial', 'paid', 'overdue', 'void') then
      return new;
    end if;
  end if;

  raise exception 'issued_invoice_immutable'
    using message = 'Only draft invoices can be edited.';
end;
$$;
revoke all on function private.guard_invoice_update() from public;

drop trigger if exists invoices_guard_state_machine on public.invoices;
create trigger invoices_guard_state_machine
  before update on public.invoices
  for each row execute function private.guard_invoice_update();

-- ---------------------------------------------------------------------------
-- Public links: after creation, links can only move toward revoked.
-- ---------------------------------------------------------------------------

create or replace function private.guard_public_invoice_link_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.workspace_id <> new.workspace_id
    or old.invoice_id <> new.invoice_id
    or old.token <> new.token
    or old.expires_at is distinct from new.expires_at
    or old.created_at <> new.created_at
    or old.created_by is distinct from new.created_by
  then
    raise exception 'public_link_immutable'
      using message = 'Public invoice links can only be revoked after creation.';
  end if;

  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'public_link_already_revoked'
      using message = 'Revoked public invoice links cannot be changed.';
  end if;

  if old.revoked_at is null and new.revoked_at is null then
    return new;
  end if;

  if old.revoked_at is null and new.revoked_at is not null then
    return new;
  end if;

  raise exception 'public_link_invalid_update'
    using message = 'Public invoice links can only be revoked.';
end;
$$;
revoke all on function private.guard_public_invoice_link_update() from public;

drop trigger if exists public_invoice_links_guard_revoke_only on public.public_invoice_links;
create trigger public_invoice_links_guard_revoke_only
  before update on public.public_invoice_links
  for each row execute function private.guard_public_invoice_link_update();
