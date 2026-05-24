# sheetPress — Spec

> Working title. A free, open-source, minimal invoicing app for freelancers and small businesses. A tool, not a hub.

---

## 1. Vision & Principles

**Tagline:** "Make an invoice. Get a PDF. Track who paid. That's it."

**Core principles (these are load-bearing — every decision below traces back to one):**

1. **Single purpose.** Invoicing only. No CRM, no time tracking, no project management, no payment processing. If a feature feels like it belongs in QuickBooks, it doesn't belong here.
2. **Minimal & beautiful.** Generous whitespace, calm typography, no dashboards-of-dashboards. The interface should feel like a well-designed text editor, not a SaaS portal.
3. **Privacy by default.** A freelancer's client list and revenue history are sensitive. The default should be: your data lives on your device. Sync is opt-in.
4. **Free, forever, for everyone.** No tiers, no "Pro" upsell, no telemetry. MIT-licensed. If someone wants to self-host, they should be able to in 5 minutes.
5. **Compliance-aware, not compliance-locked.** Cover what 95% of US/EU freelancers need (sequential numbering, VAT/tax IDs, tax breakdowns). Don't try to be Avalara.

---

## 2. Stack Decision

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + React 19** | Best React DX, deploys as static site OR server. App Router handles routing/layouts cleanly. Lets us start as a static export and grow into server-rendered if needed. |
| Language | **TypeScript** | Non-negotiable for a data model with money in it. |
| Styling | **Tailwind CSS v4** | Fastest path to consistent minimal design. Pairs perfectly with shadcn. |
| Components | **shadcn/ui + Radix primitives** | Copy-paste, accessible, owns its own code. No vendor lock. Matches "minimal & beautiful" out of the box. |
| Forms | **React Hook Form + Zod** | RHF is the unopinionated standard. Zod gives us a single schema that validates forms *and* serves as the data type. |
| State | **Zustand** for UI state, **Dexie live queries** for data | Zustand for ephemeral things (current invoice being edited, modal open/closed). Dexie's `useLiveQuery` for anything persistent — reactive out of the box. |
| Storage | **Dexie.js (IndexedDB) — local-first** | See §3. Zero hosting cost, true privacy, ships as a static app. |
| PDF | **@react-pdf/renderer** | See §4. The right choice for this specific use case. |
| Icons | **Lucide React** | Clean, consistent, free. |
| Deploy | **Vercel** (hosted demo) + **static export** for self-hosting | One repo, two deploy modes. |

**Why not Remix / TanStack Start / Astro?** Next.js has the deepest ecosystem for this exact stack (shadcn assumes it, react-pdf docs assume it). Picking anything else costs us hours for no real win.

**Why React at all?** The user asked for it, and react-pdf is uniquely React-native — it's a literal React renderer. Going non-React would mean giving that up.

---

## 3. Storage Architecture — Local-First

**The decision:** Data lives in the browser's IndexedDB via Dexie. No backend. No accounts.

**Why local-first wins for this app:**
- Aligns perfectly with "tool not hub" — no servers, no logins, just open and use.
- Privacy: client lists and revenue numbers are sensitive. They never touch a server we control.
- Cost: $0 to host. Static deploy to GitHub Pages / Vercel free tier / anywhere.
- Self-hostable trivially — it's literally just static files.
- IndexedDB is fast: <200ms cold-start load is realistic for thousands of invoices.

**Risks and how we handle them:**

| Risk | Mitigation |
|---|---|
| Browser wipes data | Mandatory backup nag: first-run prompt + monthly reminder. One-click export to a single JSON file (and import). |
| User wants cross-device access | **v2 feature:** optional sync via "bring your own storage" — Google Drive / Dropbox / Filesystem Access API. Never *our* server. |
| Lost data = lost tax records | The export is the source of truth as far as the user is concerned. We push hard on this in onboarding. PDFs should be saved to the user's filesystem as a second copy. |
| Safari storage limits (~1GB, prompt every 200MB) | A non-issue. 10,000 invoices ≈ 10–30 MB. We'd never hit it. |

**Schema (Dexie):**

```ts
db.version(1).stores({
  profiles: '++id, isDefault',           // your own business info(s)
  clients:  '++id, name, email',
  invoices: '++id, number, clientId, issueDate, dueDate, status, profileId',
  payments: '++id, invoiceId, date',     // partial payments tracked here
  settings: 'key',                        // app-wide settings k/v
});
```

Sequential invoice numbering is a legal requirement in many EU jurisdictions, so the `number` field is generated server-side-style — we increment from a counter stored in `settings`, with a user-configurable prefix (e.g., `2026-001`).

---

## 4. PDF Generation — answering your specific question

