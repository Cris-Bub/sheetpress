-- sheetPress SaaS fork — initial schema.
--
-- Tenant model: every business-data table carries workspace_id. A workspace
-- has one owner (the user that signed up) and zero+ members. v1 UI keeps a
-- single workspace per user, but the schema supports multi-member from day one
-- so we don't have to migrate later.
--
-- Money is stored as integer minor units (bigint). Pure math/format helpers
-- live in lib/format.ts and stay client-side.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- private schema for helper functions / triggers. Not exposed to the Data API.
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tenant root
-- ---------------------------------------------------------------------------

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index workspaces_owner_idx on public.workspaces(owner_id);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  -- Per-user-per-workspace UI state. Active profile is which seller identity
  -- the user is currently invoicing as.
  active_profile_id uuid,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members(user_id);

-- ---------------------------------------------------------------------------
-- Profiles (the seller's business identity)
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  business_name text not null,
  legal_name text,
  tax_id text,
  tax_id_label text,
  email text not null,
  phone text,
  address jsonb not null,
  logo_data_url text,
  default_payment_instructions text,
  default_payment_terms_days int not null default 14,
  default_notes text,
  default_currency text not null,
  default_tax_rate numeric,
  accent_color text not null default '#1a1a1a',
  invoice_number_format text not null default '{YYYY}-{####}',
  next_invoice_number int not null default 1 check (next_invoice_number > 0),
  created_at timestamptz not null default now()
);

create index profiles_workspace_idx on public.profiles(workspace_id);

-- Active-profile FK added after profiles table exists.
alter table public.workspace_members
  add constraint workspace_members_active_profile_fk
  foreign key (active_profile_id) references public.profiles(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  contact_name text,
  email text,
  tax_id text,
  address jsonb,
  default_currency text,
  notes text,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index clients_workspace_idx on public.clients(workspace_id);
create index clients_workspace_name_idx on public.clients(workspace_id, name);

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  client_id uuid references public.clients(id) on delete set null,
  number text not null,
  issue_date date not null,
  due_date date not null,
  currency text not null,
  default_tax_rate numeric,
  -- Discount as jsonb so the tagged union {type:'percent'|'amount', value:number}
  -- survives intact without two columns + a check constraint.
  discount jsonb,
  notes text,
  payment_instructions text,
  stripe_payment_link text,
  -- Frozen at send-time. Null for drafts.
  client_snapshot jsonb,
  profile_snapshot jsonb,
  status text not null
    check (status in ('draft', 'sent', 'paid', 'partial', 'overdue', 'void'))
    default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Numbering is permanent and unique per profile.
create unique index invoices_profile_number_unique on public.invoices(profile_id, number);
create index invoices_workspace_issue_idx on public.invoices(workspace_id, issue_date desc);
create index invoices_workspace_status_idx on public.invoices(workspace_id, status);
create index invoices_client_idx on public.invoices(client_id);

create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  position int not null,
  description text not null default '',
  quantity numeric not null default 0,
  unit_price bigint not null default 0,
  tax_rate numeric
);

create index invoice_line_items_invoice_idx on public.invoice_line_items(invoice_id, position);
create unique index invoice_line_items_invoice_position_unique on public.invoice_line_items(invoice_id, position);

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  payment_date date not null,
  amount bigint not null check (amount > 0),
  method text,
  note text,
  created_at timestamptz not null default now()
);

create index invoice_payments_invoice_idx on public.invoice_payments(invoice_id, payment_date desc);
create index invoice_payments_workspace_idx on public.invoice_payments(workspace_id, payment_date desc);

-- ---------------------------------------------------------------------------
-- Workspace settings (k/v)
-- ---------------------------------------------------------------------------

create table if not exists public.workspace_settings (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  key text not null,
  value jsonb,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, key)
);

-- ---------------------------------------------------------------------------
-- Invoice events (audit timeline; populated from Phase 3 onward)
-- ---------------------------------------------------------------------------

create table if not exists public.invoice_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  type text not null,
  payload jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index invoice_events_invoice_idx on public.invoice_events(invoice_id, created_at desc);
create index invoice_events_workspace_idx on public.invoice_events(workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- updated_at bump on invoice update.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public;

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function private.set_updated_at();

-- On workspace insert, add the owner as the owner member.
create or replace function private.handle_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.workspace_members(workspace_id, user_id, role)
    values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;
revoke all on function private.handle_new_workspace() from public;

drop trigger if exists workspaces_after_insert on public.workspaces;
create trigger workspaces_after_insert
  after insert on public.workspaces
  for each row execute function private.handle_new_workspace();
