# sheetPress

> Make an invoice. Get a PDF. Track who paid. That's it.

A minimal, open-source invoicing app for freelancers and small businesses. Local-first — your data lives on your device, not on a server. Free, MIT-licensed, no accounts, no tracking.

## Why

Most invoicing tools are hubs disguised as tools — they want to be your CRM, your accountant, your payment processor. sheetPress does one thing: it turns line items into a clean PDF and remembers who paid you. Everything else stays out of your way.

## What it does

- **Compose invoices** in a split-view editor: form on the left, the actual PDF rendering on the right, updating as you type. What you see is what you download.
- **Generate PDFs** entirely in the browser (no server round-trip) via [@react-pdf/renderer](https://react-pdf.org).
- **Track status** automatically — drafts, sent, partial, paid, overdue, void. Status badges combine color and word, plus inline payment progress bars where they help.
- **See your year at a glance** — a horizontal stacked bar on the dashboard breaks down everything you've invoiced this year by status. Monthly spark bars show your payment cadence.
- **Sequential numbering** with token-based format strings (`{YYYY}-{####}`), permanent once assigned.
- **Multi-currency** with an honest single-currency headline plus footnotes for other currencies (no exchange-rate guessing).
- **Net X term presets** (Net 7 / 14 / 30 / 60 / 90 / Due on receipt) snap due dates with one click.
- **Backup as a single ZIP** containing JSON data + bundled PDFs. Wipe and re-import gives an identical state.
- **Light and dark mode** for the app chrome; the PDF stays paper-white either way.

## Privacy & ownership

Your data lives in your browser's IndexedDB. There is no server. There is no telemetry. There is no account. If you want sync, export the ZIP to your own storage (Dropbox, Drive, a thumb drive — anything you control).

Back up regularly. The app reminds you, but a wiped browser is a wiped database.

## Stack

- **[Next.js 16](https://nextjs.org)** (App Router, Turbopack) + **React 19** + **TypeScript**
- **[Tailwind CSS v4](https://tailwindcss.com)** + **[shadcn/ui](https://ui.shadcn.com)** (Base UI primitives)
- **[Dexie](https://dexie.org)** wrapper around IndexedDB for storage
- **[@react-pdf/renderer](https://react-pdf.org)** for PDFs (client-side)
- **[JSZip](https://stuk.github.io/jszip/)** for backup bundles
- **Inter** (sans) + **Fraunces** (variable serif) for the app
- **Helvetica + Times-Roman** in the PDF (see DESIGN.md §9 for why)

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. The first launch redirects to `/onboarding`. Fill the form, land on an empty dashboard.

In development, a floating **Dev Helper** button appears in the bottom-right corner with one-click actions: *Load sample data*, *Inspect DB*, *Skip onboarding*, *Wipe DB*. It's gated by `process.env.NODE_ENV === 'development'` and never ships in production builds.

## Self-hosting

This app is a static-friendly Next.js project with no server-side data. You can:

- **Deploy to Vercel/Netlify** with zero config.
- **Self-host** anywhere that runs Node — `npm run build && npm run start`.
- **Export statically** (some adjustments may be needed for full SSG; YMMV).

## Documentation

- [**SPEC.md**](SPEC.md) — feature contract, scope decisions, what's deliberately out of scope.
- [**DESIGN.md**](DESIGN.md) — design principles, the visual-first rule, status palette, typography, what we don't do.
- [**AGENTS.md**](AGENTS.md) — contributor (and AI agent) guide with stack-specific notes.

## Status

v0 — used personally by the author. Working set of features per SPEC.md §6. Mobile pass and some polish items are still pending; see SPEC.md §10 roadmap.

## License

[MIT](LICENSE). Use it, fork it, sell something built on top of it. The only ask: this isn't financial or legal advice. Comply with your local tax and invoicing rules.
