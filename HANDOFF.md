# sheetPress SaaS fork — audit handoff (Phases 0–4)

This document hands off the `codex/saas-fork` branch for a code/security audit. It assumes the auditor has full read access to the repo and the ability to run `supabase start` + `npm run dev` locally if they want to reproduce.

If you're picking this up cold, read in this order:

1. **[SPEC.md](SPEC.md)** — *what* the app does (with the SaaS-fork callouts).
2. **[DESIGN.md](DESIGN.md)** — *how* it should look and feel (especially the new §13 about setup-gated features).
3. **[AGENTS.md](AGENTS.md)** — file map and codebase conventions (these still apply on the fork).
4. **[SAAS-PLAN.md](SAAS-PLAN.md)** — the phase plan and rationale.
5. This document — for what's actually shipped and verified, plus where to focus the audit.

---

## TL;DR

- Branch: `codex/saas-fork` (off `main`). `main` is the unchanged local-first build.
- Stack on this branch: Next.js 16 App Router + React 19 + Supabase (Auth + Postgres + RLS + Storage) + TanStack Query + Stripe-CLI placeholders (Phase 5 not started).
- Phases 0–4 are complete and the full happy path was verified in a browser against a real local Supabase stack — see [§Verified E2E](#verified-e2e-walkthrough).
- Two RLS/data bugs were caught during verification and fixed in committed migrations — see [§Bugs caught & fixed](#bugs-caught--fixed-during-verification).
- Build is green (`npm run build`); lint has one pre-existing warning (also on `main`).
- Phase 5+ (Stripe Connect, payment schedules, app email, reminders, reply tracking) is not started.

---

## Stack & key versions

| Thing | Version | Notes |
|---|---|---|
| Next.js | `16.2.6` | Turbopack. App Router. Note the dev-time "middleware deprecated, use proxy" warning — non-blocking. |
| React | `19.2.4` | RSC + Server Actions. |
| `@supabase/ssr` | `0.10.3` | Cookie-based session handling. |
| `@supabase/supabase-js` | `2.106.2` | Database/Auth client. |
| `@tanstack/react-query` | latest | Used for client-side reactive reads against server actions. |
| `@react-pdf/renderer` | `4.5.1` | Client-side PDF render — unchanged from `main`. |
| Supabase CLI | tested with `2.x` | Local stack signing JWTs with **ES256** (asymmetric, new "publishable" keys). |
| Postgres | `17` | Configured in `supabase/config.toml`. |

The `Database` generic was deliberately **dropped** from the supabase clients (see [lib/supabase/client.ts](lib/supabase/client.ts), [server.ts](lib/supabase/server.ts), [middleware.ts](lib/supabase/middleware.ts)) because the hand-written types in [lib/supabase/types.ts](lib/supabase/types.ts) caused `insert()`/`update()` to widen to `never[]`. Running `supabase gen types typescript --local > lib/supabase/types.ts` after first `supabase start` and re-adding the generic is a clean follow-up.

---

## Phase status

| Phase | Status | Highlights |
|---|---|---|
| **0** — Fork & re-contract | ✅ Complete | Branch created, [SAAS-PLAN.md](SAAS-PLAN.md) landed, [SPEC.md §9](SPEC.md) re-opened for SaaS items, [DESIGN.md §13](DESIGN.md) added (setup-gated UI rules). |
| **1** — Supabase foundation | ✅ Complete + verified live | Schema, RLS, transaction-safe numbering, server data-access scaffolding. |
| **2** — Auth & app shell | ✅ Complete + verified live | `@supabase/ssr` cookie sessions, middleware gate, login/signup, account-aware server layout. |
| **3** — Manual invoice parity | ✅ Complete + verified live | Dexie replaced with Supabase repos under same hook signatures; backup ZIP import via server action. |
| **4** — Hosted links + file storage | ✅ Complete + verified live | `/pay/[token]`, opaque tokens, storage buckets, link management UI. |
| 5 — Stripe Connect | ⛔ Not started | — |
| 6 — Payment schedules | ⛔ Not started | — |
| 7 — App email + reminders | ⛔ Not started | — |
| 8 — Reply tracking + hardening | ⛔ Not started | — |

---

## Migrations (apply in order)

All under `supabase/migrations/`. `supabase db reset --local` replays them from scratch.

| File | What it does |
|---|---|
| `20260527120000_init_schema.sql` | All Phase 1 tables (`workspaces`, `workspace_members`, `profiles`, `clients`, `invoices`, `invoice_line_items`, `invoice_payments`, `workspace_settings`, `invoice_events`), indexes, the `private` schema, the `set_updated_at` trigger on invoices, and the after-insert trigger on `workspaces` that adds the owner as a member. |
| `20260527120100_init_functions.sql` | `private.is_workspace_member`, `public.format_invoice_number`, `public.create_invoice_draft` (atomic numbering), `public.mark_invoice_sent`, `public.void_invoice`, `public.replace_invoice_line_items`. |
| `20260527120200_init_rls.sql` | RLS policies for every public-schema table. |
| `20260527130000_phase4_public_links.sql` | `public_invoice_links`, `invoice_pdf_versions`, `public.get_public_invoice_by_token` (the only anon-accessible bridge), and the three private storage buckets with their policies. |
| `20260527140000_fix_workspaces_select_policy.sql` | **Bug fix from live verification** — see [Bug #1](#bug-1--rls-timing-on-workspace-creation). |
| `20260527150000_fix_snapshots_camelcase.sql` | **Bug fix from live verification** — see [Bug #2](#bug-2--snapshot-key-casing). |

---

## Code map

### App routes

```
app/
  layout.tsx                          Root layout — ThemeProvider, QueryProvider, Toaster, ServiceWorkerRegister
  (auth)/
    layout.tsx                        Centered narrow form, no sidebar
    actions.ts                        signInAction, signUpAction (server actions)
    login/page.tsx, login-form.tsx
    signup/page.tsx, signup-form.tsx
  auth/
    callback/route.ts                 Exchanges OAuth/magic-link codes for sessions
    sign-out/route.ts                 POST → supabase.auth.signOut() → /login
  (main)/                             Authenticated app — sidebar layout
    layout.tsx                        Server-side gate: redirects signed-out → /login, signed-in-no-workspace → /onboarding
    page.tsx, invoices/*, clients/*, settings/page.tsx
  (fullscreen)/
    onboarding/page.tsx               First-run form (creates workspace + profile + sets active)
    invoices/new/page.tsx
    invoices/[id]/edit/page.tsx, edit-invoice-view.tsx
  pay/
    [token]/page.tsx                  PUBLIC. Server component. Resolves token via RPC. notFound() on invalid/revoked/expired.
    [token]/public-invoice-page.tsx   Client view. Reuses <InvoicePreview>. Renders Total/Paid/Balance card. Optional Stripe pay-link CTA.
    [token]/not-found.tsx             "This link isn't active." fallback.
middleware.ts + lib/supabase/middleware.ts   Cookie refresh + route gate
```

### Data layer

```
lib/
  supabase/
    client.ts          getSupabaseBrowserClient — singleton browser client
    server.ts          getSupabaseServerClient — per-request server client (cookies via next/headers)
    middleware.ts      updateSession — used by middleware.ts at root
    types.ts           Hand-written Database type. Not wired into clients (see TL;DR).
  server/
    workspace.ts       requireWorkspace, tryGetWorkspace, getCurrentUser, UnauthenticatedError, NoWorkspaceError
    mapping.ts         Row ↔ DTO mappers (snake_case ↔ camelCase) for profile/client/invoice/lineItem/payment
    repo/              Direct Supabase calls — workspace, profiles, clients, invoices, payments, settings, public-invoices
    actions/           'use server' wrappers around the repos + a few orchestration actions:
                         profiles.ts         createProfileAction also bootstraps the workspace on first call
                         workspace.ts        wipeWorkspaceDataAction (for Settings → wipe)
                         backup.ts           importBackupJsonAction — accepts the local-first backup format
                         public-invoices.ts  list/create/revoke links + getPublicInvoiceByTokenAction (anon-allowed)
  queries.ts           Client-side hooks (useProfile, useInvoices, …) — TanStack Query against server actions.
                       Return shapes match the old Dexie hooks so components didn't have to change.
  mutations.ts         Client-side mutation wrappers — call server actions, then invalidate the right query keys.
  query-client.ts      Singleton QueryClient (browser) + per-request client (server).
  backup.ts            ZIP export (still client-side, reads via server actions) + import wrapper around importBackupJsonAction.
  format.ts            Pure money/date/totals — unchanged from main.
  derive.ts            Status/payment derivations — unchanged from main.
  numbering.ts         Mirrors the SQL format_invoice_number — kept in sync.
  pdf.ts, email.ts     Unchanged from main.
  types.ts             Canonical TS data model — unchanged from main.
```

### Components touched

- `components/app/sidebar.tsx` — replaced "your data lives on this device" footer with user email + sign-out form.
- `components/app/share-link-dialog.tsx` — **new**. List/create/revoke public links in the invoice detail.
- `components/app/query-provider.tsx` — **new**. Mounts the TanStack QueryClient.
- `components/app/create-client-dialog.tsx` — one import switched (was `db.clients.get`, now `getClientAction`).
- `components/app/onboarding-gate.tsx` — **deleted**. Replaced by server-side gating in `(main)/layout.tsx`.
- `components/app/dev-helper.tsx` — **deleted**. Dexie-bound.
- `lib/db.ts`, `lib/sample-data.ts` — **deleted**.

---

## Auth & gate flow

1. **Middleware** (`middleware.ts` → `lib/supabase/middleware.ts`) runs on every non-static request.
    - Refreshes the session cookie via `supabase.auth.getUser()` (whether or not the user is signed in).
    - Allows `/login`, `/signup`, `/auth/*`, `/pay/*` without auth. Everything else redirects signed-out users to `/login?next=<original>`.
    - Signed-in users on `/login` or `/signup` are bounced to `/` (or `?next=` if present).
2. **`(main)/layout.tsx`** (server component) runs after the middleware lets the request through.
    - `getCurrentUser()` → redirect to `/login` if null.
    - `tryGetWorkspace()` → redirect to `/onboarding` if the signed-in user has no workspace yet (the post-signup pre-onboarding window).
    - `getActiveProfile()` → redirect to `/onboarding` if the workspace exists but has no profile yet.
3. **Onboarding** (`app/(fullscreen)/onboarding/page.tsx`) submits to `createProfileAction`, which calls `userHasWorkspace` and bootstraps a workspace if missing (via `createWorkspaceForUser` — the after-insert trigger inserts the owner-member row).

---

## Public token model (Phase 4)

The `/pay/[token]` route is the only public surface. The threat model:

- Anonymous user knows the URL. They should see the frozen invoice and nothing else.
- Tokens are opaque, 24 random bytes → URL-safe base64 (`crypto.randomBytes(24).toString('base64url')`). ~192 bits of entropy.
- Anon has **no direct table access** to `public_invoice_links` or `invoices` — the table-level RLS denies. Confirm via `pg_policies` that the only `select` policy on `public_invoice_links` is `to authenticated`.
- The only path anon takes is the **`get_public_invoice_by_token(text)` RPC** (`SECURITY DEFINER` in the `public` schema, grant to `anon, authenticated`). It validates the token, checks `revoked_at` and `expires_at`, refuses drafts, and returns a hand-built `jsonb_build_object(...)` payload — **no `workspace_id`, no `invoice_id`, no `client_id`, no `profile_id`** appear in the response.
- The Next.js page (`/pay/[token]/page.tsx`) is `dynamic = 'force-dynamic'` with `metadata.robots.index = false`.

The `invoice_pdf_versions` table exists but is not yet populated — there is no auto-upload of the rendered PDF on send. The bucket policies are in place for when that pipeline lands.

---

## RLS model

`private.is_workspace_member(workspace_id)` is `SECURITY DEFINER` in a non-exposed schema (`private`). Every tenant-scoped table uses it as the gate. Why `SECURITY DEFINER`: if it were `SECURITY INVOKER`, the policy on `workspace_members` would recurse into itself.

| Table | Policies (select / insert / update / delete) |
|---|---|
| `workspaces` | `owner_id = auth.uid() OR is_workspace_member(id)` / `owner_id = auth.uid()` / owner only / **no policy** (deletion deferred) |
| `workspace_members` | self or workspace owner / workspace owner / self (active_profile_id) or owner / **no policy** |
| `profiles`, `clients`, `invoices`, `invoice_payments`, `workspace_settings`, `invoice_events` | `is_workspace_member(workspace_id)` across the board (events are insert-only) |
| `invoice_line_items` | gated by parent invoice's workspace |
| `public_invoice_links`, `invoice_pdf_versions` | `is_workspace_member(workspace_id)` for the auth path (anon reaches `public_invoice_links` only via the `SECURITY DEFINER` RPC) |
| Storage (`invoice-pdfs`, `logos`, `exports`) | gated by `(storage.foldername(name))[1]::uuid = workspace_id` — all three buckets are private |

---

## Bugs caught & fixed during verification

### Bug #1 — RLS timing on workspace creation

**Symptom:** Onboarding form returned `42501 (insufficient_privilege)` on the workspaces insert. Inserts succeeded with `Prefer: return=minimal` but failed with `Prefer: return=representation` (which supabase-js uses by default).

**Root cause:** The `workspaces` SELECT policy used `private.is_workspace_member(id)`, which checks the `workspace_members` table. That member row is inserted by the `workspaces_after_insert` trigger. PostgREST's `INSERT … RETURNING` evaluates the SELECT policy on the returned row in a way that didn't reliably see the freshly-inserted member row (likely due to the planner's handling of the STABLE function inside the policy's subquery).

**Fix** ([20260527140000_fix_workspaces_select_policy.sql](supabase/migrations/20260527140000_fix_workspaces_select_policy.sql)): the policy now reads `owner_id = (select auth.uid()) OR private.is_workspace_member(id)`. The owner branch resolves immediately without depending on the trigger's row being visible to the planner; multi-member access continues to work via the existing branch.

**Audit angle:** confirm this doesn't widen access — the `owner_id` column is `NOT NULL REFERENCES auth.users(id)` and only one user is ever the owner of a given workspace. The insert WITH CHECK still enforces `owner_id = auth.uid()`.

### Bug #2 — Snapshot key casing

**Symptom:** Public `/pay/[token]` rendered with the fallback "sheetPress" wordmark instead of "Cris Vega Studio", and the in-app invoice detail also dropped the business name post-send.

**Root cause:** `mark_invoice_sent` was doing `to_jsonb(client_row)` and `to_jsonb(profile_row)`, which preserves snake_case keys (`business_name`). The TS layer (and the public RPC's pass-through) reads snapshots as camelCase.

**Fix** ([20260527150000_fix_snapshots_camelcase.sql](supabase/migrations/20260527150000_fix_snapshots_camelcase.sql)): added `private.client_to_snapshot(clients)` and `private.profile_to_snapshot(profiles)` that build the JSON with explicit camelCase keys (and `jsonb_strip_nulls` for tidiness). `mark_invoice_sent` was rewritten to use these. The migration also backfills any non-draft invoices.

**Audit angle:** worth scanning every place in the TS that reads `clientSnapshot.*` or `profileSnapshot.*` to confirm nothing else relies on snake_case keys.

---

## Verified E2E walkthrough

Captured against a real local Supabase stack (`supabase start` + `npm run dev`). User: `cris+test@example.com` / `testpassword123` (you'll want to recreate this on your own machine).

1. **Signup** at `/signup` → 303 redirect → lands on `/onboarding` with the updated copy "Your data lives in your sheetPress account — synced and backed up."
2. **Onboarding** form submitted with `Cris Vega Studio` / `hello@crisvega.studio` / region `US` / currency `USD` → server action created workspace + profile + active membership → 303 to `/`.
3. **Dashboard** at `/` rendered the empty-state ("No invoices yet") with the user's email in the sidebar footer and a working "Sign out" form.
4. **`Create your first invoice`** → POST to `createInvoiceDraftAction` succeeded in ~114ms → atomic numbering RPC returned `2026-0001` → redirect to `/invoices/<uuid>/edit`.
5. **Editor** showed the split form/preview, autosave fired on every edit ("✓ Saved" tag), `From` block bound to the live active profile, `Bill to` triggered the picker dialog.
6. **Inline client create** ("Add a new client…") → form dialog → submitted `Mercer Co` → client created, bill-to chip populated.
7. **Filled** description `Logo design — May` and unit price `1250`. Preview updated live ($1,250.00 subtotal/total).
8. **`Mark sent`** → `mark_invoice_sent` RPC succeeded → status flipped to `sent`, snapshots written (camelCase post-fix), redirect to `/invoices/<uuid>`.
9. **Detail view** rendered "Sent" badge, `Total $1,250.00 / Paid $0.00 / Balance due $1,250.00`, "Mark fully paid" + "Void invoice" actions. Toolbar showed Duplicate / Download PDF / **Copy link** / Share.
10. **Copy link** dialog → "No active links. Create one to share this invoice." with an Expiration selector defaulting to `Never`.
11. **`Create link`** → server action returned `http://localhost:3000/pay/6vNpa39So5SOYR79UWq2865BG7i2VNjZ`, copied to clipboard, listed in the dialog with a copy button and a revoke button.
12. **Navigated** to the URL (same browser session — verified middleware doesn't gate `/pay/*`).
13. **Public page** rendered "INVOICE FROM **Cris Vega Studio**" header, `Total / Paid / Balance Due` card with correct amounts, full frozen invoice preview ("Cris Vega Studio" in the document header, `BILLED TO Mercer Co`, the line item, totals). No internal IDs visible.
14. **Invalid token** (`/pay/totallybogus`) → server-rendered `not-found.tsx` with "This link isn't active." copy.
15. **Revoked** the active link via the dialog → toast "Link revoked." → re-fetching the previously-working URL also rendered "This link isn't active."

---

## How to run locally (auditor)

1. `brew install supabase/tap/supabase` (or `npm i -g supabase`).
2. `supabase start` — pulls Docker images on first run.
3. Copy the printed URL and **Publishable** key into `.env.local`:
    ```
    NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
    NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
    ```
4. `supabase db reset` to apply all six migrations.
5. `npm install && npm run dev` in another terminal tab.
6. Sign up at `http://localhost:3000/signup`. Email confirmation is off in local dev (`supabase/config.toml [auth.email] enable_confirmations = false`), so the account is usable immediately.

`supabase status` and the Studio at `http://127.0.0.1:54323` are helpful for poking at DB state.

---

## Suggested audit focus areas

These are the spots most likely to have non-obvious issues:

### Security / RLS
- **`get_public_invoice_by_token`** ([20260527130000_phase4_public_links.sql](supabase/migrations/20260527130000_phase4_public_links.sql)) — the only `SECURITY DEFINER` function granted to `anon`. Audit the payload it returns: confirm no IDs leak, confirm draft filter is enforced, confirm `expires_at` and `revoked_at` gates are both checked.
- **`workspaces_select_member` policy** — see [Bug #1](#bug-1--rls-timing-on-workspace-creation). Confirm the `owner_id = auth.uid()` branch doesn't unintentionally widen access elsewhere.
- **Storage policies** in the same Phase 4 migration use `(storage.foldername(name))[1]::uuid = workspace_id`. Confirm there's no path that lets an authenticated user write under a different workspace's prefix.
- **`workspace_members` policies** — the `ws_members_select_self_or_owner` policy queries `workspaces` inline (no `is_workspace_member` recursion), but verify this can't be tricked into revealing members of other workspaces.
- **Service-role key** — referenced as `SUPABASE_SERVICE_ROLE_KEY` in `.env.example` but **never used** in the app. Confirm nothing accidentally imports it client-side.

### Data integrity
- **Atomic numbering** — `create_invoice_draft` uses `FOR UPDATE` on the profile row. Verify two concurrent calls can't produce the same number (the `(profile_id, number)` unique index also belt-and-suspenders this).
- **Payment status recompute** in [lib/server/repo/payments.ts](lib/server/repo/payments.ts) (`recomputeInvoiceStatus`) is intentionally non-atomic with the payment insert — there's a known race window for concurrent payments on the same invoice. Documented inline. For v1 single-user use this is acceptable; flag if you disagree.
- **Backup import** ([lib/server/actions/backup.ts](lib/server/actions/backup.ts)) re-IDs everything to fresh UUIDs and dedupes by `(number, issueDate)` against the existing workspace. Verify nothing slips through into other workspaces; verify file-size limits / DoS exposure on this endpoint.

### Auth flow
- **`signUpAction`** and **`signInAction`** in [app/(auth)/actions.ts](app/\(auth\)/actions.ts) — confirm the `next` query param is properly sanitized (we only accept `/`-prefixed paths). The `safeNext` helper in the same file is the relevant code.
- **Sign-out** at [app/auth/sign-out/route.ts](app/auth/sign-out/route.ts) is `POST` only and uses a `<form>` with no CSRF token — Supabase's signOut is idempotent and an attacker can only log a user out, but worth noting.
- **`@supabase/ssr` cookie behavior** — the `setAll`-on-throw pattern in [lib/supabase/server.ts](lib/supabase/server.ts) is the documented pattern but worth confirming it doesn't leak stale sessions.

### Code hygiene
- **Hand-rolled `Database` type** in [lib/supabase/types.ts](lib/supabase/types.ts) is not currently fed into the clients (see TL;DR). It's drift-prone — confirm whether the maintainer should regenerate via the CLI or accept the looser typing.
- **Pre-existing lint error** in [components/app/create-client-dialog.tsx:91](components/app/create-client-dialog.tsx) — `react-hooks/set-state-in-effect`. Same error exists on `main`; not introduced by this branch.
- **Next 16 `middleware` deprecation** warning — non-blocking, but the convention is moving to `proxy.ts`. Quick rename + slight signature tweak.

---

## Known follow-ups (deliberately not done in Phase 4)

- **PDF upload on send.** The `invoice_pdf_versions` table and `invoice-pdfs` bucket policies exist but the editor doesn't yet upload the rendered PDF to storage on `mark sent`. Whoever picks up Phase 4 wrap-up should wire `@react-pdf/renderer` → `supabase.storage.from('invoice-pdfs').upload(...)` → insert a `invoice_pdf_versions` row.
- **Move logos to Storage.** Currently `profile.logo_data_url` is a data URL on the profile row. For multi-MB logos this bloats every read. Migrating to the `logos` bucket is a Phase 4 follow-up.
- **TanStack Query devtools** are not mounted. Easy add for `NODE_ENV === 'development'`.
- **MCP scope.** The Supabase MCP server in this repo's `.mcp.json` connects to a remote hosted project (the maintainer's). Auditors running locally should be aware: `mcp__supabase__execute_sql` etc. do **not** target the local stack.

---

## Test credentials used during verification

These are local-only and persist across `supabase start`/`stop` until `supabase db reset`:

- Email: `cris+test@example.com`
- Password: `testpassword123`
- Profile: `Cris Vega Studio` / `hello@crisvega.studio`
- Client: `Mercer Co`
- Invoice: `2026-0001`, $1,250.00, status `sent`
- Public link: created and then revoked during verification (so re-creating a new one is fine)

To start fresh: `supabase db reset --local`.
