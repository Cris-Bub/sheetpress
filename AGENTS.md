# Agent instructions — sheetPress

This is a minimal, open-source invoicing app for freelancers. Before doing UI or visual work, **read [DESIGN.md](DESIGN.md)**. It defines the typography, color, layout, density, visual-first comprehension rules, and what we explicitly don't do. The high-level feature spec lives in [SPEC.md](SPEC.md).

## Before changing code

- **Design questions:** consult `DESIGN.md`. Match its decisions; do not freestyle visuals.
- **Feature scope questions:** consult `SPEC.md`. Out-of-scope items there should stay out of scope.
- **Existing components:** `components/ui/*` (shadcn primitives) and `components/app/*` (app-specific) — check them before building a new component. Reuse over invent.
- **Shared logic:** `lib/format.ts` for money/date formatting and totals; `lib/derive.ts` for status/paid/overdue calculations; `lib/types.ts` for the canonical data model. Read these before recomputing anything.
- **Mock data lives in `lib/mock-data.ts`** and drives all screens until persistence ships.

## When you make a design decision

If you introduce a new pattern (a new component, a new color use, a new density rule, a new layout convention) **update `DESIGN.md`** to record it in the right section. If your decision contradicts something already there, edit the conflicting line — don't leave both.

If you ship a feature that wasn't in `SPEC.md`, **update `SPEC.md`** — either add it to the right section or move it out of "Out of scope."

These docs are how future contributors (and future agents) avoid re-deriving the same choices. Keeping them current is part of the job.

## Stack-specific notes

- **shadcn here uses Base UI**, not Radix. The `asChild` prop does not work; use the `render` prop instead: `<Button render={<Link href="..." />}>Label</Button>`. The local `Button` wrapper auto-sets `nativeButton={false}` when `render` is provided.
- **Next.js 16 with Turbopack.** Server Components are the default; mark a file `'use client'` only when you need hooks, state, or browser APIs.
- **Tailwind v4.** Tokens live in `app/globals.css` under `:root` and `.dark`. Add new design tokens there, not as one-off classes.

## Data layer conventions

- **All persistence goes through `lib/db.ts` (Dexie)**. Don't touch IndexedDB directly. Hooks live in `lib/queries.ts`; mutations in `lib/mutations.ts`. Both files re-export the canonical types from `lib/types.ts`.
- **Money is integer minor units** (cents/öre/etc.) everywhere — storage, props, and math. Display goes through `formatMoney()` in `lib/format.ts`. Pure helpers: `toMinor`, `toMajor`, `lineSubtotal`, `computeTotals`, `applyDiscount`, `isOverdue`.
- **Status is partly derived.** `lib/derive.ts/effectiveStatus(invoice, payments, now)` returns the *displayed* status — it walks `overdue` if dues are past, `paid` if fully covered. The stored `invoice.status` is the user's stated intent; the rendered chip uses the derived version.
- **Dexie runs in the browser only.** Any page that touches the DB must be `'use client'`. For dynamic routes that pass `params`, use the pattern: a tiny server `page.tsx` awaits the params and forwards them to a `xxx-view.tsx` client component that does the actual work. See `app/(main)/invoices/[id]/` for the canonical example.

## Dev-only tooling

The bottom-right floating helper button (`components/app/dev-helper.tsx`) is mounted only when `process.env.NODE_ENV === 'development'`. It exposes Load sample data, Inspect DB, Skip onboarding, and Wipe DB. Remove the mount before shipping v1.

<!-- BEGIN:nextjs-agent-rules -->
## Next.js version note

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
