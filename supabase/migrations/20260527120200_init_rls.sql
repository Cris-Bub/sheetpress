-- sheetPress SaaS fork — Row Level Security.
--
-- Every business-data table is workspace-scoped. The single rule for tenant
-- tables: workspace_id must resolve to a row in workspace_members for auth.uid().
-- Helper lives in private.is_workspace_member so policy evaluation doesn't
-- recurse into the workspace_members policies themselves.

-- ---------------------------------------------------------------------------
-- workspaces
-- ---------------------------------------------------------------------------

alter table public.workspaces enable row level security;

create policy workspaces_select_member
  on public.workspaces for select
  to authenticated
  using (private.is_workspace_member(id));

create policy workspaces_insert_owner_is_self
  on public.workspaces for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy workspaces_update_owner
  on public.workspaces for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- No delete policy in v1: workspaces are kept (audit/financial records). Add
-- one in Phase 8 with explicit confirmation and event logging.

-- ---------------------------------------------------------------------------
-- workspace_members
-- ---------------------------------------------------------------------------

alter table public.workspace_members enable row level security;

-- A member can see their own row. Owners can see all members of their workspace
-- (used for the future teams UI; safe to keep available now).
create policy ws_members_select_self_or_owner
  on public.workspace_members for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = (select auth.uid())
    )
  );

-- INSERT is performed by the after-insert trigger on workspaces. We allow
-- workspace owners to insert further memberships (future teams flow).
create policy ws_members_insert_by_owner
  on public.workspace_members for insert
  to authenticated
  with check (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = (select auth.uid())
    )
  );

-- A member can update their own active_profile_id. Owners can change any
-- member's role.
create policy ws_members_update_self
  on public.workspace_members for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy ws_members_update_by_owner
  on public.workspace_members for update
  to authenticated
  using (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy profiles_select_member
  on public.profiles for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create policy profiles_insert_member
  on public.profiles for insert
  to authenticated
  with check (private.is_workspace_member(workspace_id));

create policy profiles_update_member
  on public.profiles for update
  to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

create policy profiles_delete_member
  on public.profiles for delete
  to authenticated
  using (private.is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------

alter table public.clients enable row level security;

create policy clients_select_member
  on public.clients for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create policy clients_insert_member
  on public.clients for insert
  to authenticated
  with check (private.is_workspace_member(workspace_id));

create policy clients_update_member
  on public.clients for update
  to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

create policy clients_delete_member
  on public.clients for delete
  to authenticated
  using (private.is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------

alter table public.invoices enable row level security;

create policy invoices_select_member
  on public.invoices for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create policy invoices_insert_member
  on public.invoices for insert
  to authenticated
  with check (private.is_workspace_member(workspace_id));

create policy invoices_update_member
  on public.invoices for update
  to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

create policy invoices_delete_member
  on public.invoices for delete
  to authenticated
  using (private.is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- invoice_line_items — workspace via invoice
-- ---------------------------------------------------------------------------

alter table public.invoice_line_items enable row level security;

create policy invoice_line_items_select_member
  on public.invoice_line_items for select
  to authenticated
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id and private.is_workspace_member(i.workspace_id)
    )
  );

create policy invoice_line_items_insert_member
  on public.invoice_line_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id and private.is_workspace_member(i.workspace_id)
    )
  );

create policy invoice_line_items_update_member
  on public.invoice_line_items for update
  to authenticated
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id and private.is_workspace_member(i.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id and private.is_workspace_member(i.workspace_id)
    )
  );

create policy invoice_line_items_delete_member
  on public.invoice_line_items for delete
  to authenticated
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id and private.is_workspace_member(i.workspace_id)
    )
  );

-- ---------------------------------------------------------------------------
-- invoice_payments
-- ---------------------------------------------------------------------------

alter table public.invoice_payments enable row level security;

create policy invoice_payments_select_member
  on public.invoice_payments for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create policy invoice_payments_insert_member
  on public.invoice_payments for insert
  to authenticated
  with check (private.is_workspace_member(workspace_id));

create policy invoice_payments_update_member
  on public.invoice_payments for update
  to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

create policy invoice_payments_delete_member
  on public.invoice_payments for delete
  to authenticated
  using (private.is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- workspace_settings
-- ---------------------------------------------------------------------------

alter table public.workspace_settings enable row level security;

create policy ws_settings_select_member
  on public.workspace_settings for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create policy ws_settings_insert_member
  on public.workspace_settings for insert
  to authenticated
  with check (private.is_workspace_member(workspace_id));

create policy ws_settings_update_member
  on public.workspace_settings for update
  to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

create policy ws_settings_delete_member
  on public.workspace_settings for delete
  to authenticated
  using (private.is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- invoice_events — append-only timeline.
-- Members can read events for their workspace; inserts come from functions
-- (mark_invoice_sent, void_invoice, etc.) which run as the calling user.
-- No update/delete: events are immutable history.
-- ---------------------------------------------------------------------------

alter table public.invoice_events enable row level security;

create policy invoice_events_select_member
  on public.invoice_events for select
  to authenticated
  using (private.is_workspace_member(workspace_id));

create policy invoice_events_insert_member
  on public.invoice_events for insert
  to authenticated
  with check (private.is_workspace_member(workspace_id));