**Your question:** "Do I have to design a PDF first?"

**Answer:** No. You design the invoice as **React components**, and `@react-pdf/renderer` renders them straight to PDF. It's not HTML-to-PDF — it's a real PDF rendering engine that exposes a React-component API.

```tsx
<Document>
  <Page size="A4" style={styles.page}>
    <View style={styles.header}>
      <Text style={styles.title}>INVOICE</Text>
      <Text>{invoice.number}</Text>
    </View>
    {/* ...line items, totals, etc. */}
  </Page>
</Document>
```

Think of it as Flexbox for PDFs. Same mental model as React Native.

**Why this over the alternatives (verified via research):**

| Approach | Verdict for us |
|---|---|
| **@react-pdf/renderer** ✅ | <500ms generation, ~100–200KB PDFs, ~2MB bundle, runs client-side, deterministic layout, strong custom-font support. **This is our pick.** |
| Puppeteer (HTML→PDF) | 2–5s generation, ~1.7MB PDFs, requires Chromium (~50MB), needs a server. Overkill and wrong shape for a local-first static app. |
| pdfmake | JSON-declarative, works fine, but React-PDF gives us better DX and lets us share styling primitives with the on-screen preview. |
| pdf-lib | For *manipulating* existing PDFs (filling forms, etc.), not generating from scratch. Not our use case. |
| jsPDF | Lower-level, more manual layout work. No reason to take that pain. |

**Where the PDF runs:** entirely client-side. The user clicks "Download" → react-pdf produces a Blob → browser saves it. No server round trip. This is what makes the local-first story work end-to-end.

**Live preview strategy:** the editor is a **split view** — form on the left, the actual PDF rendered on the right via react-pdf's `<PDFViewer>`. So what you see while editing *is* the PDF, not an approximation. This is the killer UX move.

**Templates:** v1 ships with **one excellent template**. Users customize logo + accent color + a few font choices. We don't ship a template marketplace. (Multiple templates = v2 if there's demand.)

---

## 5. Data Model

```ts
type Profile = {
  id: string;
  businessName: string;
  legalName?: string;       // if different from businessName
  taxId?: string;           // VAT / EIN / ABN / etc. — labeled by region
  taxIdLabel?: string;      // "VAT ID" | "EIN" | "Tax ID"
  email: string;
  phone?: string;
  address: Address;
  logoDataUrl?: string;     // stored inline; no separate file storage needed
  defaultPaymentInstructions?: string;  // bank details, PayPal link, etc.
  defaultPaymentTermsDays: number;      // e.g., 14, 30
  defaultNotes?: string;
  defaultCurrency: string;  // ISO 4217: "USD", "EUR", etc.
  accentColor: string;      // hex
  invoiceNumberFormat: string; // e.g., "{YYYY}-{####}"
  nextInvoiceNumber: number;
};

type Client = {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  taxId?: string;
  address?: Address;
  defaultCurrency?: string;
  notes?: string;
  createdAt: string;
  archivedAt?: string;
};

type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;        // stored as integer cents to avoid float math
  taxRate?: number;         // percent, e.g., 21 for 21% VAT. Per-line override.
};

type Invoice = {
  id: string;
  number: string;           // "2026-001"
  profileId: string;
  clientId: string;
  clientSnapshot: Client;   // frozen at issue time — clients can change, invoices can't
  profileSnapshot: Profile; // same reason
  issueDate: string;        // ISO date
  dueDate: string;
  currency: string;
  lineItems: LineItem[];
  defaultTaxRate?: number;  // applied if a line has no per-line rate
  discount?: { type: 'percent' | 'amount'; value: number };
  notes?: string;
  paymentInstructions?: string;
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'void';
  createdAt: string;
  updatedAt: string;
};

type Payment = {
  id: string;
  invoiceId: string;
  date: string;
  amount: number;           // cents
  method?: string;          // free-text: "Bank transfer", "Stripe", "Cash"
  note?: string;
};

type Address = {
  line1: string;
  line2?: string;
  city: string;
  region?: string;          // state/province
  postalCode: string;
  country: string;          // ISO 3166-1 alpha-2
};
```

**Important design notes:**

- **`clientSnapshot` / `profileSnapshot` on Invoice.** Once issued, an invoice's representation of the parties is *frozen*. If a client later moves or you rename your business, old invoices are unchanged — critical for legal records.
- **Money as integer cents.** No floats. Ever. A `Money` helper module handles formatting, parsing, math.
- **Status is derived for `overdue`** — we compute `overdue` at read time based on `dueDate` vs. today vs. payment total. The stored status is the user's explicit choice.

---

## 6. Features

