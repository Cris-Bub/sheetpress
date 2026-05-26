# Agent instructions — sheetPress

## What this is, in 30 seconds

sheetPress is a **minimal, local-first invoicing app** for freelancers. Data lives in the browser (IndexedDB via Dexie); PDFs render client-side (`@react-pdf/renderer`); backups round-trip through a single ZIP. There is no server, no auth, no telemetry. v0 is committed and live at https://github.com/Cris-Bub/sheetpress under MIT.

If you're picking this up for the first time, read these three files in order before changing anything:

1. **[SPEC.md](SPEC.md)** — *what* the app does. Features and what's explicitly out of scope. The scope is load-bearing — adding a CRM module here is a wrong answer, not a feature request.
2. **[DESIGN.md](DESIGN.md)** — *how* the app should look and feel. Typography, color, density, the visual-first rule, the status palette. Every visual decision traces back here.
3. This file — *how* the codebase is organized and the patterns you should follow.

## File map

```
app/
  layout.tsx                    Root: fonts, theme provider, toaster, DevHelper mount
  error.tsx                     Global error boundary
  globals.css                   Tailwind v4 + design tokens (:root and .dark)
  (main)/                       Sidebar-having routes (Dashboard, Invoices, Clients, Settings)
    layout.tsx                  Wraps children in <OnboardingGate>
    page.tsx                    Dashboard (YTD proportion bar, stat cards, recent invoices)
    invoices/                   List, detail, [id]/edit lives in (fullscreen)
    clients/                    List + detail
    settings/                   Profile / Defaults / Region / Appearance / Data tabs
  (fullscreen)/                 Routes with no sidebar (editor, onboarding)
    invoices/new/page.tsx       Creates a draft, replaces URL to /[id]/edit
    invoices/[id]/edit/         page.tsx (server, awaits params) → edit-invoice-view.tsx (client)
    onboarding/page.tsx         First-run setup
components/
  app/                          App-specific components — read these before inventing a new one
  ui/                           shadcn primitives (DO NOT modify; copy and rename if you need a variant)
lib/
  types.ts                      Canonical data model. Source of truth for shapes.
  db.ts                         Dexie schema + the single `db` export
  ids.ts                        nanoid(12) wrapper
  numbering.ts                  formatInvoiceNumber({YYYY}-{####} → "2026-0007")
  format.ts                     Pure money/date helpers + computeTotals (NEVER touch storage)
  derive.ts                     Status/payment derivations (overdue, ratio, etc.)
  queries.ts                    React hooks (`useProfile`, `useInvoices`, `usePaymentsForInvoice`, …)
  mutations.ts                  Async ops (`createInvoiceDraft`, `recordPayment`, `markInvoiceSent`, …)
  pdf.ts                        renderInvoiceToBlob + downloadInvoicePdf
  email.ts                      composeInvoiceEmail + sendInvoiceEmail (Web Share API → mailto: fallback)
  backup.ts                     exportEverything + importBackup (ZIP with Zod-validated JSON + PDFs)
  sample-data.ts                Dev-only seed (used by DevHelper, NOT imported from any screen)
  utils.ts                      `cn()` from shadcn
```

`components/app/` highlights:

| File | Purpose |
|------|---------|
| `sidebar.tsx` | Persistent 220px nav (Dashboard / Invoices / Clients / Settings + New invoice CTA) |
| `page-header.tsx` | Page-title bar with optional inline actions |
| `status-badge.tsx` | Pill with paper-tinted hues per invoice status |
| `proportion-bar.tsx` | Horizontal stacked bar (also exports `ProgressBar` and `LegendDot`) |
| `spark-bars.tsx` | 12 monthly bars; pass `titles` (pre-formatted strings) for tooltips |
| `invoice-preview.tsx` | On-screen invoice rendering (HTML/Tailwind, mirrors PDF layout) |
| `invoice-pdf-document.tsx` | `@react-pdf/renderer` document — mirrors `invoice-preview` line-for-line |
| `invoice-editor.tsx` | Split editor — form left, live `<InvoicePreview>` right, autosave debounced |
| `record-payment-dialog.tsx` | Pre-fills amount to current balance; updates status via `recordPayment` |
| `create-client-dialog.tsx` | Inline create from picker (name required, address optional) |
| `confirm-dialog.tsx` | Reusable destructive-action confirmation |
| `onboarding-gate.tsx` | If no profile, redirects to /onboarding |
| `theme-provider.tsx` | next-themes wrapper (class strategy, defaults to light) |
| `empty-state.tsx` | Quiet dashed-border block with title + optional CTA |
| `dev-helper.tsx` | Floating bottom-right popover — dev-only |

