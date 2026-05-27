# sheetPress — Design Principles

This document defines how sheetPress should look and feel. Update it when a design decision is made that future contributors (or future you) shouldn't have to re-derive. Treat it as the design source of truth alongside [SPEC.md](SPEC.md).

---

## 1. Philosophy

**A tool, not a hub.** The app exists to do one thing: turn information into a clean invoice and a paid record. Anything that doesn't make that path more direct, more readable, or more confident is noise.

**Visual first, language second.** The default user is a visual thinker. A number should be paired with a shape whenever a shape can be read faster than the number. Reading is for the moments the user *chooses* to dig in, not the moments they're trying to get oriented.

**Minimal but never sterile.** Minimal isn't "absence of warmth." We use serifs, slightly off-white grounds, generous spacing, and a single human accent. The app should feel like a well-designed text editor or notebook — calm, considered, slightly literary — not a SaaS dashboard.

**Trust the user.** No empty-state illustrations explaining what an invoice is. No tooltips on labels that are already clear. No "Are you sure?" on reversible actions. Friction belongs only on the things you can't take back.

---

## 2. The visual-first rule

Whenever you show a number, ask: *can a non-reader understand the state in under a second?* If yes, ship it as-is. If not, add a visual cue.

Acceptable visual cues (ranked by how often we use them):

1. **Progress bars** — for anything that's a ratio (collection rate, partial payment, completion).
2. **Proportion bars** — horizontal stacked bars showing breakdown of a total by status.
3. **Spark bars** — twelve tiny vertical bars (one per month) to convey cadence and trend.
4. **Status badges with color + word** — never color-only.
5. **Dot legends** — to tie a chart's hues back to labels.
6. **Length/age indicators** — "5d overdue" is more useful than a date.

**Visuals must earn their place.** A pie chart for two values is wrong. A bar chart for one number is wrong. A sparkline for an empty year is wrong. If the visualization has no signal, hide it.

**Visuals must be quiet.** Muted oklch hues, thin heights (4–10px for bars, 32px for spark bars). Never gradient. Never animated unless functional. The visual is a hint, not a hero.

---

## 3. Typography

**Sans:** Inter, variable.
- Body text, UI chrome, table cells, form labels, button text.
- Use `font-feature-settings: "ss01", "cv11"` (already set in `app/globals.css`) for slightly less sterile letterforms.
- Numbers in tables, totals, and stats: always `tabular-nums` (`font-variant-numeric: tabular-nums`).

**Serif:** Fraunces, variable with `SOFT` and `opsz` axes.
- Page titles, section headings, big numbers on stat cards, "Invoice" on the document itself, brand wordmark.
- Fraunces has personality without being precious; the `SOFT` axis lets us round corners slightly when warmth matters.
- Italic Fraunces is reserved for the second half of the "sheetpress" wordmark and for muted secondary text inside the serif column.

**Sizes (Tailwind-style):**
- Page titles: `text-3xl` to `text-4xl`, serif, tight tracking.
- Section labels: `text-xs uppercase tracking-wider text-muted-foreground`.
- Body: default (`text-sm` for dense lists, `text-base` for prose).
- Big stat numbers: `text-3xl` to `text-4xl`, serif, `tabular-nums`.
- Mono: only for invoice numbers (`font-mono text-xs`) and bank/identifier fields.

**Never use a stylized typeface for input fields.** Forms get the sans. Always.

---

## 4. Color

**Ground:** warm-tinted off-white (oklch slight hue toward 80°, not pure gray).
**Foreground:** near-black, also slightly warm.
**Borders:** one step warmer than the ground.

We use `oklch()` exclusively. RGB hex appears only when a token doesn't exist for what we need (the goal is to migrate those into tokens).

**Status palette (muted, ink-like — never neon):**
| Status   | Hue        | Use                                |
|----------|------------|------------------------------------|
| Paid     | sage 145°  | success, collected                 |
| Partial  | amber 70°  | in progress                        |
| Sent     | slate 250° | awaiting                           |
| Overdue  | clay 27°   | needs attention (NOT bright red)   |
| Draft    | neutral    | not real yet                       |
| Void     | neutral    | strikethrough; deemphasized        |