### 6.1 First-run onboarding
- Single screen: enter your business info → done. (Skippable; fillable later.)
- Show a one-time explainer: "Your data lives on this device. Back up regularly. [Export now]."
- No account creation. No email required.

### 6.2 Create / edit invoice (the main screen)
- **Split layout.** Form on left, live PDF preview on right (toggleable on mobile).
- Form sections, top to bottom: *From* (profile picker if multiple), *To* (client picker with inline "create new"), *Details* (number, dates, currency), *Items* (table with add-row), *Totals* (auto-computed, with discount + tax controls), *Notes & payment instructions*.
- **Keyboard-first:** `Tab` moves through fields; `Cmd+Enter` saves; `Cmd+D` downloads PDF; `Cmd+S` marks sent.
- Auto-save to IndexedDB as `draft` on every change (debounced). No "Save" button needed.
- Invoice number auto-generates from profile's format; user can override.
- Validation inline; cannot mark `sent` until required fields are filled.

### 6.3 Download PDF
- Single button: "Download PDF". Generates client-side via react-pdf. File saved as `{businessName}-{invoiceNumber}.pdf`.
- (v2) "Copy as PDF" — copies the Blob to clipboard for paste-into-email apps that support it.

### 6.4 Invoice list / history
- Default view: table sorted by issue date desc.
- Columns: Number, Client, Issue Date, Due Date, Total, Status.
- Status filter chips: All / Draft / Sent / Paid / Partial / Overdue.
- Client filter, date range, search (number + client name + line item text).
- Row actions: View, Edit (drafts only), Duplicate, Download PDF, Mark Paid, Void.
- Bulk: Export selected as ZIP of PDFs (v2).

### 6.5 Payment tracking
- On an invoice's detail view: "Record payment" → date, amount, method, note.
- Multiple payments per invoice → status auto-updates to `partial` or `paid` based on totals.
- Payment history shown as a small log on the invoice.
- (Optional v2) Stripe deep-link button on PDF.

### 6.6 Clients
- Lightweight CRUD. Name, email, address, tax ID, notes.
- Auto-created when typed into an invoice's "To" field for the first time.
- Per-client view: list of all invoices, total billed, total outstanding, paid this year.

### 6.7 Dashboard (small, intentionally)
- Three numbers and a list. That's it.
  - **Outstanding:** sum of unpaid + partial invoice balances.
  - **Paid this year:** for tax estimation.
  - **Overdue count:** with link to filter.
- Below: 5 most recent invoices.
- No charts. No "AI insights." If you need analytics, export to your accountant's tool.

### 6.8 Settings
- **Profile(s):** edit your business info. Support multiple profiles (e.g., one DBA, one personal).
- **Defaults:** payment terms, currency, tax rate, invoice number format, accent color, logo.
- **Tax/region presets:** picking your country sets sensible labels (VAT ID vs. EIN vs. ABN) and default tax rate.
- **Data:** Export all (JSON + ZIP of PDFs), Import, Wipe.

### 6.9 Backup & restore
- **Export:** single download — JSON with all profiles, clients, invoices, payments + bundled PDFs in a ZIP.
- **Import:** drop the ZIP back in. Idempotent (no dupes on re-import, matched by invoice number + issue date).
- **Reminder:** banner if last export was >30 days ago.

### 6.10 Compliance touch points (built-in, not optional)
- **Sequential numbering** — enforced; gaps require user confirmation (e.g., voiding 2026-005 must show "this leaves a gap, that's legal but unusual, continue?").
- **Required fields per region.** Picking "Region: EU" turns on: VAT ID display, line-item tax mode, intra-community-supply reminder.
- **Frozen snapshots** on issue (see §5).
- **Void, never delete.** Once an invoice is `sent`, you can `void` it but not erase it. The PDF still exists; the void is recorded.

---

## 7. UI/UX Approach

**Layout:**
- Persistent left sidebar: Dashboard, Invoices, Clients, Settings. That's all 4 destinations.
- Editor opens as a full-screen view, not a modal. Esc returns to list.
- No tooltips that explain obvious things. No empty-state illustrations with cartoon mascots.

**Visual language:**
- Type: a single excellent serif for the invoice itself (Lora, or PP Editorial New if budget allows) + Inter for the app chrome. The PDF should feel printed, not screenshotted.
- Color: one accent (user-pickable), otherwise neutral grays. Status colors only where they earn it (overdue = red, paid = green, sparingly).
- Density: comfortable, not cramped. Tables breathe.
- Motion: minimal. No springy modals. Crossfades and slides only.
- Dark mode: yes, both for the app and as a (rarely-used) PDF option.