## Before changing code

- **Design questions:** consult `DESIGN.md`. Match its decisions; do not freestyle visuals.
- **Feature scope questions:** consult `SPEC.md`. Out-of-scope items there should stay out of scope unless the user explicitly expands the scope, in which case **move the item out of §9** in the same PR.
- **Existing components:** check `components/ui/*` (shadcn primitives) and `components/app/*` (app-specific) before building a new component. Reuse over invent.
- **Shared logic:** `lib/format.ts` for money/date formatting and totals; `lib/derive.ts` for status/paid/overdue; `lib/types.ts` for the canonical data model. Read these before recomputing anything.

## When you make a design decision

If you introduce a new pattern (a new component, a new color use, a new density rule, a new layout convention) **update `DESIGN.md`** to record it in the right section. If your decision contradicts something already there, edit the conflicting line — don't leave both.

If you ship a feature that wasn't in `SPEC.md`, **update `SPEC.md`** — either add it to the right section or move it out of "Out of scope."

These docs are how future contributors (and future agents) avoid re-deriving the same choices. Keeping them current is part of the job.

## Stack-specific notes

- **shadcn here uses Base UI**, not Radix. The `asChild` prop does not work; use the `render` prop instead: `<Button render={<Link href="..." />}>Label</Button>`. The local `Button` wrapper auto-sets `nativeButton={false}` when `render` is provided.
- **Next.js 16 with Turbopack.** Server Components are the default; mark a file `'use client'` only when you need hooks, state, or browser APIs.
- **Tailwind v4.** Tokens live in `app/globals.css` under `:root` and `.dark`. Add new design tokens there, not as one-off classes.
- **Fonts:** Inter + Fraunces variable serif (with `SOFT`/`opsz` axes) via `next/font`. The `--font-sans` and `--font-serif` CSS variables are set on `<html>`.

## Data layer conventions

- **All persistence goes through `lib/db.ts` (Dexie)**. Don't touch IndexedDB directly. Hooks live in `lib/queries.ts`; mutations in `lib/mutations.ts`. Both files re-export the canonical types from `lib/types.ts`.
- **Money is integer minor units** (cents/öre/etc.) everywhere — storage, props, math. Display goes through `formatMoney()` in `lib/format.ts`. Helpers: `toMinor`, `toMajor`, `lineSubtotal`, `computeTotals`, `applyDiscount`, `isOverdue`.
- **Status is partly derived.** `lib/derive.ts/effectiveStatus(invoice, payments, now)` returns the *displayed* status — it walks `overdue` if dues are past, `paid` if fully covered. The stored `invoice.status` is the user's stated intent; the rendered chip uses the derived version.
- **Sequential numbering is permanent.** Once a number is assigned (`createInvoiceDraft` increments `profile.nextInvoiceNumber`), it is never released — even if a draft is deleted. Gaps are tolerated. Don't add code that decrements the counter.
- **Dexie runs in the browser only.** Any page that touches the DB must be `'use client'`. For dynamic routes that pass `params`, use the canonical pattern in `app/(main)/invoices/[id]/`:
  - `page.tsx` (server) — `async function Page({ params }) { const { id } = await params; return <ViewClient id={id} /> }`
  - `view.tsx` (client, `'use client'`) — uses `useInvoice(id)` and renders.
- **Frozen snapshots on send.** `markInvoiceSent` copies the current `client` into `invoice.clientSnapshot`. Renaming a client later does NOT alter the snapshot on already-sent invoices. This is intentional — invoices are legal records of *what was sent at the time*.

## Common changes — quick recipes

**Add a field to `Invoice`:**
1. Add it to the `Invoice` type in `lib/types.ts`.
2. If non-optional, bump the Dexie version in `lib/db.ts` (`db.version(2).stores({...})`) and add a `.upgrade()` callback that fills the field on existing rows.
3. Wire reads in the editor (`components/app/invoice-editor.tsx`), preview (`components/app/invoice-preview.tsx`), and PDF (`components/app/invoice-pdf-document.tsx`).
4. Add to `lib/backup.ts` Zod `InvoiceSchema` so imports validate.

**Add a new mutation:**
- Put the async function in `lib/mutations.ts`. Wrap multi-table writes in `db.transaction('rw', ...)`. Return the new entity (callers often want it). Throw on validation errors — the calling component shows the toast.

