# sheetPress — Hosted SaaS Fork

This branch (`codex/saas-fork`) is the **hosted, server-backed** track of sheetPress. The `main` branch stays the local-first single-user app. Both share the same product core — *make an invoice, send it, get paid, track what happened* — and diverge only on where data lives and how the user signs in.

If you're picking this up cold, read in order: **[SPEC.md](SPEC.md)** for what the app does (with the fork's deltas called out), **[DESIGN.md](DESIGN.md)** for how it should feel (including the new §13 on setup-gated UI), then **[AGENTS.md](AGENTS.md)** for the code map, finally this doc.

---

## Why a fork instead of a flag

`main` is local-first by construction — Dexie, no auth, no server. Bolting a "cloud mode" onto it would push three competing models (data layer, auth, business logic) into every component and turn the codebase into a permanent compromise. A clean fork lets each side keep its character.

Cross-track cooperation is one-way: a SaaS user can **import** a local backup ZIP; a local user can't pull from the SaaS. That keeps the migration story honest without forcing the local app to know about accounts.

---

## Stack on this branch

| Layer | Choice | Notes |
|---|---|---|
| Database | **Supabase Postgres** | tenant via `workspace_id`, RLS on every table |
| Auth | **Supabase Auth** + `@supabase/ssr` cookie sessions | first signup auto-creates a workspace + member row |
| Migrations | **Supabase CLI** SQL files | `supabase/migrations/*.sql`, applied locally first |
| Storage | **Supabase Storage** (Phase 4+) | private buckets for PDFs, logos, exports |
| Cron | **Supabase Cron** (Phase 7+) | manual-trigger endpoint in dev, cron in prod |
| Payments | **Stripe Connect** Standard-style (Phase 5+) | direct charges; freelancer owns the Stripe relationship |
| App email | **Postmark** (Phase 7+) | transactional + inbound parsing |
| Optional Gmail | **`gmail.send`** scope (Phase 7+) | send-only; refresh tokens encrypted at rest |
| App framework | **Next.js 16 App Router** + React 19 | server components for initial load, server actions for writes |
| Client cache | **TanStack Query** | replaces Dexie's `useLiveQuery`; same hook shapes preserved |
| Forms / validation | React Hook Form + Zod | unchanged from `main` |
| PDF | `@react-pdf/renderer` | unchanged — runs client-side from the assembled DTO |

The browser **never writes business data directly**. Reads can go through server components or server-action-backed TanStack Query; writes go through server actions in `lib/server/actions/*` which call repository functions in `lib/server/repo/*`.

---

## Phase status (this branch)

- ✅ **Phase 0 — Fork & re-contract.** Branch created, SPEC §9 re-opened for SaaS items, DESIGN §13 added for setup-gated UI, this doc landed.
- ✅ **Phase 1 — Supabase foundation.** Local schema, RLS, transaction-safe numbering function, server data-access scaffolding.
- ✅ **Phase 2 — Auth & app shell.** `@supabase/ssr` cookie sessions, Next Proxy route protection, login/signup, account-aware gate.
- ✅ **Phase 3 — Manual invoice parity.** Dexie replaced with Supabase repos under the same hook signatures; backup ZIP import lands data into the authenticated workspace.
- ✅ **Phase 4 — Hosted invoice links + Storage.** Public `/pay/[token]`, opaque-token link management, private storage buckets, and `invoice_pdf_versions` schema are in place. PDF upload/version population remains a follow-up.
- ⏳ **Phase 5** — Stripe Connect + payable invoices. Not started.
- ⏳ **Phase 6** — Payment schedules. Not started.
- ⏳ **Phase 7** — App email & reminders. Not started.
- ⏳ **Phase 8** — Reply tracking & production hardening. Not started.

---

## Phase plan (full)

### Phase 0 — Fork and re-contract the product
- Create branch `codex/saas-fork` from `main`.
- Add this doc and re-open the `Out of scope` section of [SPEC.md](SPEC.md) for: payment processing, hosted accounts, hosted invoice links, app email, reminders.
- Append [DESIGN.md](DESIGN.md) §13 (setup-gated UI) — Stripe/Gmail/email-provider setup prompts must be quiet, contextual, and never block manual invoicing.
- Decision: no dual local/hosted runtime. Importing a local backup ZIP becomes the migration path.

### Phase 1 — Supabase foundation
- `supabase init`, local migrations, seed data, `.env.example`.
- Core tables: `workspaces`, `workspace_members`, `profiles`, `clients`, `invoices`, `invoice_line_items`, `invoice_payments`, `workspace_settings`, `invoice_events`.
- RLS on all tenant data, keyed on `auth.uid()` joining through `workspace_members`.
- `client_snapshot` / `profile_snapshot` stored as `jsonb` on sent invoices (frozen).
- Transaction-safe invoice numbering scoped to `profile_id` and permanent once allocated — a Postgres function that locks the profile, reads/increments the counter, formats the number, inserts the invoice row, and writes the `created` event in one transaction.
- Server data-access layer under `lib/server/*`.

### Phase 2 — Auth and app shell
- Supabase Auth via `@supabase/ssr` cookie sessions.
- Next Proxy refreshes the session cookie and protects `/`, `/invoices`, `/clients`, `/settings`.
- Replace `OnboardingGate` with an account-aware version: signed-out → `/login`; signed-in without a profile → `/onboarding`; otherwise pass through.
- First workspace auto-created on signup. Teams stay hidden in the UI for v1.
- Preserve the existing sidebar/editor/detail IA — this is a sheetPress fork, not a generic SaaS dashboard.

