'use client';

import { useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InvoicePreview } from '@/components/app/invoice-preview';
import { computeTotals, formatMoney } from '@/lib/format';
import { downloadInvoicePdf } from '@/lib/pdf';
import type { Invoice } from '@/lib/types';
import type { PublicInvoiceView } from '@/lib/server/actions/public-invoices';

/**
 * Builds an Invoice-shaped object from the public view payload. Internal IDs
 * are stubbed because they're never exposed in the public surface.
 */
function toInvoice(data: PublicInvoiceView): Invoice {
  return {
    id: '',
    number: data.number,
    profileId: '',
    clientId: '',
    issueDate: data.issueDate,
    dueDate: data.dueDate,
    currency: data.currency,
    lineItems: data.lineItems.map((item, idx) => ({
      ...item,
      id: `pub-${idx}`,
    })),
    defaultTaxRate: data.defaultTaxRate ?? undefined,
    discount: data.discount ?? undefined,
    notes: data.notes ?? undefined,
    paymentInstructions: data.paymentInstructions ?? undefined,
    stripePaymentLink: data.stripePaymentLink ?? undefined,
    status: data.status,
    clientSnapshot: data.clientSnapshot ?? {
      id: '',
      name: '',
      createdAt: new Date().toISOString(),
    },
    profileSnapshot:
      data.profileSnapshot ?? ({
        id: '',
        businessName: '',
      } as Invoice['profileSnapshot']),
    createdAt: '',
    updatedAt: '',
  };
}

export function PublicInvoicePage({ data }: { data: PublicInvoiceView }) {
  const invoice = toInvoice(data);
  const totals = computeTotals(invoice);
  const balance = Math.max(0, totals.total - data.paidAmount);
  const fullyPaid = balance === 0;
  const [downloading, setDownloading] = useState(false);

  const onDownload = async () => {
    setDownloading(true);
    try {
      await downloadInvoicePdf(invoice);
    } finally {
      setDownloading(false);
    }
  };

  const businessName = data.profileSnapshot?.businessName ?? '';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Invoice from</p>
            <p className="font-serif text-lg truncate">{businessName || 'sheetPress'}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onDownload}
            disabled={downloading}
            className="shrink-0"
          >
            <Download className="size-4" />
            {downloading ? 'Preparing…' : 'Download PDF'}
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Total</p>
              <p className="font-serif text-2xl tabular-nums mt-1">
                {formatMoney(totals.total, data.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Paid</p>
              <p className="font-serif text-2xl tabular-nums mt-1">
                {formatMoney(data.paidAmount, data.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {fullyPaid ? 'Status' : 'Balance due'}
              </p>
              <p className="font-serif text-2xl tabular-nums mt-1">
                {fullyPaid ? 'Paid' : formatMoney(balance, data.currency)}
              </p>
            </div>
          </div>

          {data.stripePaymentLink && !fullyPaid ? (
            <div className="mt-5 pt-5 border-t border-border">
              <a
                href={data.stripePaymentLink}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 text-sm font-medium underline-offset-4 hover:underline"
                style={{
                  color: data.profileSnapshot?.accentColor || undefined,
                }}
              >
                Pay {formatMoney(balance, data.currency)} online
                <ExternalLink className="size-4" />
              </a>
            </div>
          ) : null}
        </section>

        <section>
          <InvoicePreview invoice={invoice} />
        </section>

        <footer className="text-xs text-muted-foreground text-center py-6">
          Sent with sheetPress.
        </footer>
      </main>
    </div>
  );
}