**Add a new screen with data:**
- File the route under `app/(main)/<name>/page.tsx` (with sidebar) or `app/(fullscreen)/<name>/page.tsx` (no sidebar).
- Mark `'use client'`, import queries from `lib/queries.ts`, render a `<Skeleton>` while `isLoaded()` is false and an `<EmptyState>` for the empty case before showing real content.

**Add a new status:**
- Update `InvoiceStatus` in `lib/types.ts`, add a key to the maps in `components/app/status-badge.tsx`, `components/app/proportion-bar.tsx#COLORS`, and `STATUS_LABELS` on the dashboard. Update `effectiveStatus` if the new status is derived.

**Tweak the PDF:** edit `components/app/invoice-pdf-document.tsx`. Use the comment-block-marked design tokens at the top of that file as the single source of truth for sizes/colors there. The on-screen `invoice-preview.tsx` is a parallel implementation — keep them visually in sync but don't try to share JSX (the primitives differ).

## Gotchas (things that bit me during development)

- **Hooks order is fixed at the call-site, not by execution.** If you add a `useEffect` AFTER an early-return guard (`if (loading) return <Spinner/>`), React will throw `Rendered more hooks than during the previous render`. Put all hooks at the top of the component, before any conditional return. The keyboard-shortcut effect in `invoice-editor.tsx` is the canonical example.
- **`//` line comments don't work between JSX attributes.** Turbopack will produce a baffling "CJS module can't be async" error. Use `{/* ... */}` between attributes, or move the comment outside the JSX element.
- **`new Date('YYYY-MM-DD')` parses as UTC midnight.** In negative-UTC-offset locales it then renders as the *previous* day. `lib/format.ts/parseISODate` handles bare date strings as local; always call `formatDate` or `formatDateShort` instead of building `Date` objects directly when displaying.
- **Server → Client component boundaries can't pass functions.** Don't pass a callback prop from a Server Component to a Client Component. If you need formatting in a client child, pass pre-computed strings (see `SparkBars` `titles` prop, not `format`).
- **Base UI's `Button` warns if `render` is a non-`<button>` element and `nativeButton` is unset.** The local `Button` wrapper handles this — keep using it. Don't import directly from `@base-ui/react/button`.
- **PDF fonts: built-in only.** `@react-pdf/renderer` requires TTF/OTF, and no stable public CDN serves Fraunces/Inter as TTF. We use Helvetica + Times-Roman (PDF built-ins) in `invoice-pdf-document.tsx`. The on-screen preview keeps Fraunces+Inter. See DESIGN.md §9.

## Dev workflow

- `npm run dev` — starts Turbopack dev server on http://localhost:3000.
- `npm run build && npm run start` — production build (no DevHelper, optimized PDF lib).
- `npm run lint` — ESLint via `eslint-config-next`.
- **Dev Helper:** floating button in the bottom-right corner *in development only*. Actions: Load sample data, Inspect DB (logs row counts to console), Skip onboarding (creates a stub profile), Wipe DB. Implementation in `components/app/dev-helper.tsx`; mount in `app/layout.tsx` is gated by `process.env.NODE_ENV === 'development'` and gets tree-shaken in production builds.
- **Manual verification:** see the script in SPEC.md §10 (out-of-scope §12 in older versions) — fresh wipe → onboarding → create invoice → autosave → mark sent → download PDF → record payments → export → wipe → import → identical state.

## Current state (as of session end)

