'use client';

import Link from 'next/link';
import { ArrowLeft, Plus, Mail, MapPin, Hash } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/app/status-badge';
import { useClient, useInvoices, usePayments, isLoaded } from '@/lib/queries';
import { computeTotals, formatDate, formatMoney } from '@/lib/format';
import { effectiveStatus, paidAmountFor } from '@/lib/derive';

export function ClientDetailView({ id }: { id: string }) {
  const client = useClient(id);
  const allInvoices = useInvoices();
  const payments = usePayments();

  if (!isLoaded(client) || !isLoaded(allInvoices) || !isLoaded(payments)) {
    return (
      <div className="px-8 py-8 space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="px-8 py-20 text-center">
        <p className="text-muted-foreground">This client no longer exists.</p>
        <Button render={<Link href="/clients" />} variant="outline" size="sm" className="mt-4">
          Back to clients
        </Button>
      </div>
    );
  }

  const invoices = allInvoices
    .filter((i) => i.clientId === client.id)
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate));

  const now = new Date();
  const totalsByCurrency = new Map<string, { billed: number; outstanding: number; paid: number }>();
  for (const inv of invoices) {
    const t = computeTotals(inv);
    const paid = paidAmountFor(inv.id, payments);
    const cur = inv.currency;
    const entry = totalsByCurrency.get(cur) ?? { billed: 0, outstanding: 0, paid: 0 };
    entry.billed += t.total;
    entry.paid += paid;
    if (inv.status !== 'paid' && inv.status !== 'void') entry.outstanding += Math.max(0, t.total - paid);
    totalsByCurrency.set(cur, entry);
  }

  return (
    <>
      <PageHeader title={client.name} description={client.contactName}>
        <Button render={<Link href="/clients" />} variant="ghost" size="sm">
          <ArrowLeft className="size-4" />
          All clients
        </Button>
        <Button render={<Link href="/invoices/new" />}>
          <Plus className="size-4" />
          New invoice
        </Button>
      </PageHeader>

      <div className="px-8 py-8 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10 max-w-6xl">
        <div>
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Invoices ({invoices.length})
          </h2>
          {invoices.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-16 text-center">
              <p className="text-sm text-muted-foreground">No invoices yet for this client.</p>
              <Button render={<Link href="/invoices/new" />} variant="outline" size="sm" className="mt-3">
                Create the first one
              </Button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {invoices.map((inv, idx) => {
                const total = computeTotals(inv).total;
                const status = effectiveStatus(inv, payments, now);
                return (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className={
                      'flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors ' +
                      (idx > 0 ? 'border-t border-border' : '')
                    }
                  >
                    <div className="font-mono text-xs text-muted-foreground w-20 shrink-0">{inv.number}</div>
                    <div className="flex-1 text-xs text-muted-foreground">{formatDate(inv.issueDate)}</div>
                    <StatusBadge status={status} />
                    <div className="text-right tabular-nums w-28 shrink-0 text-sm font-medium">
                      {formatMoney(total, inv.currency)}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <section>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Contact</h3>
            <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm">
              {client.email ? (
                <div className="flex items-start gap-2">
                  <Mail className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <a href={`mailto:${client.email}`} className="text-foreground hover:underline truncate">
                    {client.email}
                  </a>
                </div>
              ) : null}
              {client.taxId ? (
                <div className="flex items-start gap-2">
                  <Hash className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{client.taxId}</span>
                </div>
              ) : null}
              {client.address ? (
                <div className="flex items-start gap-2">
                  <MapPin className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="text-muted-foreground">
                    <div>{client.address.line1}</div>
                    <div>
                      {client.address.city}
                      {client.address.region ? `, ${client.address.region}` : ''}{' '}
                      {client.address.postalCode}
                    </div>
                    <div>{client.address.country}</div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          {totalsByCurrency.size > 0 ? (
            <section>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Totals</h3>
              <div className="rounded-lg border border-border bg-card p-4 space-y-3 text-sm tabular-nums">
                {Array.from(totalsByCurrency.entries()).map(([cur, t]) => (
                  <div key={cur} className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Billed</span>
                      <span className="font-medium">{formatMoney(t.billed, cur)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Paid</span>
                      <span>{formatMoney(t.paid, cur)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Outstanding</span>
                      <span className={t.outstanding > 0 ? 'font-medium' : ''}>
                        {formatMoney(t.outstanding, cur)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}