**Accessibility:**
- All interactive elements keyboard-reachable.
- Form labels properly associated.
- Color is never the only signal (overdue invoices have an icon, not just a red dot).
- Tested with VoiceOver.

---

## 8. Internationalization (lite)

- **Currencies:** all ISO 4217 supported; formatting via `Intl.NumberFormat`.
- **Dates:** formatted via `Intl.DateTimeFormat`; user picks a region.
- **Tax labels:** "VAT" / "GST" / "Sales Tax" / generic — based on region preset.
- **UI language:** v1 English-only. Translation files structured (e.g., `next-intl`) from day one so we can accept community PRs later.

---

## 9. Out of scope (v1)

Saying no explicitly so the principles hold:

- **Payment processing.** No Stripe/PayPal account hookup. We show payment instructions; the user collects money on their own rails.
- **Time tracking / project management.** Use Toggl, Harvest, or paper.
- **Recurring invoices.** v2.
- **Quotes / estimates.** v2 — relatively cheap addition since the data model is mostly the same.
- **Multi-user / teams.** This is a tool for one person. Not a SaaS.
- **Email sending.** v1 generates a PDF — *you* email it. (Removes auth, removes deliverability headaches, removes server need.) v2: "Open in mail client with PDF attached" via `mailto:`.
- **Expense tracking.**
- **Reports beyond the dashboard.** Export to CSV/JSON for anything else.
- **AI features.** Not until there's a concrete problem one solves better than a form.

---

## 10. Roadmap

**v0.1 — "Make one invoice"** (week 1–2)
- Next.js skeleton, Tailwind + shadcn, Dexie schema.
- Profile setup screen.
- Invoice editor with live PDF preview.
- Download PDF.
- Local persistence.

**v0.2 — "Track them"** (week 3)
- Invoice list + filters.
- Client management.
- Payment recording, status logic.
- Dashboard.

**v0.3 — "Don't lose data"** (week 4)
- Export/import JSON + PDF ZIP.
- Backup reminder.
- Settings (defaults, region presets, accent color, logo).

**v0.4 — "Open source it"** (week 5)
- README, contribution guide, MIT license.
- Hosted demo on Vercel.
- Self-hosting docs (static export).
- Polish pass — accessibility audit, mobile QA.

**v1.0 — launch.**

**Post-v1 candidates** (let usage decide order):
- Recurring invoices
- Quotes / estimates
- Cloud sync via "bring your own storage"
- Multiple templates
- Stripe payment-link button on PDFs
- Translations

---

## 11. Open questions for you

A few decisions I'd flag for your input before we start building:

1. **Name.** "sheetPress" is the current dir name — placeholder or keep? Other directions: something one-syllable + a noun, or a real-word name like "Invoice" itself (à la Linear, Notion).
2. **Multi-profile from v1, or single profile?** Multi adds maybe 4 hours of work; matters if you ever do contract work under a separate entity. Recommend: yes, but UI hides the picker if only one exists.
3. **Hosted demo policy.** Vercel free tier is fine for a demo, but if it goes viral, costs could spike. Plan: hosted demo uses *example* data only — real use requires self-host or local-only. Or: accept Vercel costs as the marketing budget.
4. **License.** MIT (most permissive) vs. AGPL (forces forks/hosted versions to stay open). I'd default to MIT unless you specifically want to prevent someone from running a closed SaaS fork.
5. **PWA / installable?** Cheap to add (a manifest + service worker), turns the app into a desktop-feeling tool. Recommend: yes for v0.4.

---

## 12. References

- PDF lib comparison — [react-pdf vs puppeteer production analysis (dev.to)](https://dev.to/iurii_rogulia/pdf-generation-on-the-server-puppeteer-vs-react-pdfrenderer-a-production-comparison-44cg)
- EU invoice rules — [Stripe EU invoicing guide](https://stripe.com/guides/invoicing-best-practices-for-the-european-union), [Avalara EU VAT invoice requirements](https://www.avalara.com/us/en/vatlive/eu-vat-rules/eu-vat-returns/invoice-requirements-eu-vat.html)
- US cross-border invoicing — [InvoiceZap 2026 guide](https://invoicezap.app/blog/how-to-invoice-international-clients-complete-guide-for-us-uk-eu/)
- Local-first patterns — [Dexie.js docs](https://dexie.org/), [awesome-local-first](https://github.com/alexanderop/awesome-local-first)
- Competitive landscape — [xTom self-hosted invoice apps comparison](https://xtom.com/blog/comparing-the-6-best-self-hosted-invoicing-apps/) (Invoice Ninja, InvoicePlane, Crater, SolidInvoice — most are PHP/Laravel monoliths; none are React + local-first. There's a real gap here.)