**Working:**
- All 12 steps in the SPEC verification script pass end-to-end.
- All 6 screens render against live Dexie data with skeleton/empty states.
- Autosave, status mutations, payments, PDF download, backup ZIP round-trip, dark mode, dev helper.
- **Tax-season package:** dashboard year selector, tax-collected sub-line on the Paid tile, per-client "Paid in {year}" on cards + detail, CSV exports inside the full backup, `exportTaxYear()` mutation + Settings UI.
- **Settings completeness:** logo upload (FileReader → `profile.logoDataUrl`), default tax rate field, region preset that fills label + rate + currency via checkboxes.
- **Editor keyboard shortcuts:** Cmd+Enter or Cmd+S → mark sent; Cmd+D → download PDF; Cmd+E → share invoice. Inline `<kbd>` hints on buttons (desktop only).
- **Share invoice (lightweight, no backend):** `lib/email.ts/sendInvoiceEmail` tries `navigator.share({ files: [pdf] })` for Web-Share-with-files (Mac/iOS Safari hands the PDF to the OS share sheet — Mail, Messages, AirDrop, etc., pre-attached); falls back to `mailto:` with pre-filled subject/body + a PDF auto-download for manual attach. Primary "Share" button (lucide `Share2` icon) in the editor toolbar and on invoice detail. Auto-marks status `draft → sent` only when the share/mailto actually opens (Web Share `AbortError` is treated as a real cancel — status stays unchanged). No OAuth, no transactional MTA, the message leaves from the user's own apps. Internal naming keeps `email.ts` / `sendInvoiceEmail` / `composeInvoiceEmail` since those describe the *content* (subject + body + signature); "Share" describes the *delivery channel*. See SPEC.md §6.3.1.
- **Mobile pass:** sidebar collapses to a slide-in drawer with a hamburger top bar below `md`; editor split collapses to an Edit/Preview tab switcher below `lg`. Layout's flex direction flips to `flex-col` below `md` so the top bar stacks above main.
- **PWA installable + offline-capable:** `app/icon.tsx`, `app/apple-icon.tsx`, `app/manifest.ts`, plus a hand-rolled service worker at `public/sw.js` registered by `components/app/service-worker-register.tsx` (mounted in `app/layout.tsx`). Strategy: cache-first for `/_next/static/*` (hashed → safe forever), network-first with cached-shell fallback for HTML navigations, stale-while-revalidate for everything else. Bump `VERSION` in `public/sw.js` to invalidate caches; old caches are pruned on activate. Registration is gated to `NODE_ENV === 'production'` because Turbopack rewrites dev chunk URLs on every refresh. `next.config.ts` sends `no-cache` headers on `/sw.js` so SW updates always ship.
- **EU intra-community supply note:** `lib/derive.ts/isIntraCommunitySupply(invoice)` returns true for EU↔EU B2B with a seller VAT ID; preview and PDF render the reverse-charge note when it does.
- **Multi-profile:** `useProfiles()`, `useActiveProfileId()`, `setActiveProfile()`, `deleteProfile()`. Active profile is stored under settings key `activeProfileId` and falls back to "first profile" when unset. Settings → Profile has an Active profile picker + Add/Delete actions. `createInvoiceDraft()` uses the active profile.
- **Pay-online link:** optional `Invoice.stripePaymentLink` field. The editor has a "Pay online" section with URL validation and a Stripe-link state chip. When set, the preview (`invoice-preview.tsx#PayOnlineCard`) and PDF (`invoice-pdf-document.tsx`, using react-pdf's `<Link>`) render a "Pay {total}" CTA card in the seller's accent color. The share-email body in `lib/email.ts` includes a `Pay online: <url>` line above the signature. Backup Zod schema in `lib/backup.ts` validates the field on import. No Stripe API calls or keys — the user pastes a link they made in their own Stripe dashboard. See SPEC.md §6.3.2.

**Not yet built (worth doing, low risk):**
- **Form validation in onboarding** — currently just checks non-empty + email regex; should use Zod via `@hookform/resolvers/zod` consistently.
- **Cmd+K command palette** per SPEC §6.2.
- **"From" picker in the editor** when more than one profile exists. Currently the editor's preview pulls from the live `useProfile()` (active profile), not the invoice's saved `profileSnapshot`. Fine for single-profile users; for multi-profile, the editor should let you switch the source profile of a draft.

**Known limitations (intentional, see DESIGN.md / SPEC.md for the reasoning):**
- PDF uses built-in fonts, not Fraunces.
- No exchange-rate conversion; multi-currency totals stay separate.
- No CRM / time tracking / payment processing — these are deliberately not features. (Email sending is supported via the lightweight Web Share + `mailto:` handoff; full Gmail/Outlook OAuth-into-inbox sending stays out — see SPEC.md §9.)
- Drafts that get deleted leave numeric gaps. Permanent numbering is a uniform rule, not a bug.

## Repo hygiene

- The repo's git config is set locally to the maintainer's GitHub identity (`Cristian Villanueva <37052761+Cris-Bub@users.noreply.github.com>`). New commits should use the noreply form to keep contributions attributed without exposing personal email.
- `.claude/launch.json` is committed (shared preview-server config). `.claude/settings.local.json` is gitignored (per-machine).
- Co-author trailers on AI-assisted commits are encouraged; the human contributor must still be `author`, not just `Co-Authored-By`.

<!-- BEGIN:nextjs-agent-rules -->
## Next.js version note

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