**Accent:** one color, user-pickable, applied to primary buttons and the invoice's accent line. Default: near-black `#1a1a1a` (so an unconfigured user still gets something tasteful).

**Never use:**
- Pure red `#ff0000` or pure green `#00ff00` for anything.
- Drop shadows beyond `shadow-sm` (the invoice document itself is the one exception).
- Gradients (anywhere).

---

## 5. Layout

**Sidebar:** 220px, persistent on `md+`. Brand wordmark, primary CTA ("New invoice"), four nav items (Dashboard, Invoices, Clients, Settings), small backup nudge at the bottom.

**Page header:** title (serif), one-line description (muted), optional inline actions on the right. Border-bottom 1px.

**Page body padding:** `px-8 py-8` to `py-10` on main; the right-rail variant uses `grid-cols-[1fr_280px]` to `[1fr_320px]`.

**Maximum content widths:**
- Dashboard, settings: `max-w-3xl` to `max-w-5xl`.
- Invoice detail with preview: up to ~1400px to fit the document at native size.
- Editor: form is `420–520px`; preview takes the rest.

**Borders and corners:**
- Border radius: `--radius: 0.5rem`. Smaller (`rounded-md`, `rounded-full`) where appropriate.
- Borders are 1px, semantic via `border-border`. Never use `border-2`.

**Density:**
- Table rows: `py-3` to `py-3.5`. Comfortable, not cramped.
- Card padding: `p-4` for compact, `p-5–6` for primary.
- Stack space: `space-y-6` to `space-y-10` between sections.

**Empty states:** muted text, no illustrations. If we need a CTA, it's an outline button.

---

## 6. Money & numbers

- **Storage:** integer minor units (cents). Never float.
- **Display:** always via `formatMoney()` from `lib/format.ts`, which calls `Intl.NumberFormat`.
- **Default currency wins.** The dashboard's headline numbers show only the user's `defaultCurrency`. Other currencies appear as a small muted footnote (`+ €3,600 in other currencies`), never as parallel headline rows.
- **Tabular nums always.** Any column of numbers must align — `tabular-nums` is mandatory on tables, totals, and stat cards.

---

## 7. Status communication

Every status appearance must combine **at least two channels**:
- A color hue (per the status palette) AND
- Either a word ("Overdue"), a shape (a clay dot in a legend), or a length cue (a partial bar).

Never color-only. Never word-only when a graph already conveys it.

**Overdue** is the only status that gets a stronger visual treatment — clay-tinted background, deeper hue on the number — because it's actionable.

---

## 8. Interaction

- **Default to in-place.** Editing happens in the page, not in a modal. Modals are for confirmations and quick-create dialogs only.
- **Autosave.** Drafts persist without a save button. Status indicator (`Auto-saved`) lives next to the title.
- **Keyboard-first.** Every action has a keyboard path; `Tab` order is meaningful; primary actions get `Cmd+Enter`.
- **Hover states are subtle.** `bg-muted/30` to `bg-muted/50`. No transforms, no scale.
- **Transitions are short.** Default `transition-colors`, 150ms. No springy modals.

---

## 9. The invoice document

The PDF itself follows different rules than the app chrome:

