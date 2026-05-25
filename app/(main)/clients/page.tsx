'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useClients, useInvoices, usePayments, useProfile, isLoaded } from '@/lib/queries';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/app/empty-state';
import { CreateClientDialog } from '@/components/app/create-client-dialog';
import { ProportionBar, type Segment } from '@/components/app/proportion-bar';
import type { InvoiceStatus } from '@/lib/types';
import { computeTotals, formatMoney } from '@/lib/format';
import { effectiveStatus, paidAmountFor } from '@/lib/derive';

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  paid: 'Paid',
  partial: 'Partial',
  sent: 'Sent',
  overdue: 'Overdue',
  draft: 'Draft',
  void: 'Void',
};

export default function ClientsPage() {
  const [q, setQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const router = useRouter();
  const clients = useClients();
  const allInvoices = useInvoices();
  const payments = usePayments();
  const profile = useProfile();
  const currentYear = new Date().getFullYear();

  const enriched = useMemo(() => {
    if (!isLoaded(clients) || !isLoaded(allInvoices) || !isLoaded(payments)) return [];
    return clients.map((client) => {
      const invoices = allInvoices.filter((inv) => inv.clientId === client.id);
      const totalsByCurrency = new Map<
        string,
        { billed: number; outstanding: number; paidThisYear: number }
      >();
      const statusTotals: Record<InvoiceStatus, number> = {
        draft: 0, sent: 0, partial: 0, overdue: 0, paid: 0, void: 0,
      };
      const invById = new Map(invoices.map((i) => [i.id, i]));
      for (const inv of invoices) {
        if (inv.status === 'void') continue;
        const t = computeTotals(inv);
        const paid = paidAmountFor(inv.id, payments);
        const out = inv.status === 'paid' ? 0 : Math.max(0, t.total - paid);
        const cur = inv.currency;
        const entry = totalsByCurrency.get(cur) ?? { billed: 0, outstanding: 0, paidThisYear: 0 };
        entry.billed += t.total;
        entry.outstanding += out;
        totalsByCurrency.set(cur, entry);
        const eff = effectiveStatus(inv, payments);
        if (eff !== 'void') statusTotals[eff] += t.total;
      }
      for (const p of payments) {
        const inv = invById.get(p.invoiceId);
        if (!inv || inv.status === 'void') continue;
        if (new Date(p.date).getFullYear() !== currentYear) continue;
        const entry = totalsByCurrency.get(inv.currency) ?? { billed: 0, outstanding: 0, paidThisYear: 0 };
        entry.paidThisYear += p.amount;
        totalsByCurrency.set(inv.currency, entry);
      }
      const segments: Segment[] = (['overdue', 'partial', 'sent', 'paid', 'draft'] as InvoiceStatus[])
        .filter((s) => statusTotals[s] > 0)
        .map((s) => ({ key: s, label: STATUS_LABEL[s], value: statusTotals[s] }));
      return {
        client,
        invoiceCount: invoices.length,
        totals: Array.from(totalsByCurrency.entries()).map(([currency, t]) => ({ currency, ...t })),
        segments,
      };
    });
  }, [clients, allInvoices, payments, currentYear]);

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
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />Add a client
              </Button>
            }
          />
        </div>
        <CreateClientDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          defaultCurrency={profile?.defaultCurrency ?? 'USD'}
          onCreated={(client) => router.push(`/clients/${client.id}`)}
        />
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
        <Button onClick={() => setCreateOpen(true)}>
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
          {filtered.map(({ client, invoiceCount, totals, segments }) => (
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
                <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-3">
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
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Paid {currentYear}
                    </div>
                    <div className="space-y-0.5 mt-0.5 tabular-nums">
                      {totals.map((t) => (
                        <div
                          key={t.currency}
                          className={'text-sm ' + (t.paidThisYear > 0 ? '' : 'text-muted-foreground')}
                        >
                          {formatMoney(t.paidThisYear, t.currency)}
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
              {segments.length > 0 ? (
                <ProportionBar segments={segments} height={3} className="mt-4 opacity-80" />
              ) : null}
            </Link>
          ))}
        </div>
      </div>
      <CreateClientDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultCurrency={profile?.defaultCurrency ?? 'USD'}
        onCreated={(client) => router.push(`/clients/${client.id}`)}
      />
    </>
  );
}
