import type { Invoice } from '@/lib/types';
import { computeTotals, formatDate, formatMoney, lineSubtotal } from '@/lib/format';
import { isIntraCommunitySupply } from '@/lib/derive';
import { cn } from '@/lib/utils';

function Address({
  address,
  className,
}: {
  address?: Invoice['profileSnapshot']['address'];
  className?: string;
}) {
  if (!address) return null;
  return (
    <div className={cn('text-[10pt] leading-relaxed', className)}>
      <div>{address.line1}</div>
      {address.line2 ? <div>{address.line2}</div> : null}
      <div>
        {address.city}
        {address.region ? `, ${address.region}` : ''} {address.postalCode}
      </div>
      <div>{address.country}</div>
    </div>
  );
}

export function InvoicePreview({ invoice, className }: { invoice: Invoice; className?: string }) {
  const totals = computeTotals(invoice);
  const { profileSnapshot: p, clientSnapshot: c } = invoice;

  return (
    <div
      className={cn(
        'bg-white text-zinc-900 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_8px_24px_-12px_rgba(0,0,0,0.18)] rounded-sm',
        'aspect-[210/297] w-full max-w-[820px]',
        'p-[8%] flex flex-col font-sans',
        className,
      )}
      style={{ fontFamily: 'var(--font-sans), Inter, sans-serif' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-8">
        <div>
          <div className="font-serif text-[28pt] leading-none tracking-tight">Invoice</div>
          <div
            className="mt-2 h-[3px] w-12 rounded-full"
            style={{ background: invoice.profileSnapshot.accentColor || '#1a1a1a' }}
          />
          <div className="mt-2 font-mono text-[10pt] text-zinc-500">{invoice.number}</div>
        </div>
        <div className="text-right">
          <div className="text-[11pt] font-medium">{p.businessName}</div>
          {p.legalName && p.legalName !== p.businessName ? (
            <div className="text-[10pt] text-zinc-500">{p.legalName}</div>
          ) : null}
          <Address address={p.address} className="mt-2 text-zinc-600" />
          <div className="mt-2 text-[10pt] text-zinc-600">{p.email}</div>
          {p.taxId ? (
            <div className="text-[10pt] text-zinc-500">
              {p.taxIdLabel ?? 'Tax ID'}: {p.taxId}
            </div>
          ) : null}
        </div>
      </div>

      {/* Bill to + dates */}
      <div className="mt-10 flex items-start justify-between gap-8">
        <div>
          <div className="text-[9pt] uppercase tracking-widest text-zinc-400">Billed to</div>
          <div className="mt-2 text-[11pt] font-medium">{c.name}</div>
          {c.contactName ? <div className="text-[10pt] text-zinc-600">{c.contactName}</div> : null}
          <Address address={c.address} className="mt-1.5 text-zinc-600" />
          {c.taxId ? <div className="mt-1 text-[10pt] text-zinc-500">Tax ID: {c.taxId}</div> : null}
        </div>
        <div className="text-right">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[10pt]">
            <div className="text-zinc-500">Issue date</div>
            <div>{formatDate(invoice.issueDate)}</div>
            <div className="text-zinc-500">Due date</div>
            <div>{formatDate(invoice.dueDate)}</div>
            <div className="text-zinc-500">Amount due</div>
            <div className="font-medium tabular-nums">
              {formatMoney(totals.total, invoice.currency)}
            </div>
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="mt-10">
        <div className="grid grid-cols-[1fr_60px_100px_100px] gap-4 text-[9pt] uppercase tracking-widest text-zinc-400 border-b border-zinc-200 pb-2">
          <div>Description</div>
          <div className="text-right">Qty</div>
          <div className="text-right">Unit price</div>
          <div className="text-right">Amount</div>
        </div>
        {invoice.lineItems.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[1fr_60px_100px_100px] gap-4 py-2.5 text-[10pt] border-b border-zinc-100 last:border-b-0"
          >
            <div>{item.description || <span className="text-zinc-300">—</span>}</div>
            <div className="text-right tabular-nums text-zinc-600">{item.quantity}</div>
            <div className="text-right tabular-nums text-zinc-600">
              {formatMoney(item.unitPrice, invoice.currency)}
            </div>
            <div className="text-right tabular-nums">
              {formatMoney(lineSubtotal(item), invoice.currency)}
            </div>
          </div>
        ))}
        {invoice.lineItems.length === 0 ? (
          <div className="py-6 text-center text-[10pt] text-zinc-300">No items yet</div>
        ) : null}
      </div>

      {/* Totals */}
      <div className="mt-6 flex justify-end">
        <div className="w-[260px] text-[10pt] space-y-1">
          <Row label="Subtotal" value={formatMoney(totals.subtotal, invoice.currency)} />
          {totals.discount > 0 ? (
            <Row label="Discount" value={`−${formatMoney(totals.discount, invoice.currency)}`} muted />
          ) : null}
          {totals.tax > 0 ? (
            <Row label="Tax" value={formatMoney(totals.tax, invoice.currency)} muted />
          ) : null}
          <div className="border-t border-zinc-200 pt-2 mt-1">
            <Row
              label="Total"
              value={formatMoney(totals.total, invoice.currency)}
              bold
              size="lg"
            />
          </div>
        </div>
      </div>

      {/* Intra-community supply reminder (EU↔EU B2B) */}
      {isIntraCommunitySupply(invoice) ? (
        <div className="mt-6 border-l-2 border-zinc-300 pl-3 py-1 text-[9pt] text-zinc-600 italic">
          Intra-community supply — VAT reverse charge, Article 196 of Directive 2006/112/EC.
        </div>
      ) : null}

      {/* Bottom block: pay-online CTA (optional) sits just above the
          Notes / Payment footer so they read as a single closing section. */}
      <div className="mt-auto pt-10">
        {invoice.stripePaymentLink ? (
          <PayOnlineCard
            href={invoice.stripePaymentLink}
            accent={invoice.profileSnapshot.accentColor || '#1a1a1a'}
            amount={formatMoney(totals.total, invoice.currency)}
          />
        ) : null}
        <div
          className={cn(
            'grid grid-cols-2 gap-8 text-[9.5pt] text-zinc-600',
            invoice.stripePaymentLink ? 'mt-6' : '',
          )}
        >
          {invoice.notes ? (
            <div>
              <div className="text-[9pt] uppercase tracking-widest text-zinc-400 mb-2">Notes</div>
              <div className="whitespace-pre-line leading-relaxed">{invoice.notes}</div>
            </div>
          ) : (
            <div />
          )}
          {invoice.paymentInstructions ? (
            <div>
              <div className="text-[9pt] uppercase tracking-widest text-zinc-400 mb-2">
                Payment
              </div>
              <div className="whitespace-pre-line leading-relaxed">
                {invoice.paymentInstructions}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  bold,
  size,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
  size?: 'lg';
}) {
  return (
    <div
      className={cn(
        'flex justify-between tabular-nums',
        muted && 'text-zinc-500',
        bold && 'font-medium',
        size === 'lg' && 'text-[12pt]',
      )}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/**
 * Pay-online card. Styled to live inside the invoice document: uses the seller's
 * accent color, restrained typography, and a single clear CTA so it reads as
 * part of the document rather than an injected ad.
 */
function PayOnlineCard({
  href,
  accent,
  amount,
}: {
  href: string;
  accent: string;
  amount: string;
}) {
  return (
    <div className="mt-8 rounded-md border border-zinc-200 bg-zinc-50 p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-[9pt] uppercase tracking-widest text-zinc-400">Pay online</div>
        <div className="mt-1 text-[10.5pt] text-zinc-700 leading-snug">
          Pay this invoice securely with a card or bank — instant receipt.
        </div>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-white text-[10pt] font-medium tracking-tight no-underline shadow-sm hover:shadow transition-shadow"
        style={{ backgroundColor: accent }}
      >
        <span>Pay {amount}</span>
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M7 17L17 7" />
          <path d="M8 7h9v9" />
        </svg>
      </a>
    </div>
  );
}