- Pure white ground (`#fff`), near-black ink. Not the app's warm off-white.
- A4 ratio (`aspect-[210/297]`), padded at `~8%` of width.
- Serif title ("Invoice"), big.
- All other type: sans, 9.5pt–11pt.
- Numbers right-aligned, tabular.
- No accent color besides the optional thin rule under the header (user's accent color, default `#1a1a1a`).
- Section labels: 9pt uppercase letterspaced; like a literary magazine, not a SaaS dashboard.
- One template only. Customization is logo + accent color + a few font choices — never layout.

The on-screen invoice preview matches this exactly. What you see *is* what gets exported.

**PDF font caveat:** the rendered PDF uses Helvetica (sans) and Times-Roman (serif) — PDF built-ins — rather than Fraunces + Inter. `@react-pdf/renderer` requires TTF/OTF font files, and no stable public CDN serves these fonts in those formats. Bundling them adds ~600KB to the JS payload, which we declined. Net effect: the PDF reads as classic and printed rather than warm; the on-screen preview still uses Fraunces + Inter, so what's *worth* looking at while authoring still has personality. Revisit if/when react-pdf supports WOFF or a small font bundle proves worth the bytes.

## 9a. Permanent numbering

Once an invoice has a number, that number is permanent — even for drafts. Deleting a draft leaves a numeric gap. Voiding a sent invoice keeps the record under `status: 'void'` (still discoverable in lists, still legal evidence of "this was issued and rescinded"). The counter never goes backward.

Why: simpler model than "drafts release their number" — one rule, no edge cases. The trade-off (gaps from experimentation) is preferable to the alternative (subtle off-by-one accounting bugs).

---

## 10. What we don't do

- We don't add icons to every label.
- We don't badge feature names ("New!", "Beta").
- We don't show progress meters with arbitrary percentages.
- We don't celebrate ("🎉 Invoice paid!") — just update the status.
- We don't put pricing or upsell anywhere. The app has no tiers.
- We don't track the user, ever.

---

## 11. When in doubt

- Show less.
- Use a serif headline.
- Use `tabular-nums`.
- Add a thin visual instead of more text.
- Check the existing component library (`components/ui/*`, `components/app/*`) before inventing.
- Look at the SPEC.md if the question is about *what* a feature does; this doc is about *how* it should feel.

---

## 12. Living document

When you make a design decision that wasn't covered here — adding a new pattern, picking a new hue, defining how a new component should behave — **add it to this doc in the relevant section**. If your decision contradicts something here, update the conflict explicitly rather than leaving it stale.

---

## 13. Setup-gated features (SaaS fork only)

> Applies to the `codex/saas-fork` branch. The local-first `main` branch has no setup-gated features.

The SaaS fork unlocks things behind external accounts the user has to connect (Stripe for online payments, Postmark for app email, Gmail OAuth for send-from-your-inbox). Onboarding pressure here is the failure mode — a freelancer should be able to land in the app and write their first invoice in under a minute, without ever seeing a setup prompt.

**The rule:** **never block manual invoicing.** Setup belongs where the feature is used, not in the app shell.

**Where setup prompts live:**

- **Settings → Payments / Email** is the *only* place that surfaces setup as a primary task. A dedicated tab, no nag.
- **The invoice editor** may show a quiet inline hint (one line, muted text, no card, no icon, no CTA-shaped button) when the user is *about to do* the thing — e.g. "Add a Stripe connection in Settings → Payments to collect online" appears next to the "Pay online" section, only when that section is being edited.
- **The send/share affordance** shows a quiet inline state — the "Send from app email" option in the share menu reads "Set up app email in Settings" and is disabled. No modal, no full-card upsell.

**Where setup prompts must not live:**

- The dashboard.
- The sidebar (no badge, no dot, no count).
- The empty state of any list (no "Connect Stripe to get started").
- A first-run wizard step. The wizard captures profile info only.
- Toast notifications. Setup is never a transient message.
- Status bar / global header.

**Tone:**

- Quiet, factual, one line. "Connect Stripe in Settings → Payments to collect online." Not "Unlock payments in seconds!"
- Never use the accent color for a setup prompt — the accent is for the user's own brand. Use muted-foreground.
- Never use a badge/pill ("New", "Pro", "Required"). The whole app has no pricing tiers, and the SaaS fork keeps it that way visually.

**Disabled state for not-yet-set-up features:**

- The control stays where it would be when enabled. We don't hide it.
- It's visibly disabled (the same disabled state we use elsewhere — reduced opacity, no hover).
- A short hover/title attribute explains *why* it's disabled and *where* to enable it. That's it.

**Why this matters:** sheetPress's identity is "a tool, not a hub." The SaaS fork still has to feel that way even though it acquires real backend dependencies. If a freelancer wants to use it to type up a manual-paid invoice and never connect Stripe, that should be a completely good experience — no nags, no half-finished UI, no upsell pressure.