### Phase 3 — Manual invoice parity
- Port Dexie queries/mutations to server-backed equivalents under the same hook names (`useProfile`, `useInvoices`, `usePaymentsForInvoice`, etc.).
- Keep current routes and UX: create draft, edit autosave, list/filter/sort, detail view, duplicate, void, record manual payment, download PDF.
- Pure money/date/totals logic from [lib/format.ts](lib/format.ts) is reused unchanged.
- Normalize line items into rows; reads assemble the DTO (`Invoice` with `lineItems: LineItem[]`) so previews and PDFs render through the existing components.
- Backup ZIP import accepts the local-first format and lands data into the authenticated workspace (re-ids to UUID, idempotent on `number` + `issueDate`).
- Phase done when the hosted branch can complete the existing manual verification script from SPEC §10 — without Stripe, Gmail, or any email provider configured.

### Phase 4 — Hosted invoice links & file storage
- `public_invoice_links(invoice_id, token, expires_at, revoked_at)` with opaque tokens.
- Public route `/pay/[token]` — frozen view, no internal IDs or workspace data.
- Generated PDFs, logos, exports move to private Supabase Storage buckets.
- `invoice_pdf_versions` so sent/downloaded/emailed PDFs are reproducible.

### Phase 5 — Stripe Connect & payable invoices
- Tables: `stripe_connections`, `stripe_checkout_sessions`, `stripe_events`.
- Connect Standard-style onboarding / direct charges by default — the freelancer owns the Stripe relationship.
- Server-only Checkout Session creation; the browser never sends an amount.
- Webhook endpoint with signature verification, event-id idempotency, append-only payment writes.
- No platform fees in MVP; fee fields nullable.

### Phase 6 — Payment schedules
- `payment_schedule_items(label, due_date, amount_due, amount_paid, status, sort_order, stripe_ids, paid_at)`.
- Deposits = the first schedule item, not a separate feature.
- Schedule editor in the invoice editor; manual/offline tracking works without Stripe.
- Server-side amount calc from invoice total, successful payments, schedule state.
- Block checkout when balance is zero.

### Phase 7 — Email sending & reminders
- Postmark app-email first: invoice, reminder, PDF attachment, `email_messages` log.
- Optional Gmail OAuth later — `gmail.send` only, refresh tokens encrypted with an app key.
- Three delivery paths: copy link, send from app email, send from Gmail.
- Per-schedule-item reminders: due soon, due today, overdue.
- Reminder scanner endpoint — manually triggerable locally, called by Supabase Cron in prod.

### Phase 8 — Reply tracking & production hardening
- Postmark inbound webhook + `reply+<token>@domain` aliases.
- `inbound_email_messages` table + invoice events.
- Replies on unpaid invoices flip a derived `needs_attention` flag in the UI (not a stored status).
- Audit logs for Stripe/Gmail connect/disconnect, public link creation, manual payment changes, voids.
- DB-backed rate limits on `/pay`, checkout, email send, webhook endpoints; move to Upstash only if traffic justifies it.
- Sentry before production deploy.

---

## Data shape on this branch

- Money: integer minor units everywhere.
- Stored `invoice.status` = user intent. `paid` / `partial` / `overdue` / `needs_attention` for display are derived from payments, schedule rows, due dates, and events.
- `invoice_events` is the shared timeline for sent, downloaded, paid, reminded, replied, voided, and webhook events.
- Public-facing surfaces (Phase 4+) expose only the frozen `client_snapshot` and the schedule state needed to pay — never internal IDs.

---

## Local development bootstrap

The branch ships scaffolding only; install and start the local stack when you're ready.

1. **Install the Supabase CLI** (one of):
   - `brew install supabase/tap/supabase`
   - `npm install -g supabase`
   - [Other install methods](https://supabase.com/docs/guides/local-development/cli/getting-started)
2. **Start the local stack:** `supabase start`. First run pulls Docker images and takes a few minutes; subsequent starts are seconds.
3. **Copy env vars:** `cp .env.example .env.local`, then replace `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` with the values printed by `supabase start`.
4. **Apply migrations:** `supabase db reset` (resets to a clean state and replays all migrations + `seed.sql`).
5. **Run the app:** `npm run dev`.

Open `http://localhost:3000`, sign up, complete onboarding, create an invoice. The full manual verification path from SPEC §10 should pass.

Until the CLI is installed and the local stack is running, `npm run dev` will start but the app will show "couldn't reach Supabase" errors — that's expected. The Next dev server isn't blocked.

---

## User setup needed later

- **Supabase account/project** once you outgrow local CLI (Phase 4+ for live hosted links).
- **Stripe account with Connect enabled** for Phase 5. Local testing uses the Stripe CLI.
- **Postmark account + sending domain** for Phase 7.
- **Google Cloud OAuth app** if you want the optional Gmail send-only path.
- **Production domain** before real hosted invoice links, app email, and OAuth callbacks ship.

---

## Default choices, briefly justified

- **Supabase-centered** — chosen because Supabase covers Auth, Postgres, RLS, Storage, and Cron with the same toolchain. The Next.js + Supabase auth path is well-documented.
- **Stripe Connect Standard-style / direct charges** — Stripe positions these as the fit for SaaS platforms where the connected account owns payments. We're not the merchant of record.
- **Gmail send-only when used** — `users.messages.send` is `gmail.send`, and Google requires least-privilege scopes. We never read the inbox.
- **Postmark for app email** — transactional sending + inbound parsing in one product, matching the later reply-tracking phase.
