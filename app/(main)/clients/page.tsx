'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useClients, useInvoices, usePayments, isLoaded } from '@/lib/queries';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/app/empty-state';
import { computeTotals, formatMoney } from '@/lib/format';
import { paidAmountFor } from '@/lib/derive';

export default function ClientsPage() {
  const [q, setQ] = useState('');
  const clients = useClients();
  const allInvoices = useInvoices();
  const payments = usePayments();

  const enriched = useMemo(() => {
    if (!isLoaded(clients) || !isLoaded(allInvoices) || !isLoaded(payments)) return [];
    return clients.map((client) => {
      const invoices = allInvoices.filter((inv) => inv.clientId === client.id);
      const totalsByCurrency = new Map<string, { billed: number; outstanding: number }>();
      for (const inv of invoices) {
        const t = computeTotals(inv);
        const paid = paidAmountFor(inv.id, payments);
        const out = inv.status === 'paid' || inv.status === 'void' ? 0 : Math.max(0, t.total - paid);
        const cur = inv.currency;
        const entry = totalsByCurrency.get(cur) ?? { billed: 0, outstanding: 0 };
        entry.billed += t.total;
        entry.outstanding += out;
        totalsByCurrency.set(cur, entry);
      }
      return {
        client,
        invoiceCount: invoices.length,
        totals: Array.from(totalsByCurrency.entries()).map(([currency, t]) => ({ currency, ...t })),
      };
    });
  }, [clients, allInvoices, payments]);

  if (!isLoaded(clients) || !isLoaded(allInvoices) || !isLoaded(payments)) {
    return (
      <>
        <PageHeader title="Clients" />
        <div className="px-8 py-8 grid grid-cols-2 gap-4 max-w-5xl">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </>
    );
  }

  if (clients.length === 0) {
    return (
      <>
        <PageHeader title="Clients" />
        <div className="px-8 py-8">
          <EmptyState
            title="No clients yet"
            description="Clients are added automatically as you bill them. You can also add one ahead of time from here."
            action={<Button><Plus className="size-4" />Add a client</Button>}
          />
        </div>
      </>
    );
  }

  const filtered = enriched.filter(({ client }) => {
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return (
      client.name.toLowerCase().includes(needle) ||
      (client.contactName?.toLowerCase().includes(needle) ?? false) ||
      (client.email?.toLowerCase().includes(needle) ?? false)
    );
  });

  return (
    <>
      <PageHeader title="Clients" description={`${clients.length} clients`}>
        <Button>
          <Plus className="size-4" />
          Add client
        </Button>
      </PageHeader>

      <div className="px-8 py-8">
        <div className="relative max-w-sm mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search clients…"
            className="pl-9 h-9"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl">
          {filtered.map(({ client, invoiceCount, totals }) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="rounded-lg border border-border bg-card p-5 hover:border-foreground/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium truncate">{client.name}</div>
                  {client.contactName ? (
                    <div className="text-sm text-muted-foreground truncate">{client.contactName}</div>
                  ) : null}
                  {client.email ? (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{client.email}</div>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  {invoiceCount} {invoiceCount === 1 ? 'invoice' : 'invoices'}
                </div>
              </div>
              {totals.length > 0 ? (
                <div className="mt-4 pt-4 border-t border-border flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Billed</div>
                    <div className="space-y-0.5 mt-0.5 tabular-nums">
                      {totals.map((t) => (
                        <div key={t.currency} className="text-sm font-medium">
                          {formatMoney(t.billed, t.currency)}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Outstanding</div>
                    <div className="space-y-0.5 mt-0.5 tabular-nums">
                      {totals.map((t) => (
                        <div
                          key={t.currency}
                          className={'text-sm ' + (t.outstanding > 0 ? 'font-medium' : 'text-muted-foreground')}
                        >
                          {formatMoney(t.outstanding, t.currency)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
