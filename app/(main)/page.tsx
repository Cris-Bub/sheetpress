'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { StatusBadge } from '@/components/app/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/app/empty-state';
import { ProportionBar, ProgressBar, LegendDot } from '@/components/app/proportion-bar';
import { SparkBars } from '@/components/app/spark-bars';
import { useInvoices, usePayments, useProfile, isLoaded } from '@/lib/queries';
import {
  outstandingByCurrency,
  paidThisYearByCurrency,
  overdueCount,
  paidAmountFor,
  effectiveStatus,
  pickCurrency,
  otherCurrencies,
  ytdBreakdown,
  monthlyPaymentsForYear,
  paymentRatio,
  daysOverdue,
} from '@/lib/derive';
import { computeTotals, formatDate, formatMoney } from '@/lib/format';
import type { InvoiceStatus } from '@/lib/types';

const STATUS_ORDER: InvoiceStatus[] = ['paid', 'partial', 'sent', 'overdue', 'draft'];
const STATUS_LABELS: Record<InvoiceStatus, string> = {
  paid: 'Paid',
  partial: 'Partial',
  sent: 'Sent',
  overdue: 'Overdue',
  draft: 'Draft',
  void: 'Void',
};

export default function Dashboard() {
  const profile = useProfile();
  const invoices = useInvoices();
  const payments = usePayments();

  if (!isLoaded(profile) || !isLoaded(invoices) || !isLoaded(payments)) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <div className="px-8 py-10 max-w-5xl space-y-8">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-3 gap-px bg-border rounded-lg overflow-hidden">
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </div>
        </div>
      </>
    );
  }

  const firstName = profile?.legalName?.split(' ')[0] ?? profile?.businessName?.split(' ')[0] ?? 'there';

  if (invoices.length === 0) {
    return (
      <>
        <PageHeader title={`Hi, ${firstName}.`} description="Let's make your first invoice." />
        <div className="px-8 py-10 max-w-5xl">
          <EmptyState
            title="No invoices yet"
            description="When you create an invoice, you'll see your year at a glance here — what's outstanding, paid, and overdue."
            action={
              <Button render={<Link href="/invoices/new" />} size="lg">
                Create your first invoice
              </Button>
            }
          />
        </div>
      </>
    );
  }

  const now = new Date();
  const year = now.getFullYear();
  const currency = profile?.defaultCurrency ?? 'USD';

  const outstandingAll = outstandingByCurrency(invoices, payments);
  const outstanding = pickCurrency(outstandingAll, currency);
  const outstandingOthers = otherCurrencies(outstandingAll, currency);

  const paidAll = paidThisYearByCurrency(invoices, payments, year);
  const paid = pickCurrency(paidAll, currency);
  const paidOthers = otherCurrencies(paidAll, currency);

  const overdue = overdueCount(invoices, payments, now);
  const oldestOverdue = invoices
    .filter((i) => effectiveStatus(i, payments, now) === 'overdue')
    .map((i) => daysOverdue(i, now))
    .reduce((a, b) => Math.max(a, b), 0);

  const breakdown = ytdBreakdown(invoices, payments, year, currency, now);
  const monthly = monthlyPaymentsForYear(invoices, payments, year, currency);
  const currentMonth = now.getMonth();

  const recent = [...invoices]
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate))
    .slice(0, 5);

  return (
    <>
      <PageHeader title={`Hi, ${firstName}.`} description="Here's where things stand.">
        <Button render={<Link href="/invoices/new" />}>New invoice</Button>
      </PageHeader>

      <div className="px-8 py-10 max-w-5xl">
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
              {year} so far · {currency}
            </h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatMoney(breakdown.total, currency)} invoiced
            </span>
          </div>
          <ProportionBar
            height={10}
            segments={STATUS_ORDER.map((status) => ({
              key: status,
              label: STATUS_LABELS[status],
              value: breakdown.totals[status],
            }))}
          />
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
            {STATUS_ORDER.filter((s) => breakdown.totals[s] > 0).map((status) => (
              <div key={status} className="flex items-center gap-1.5">
                <LegendDot status={status} />
                <span className="text-muted-foreground">{STATUS_LABELS[status]}</span>
                <span className="tabular-nums">{formatMoney(breakdown.totals[status], currency)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border">
          <div className="bg-card p-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Outstanding</div>
            <div className="mt-3 font-serif text-4xl leading-none tabular-nums">
              {formatMoney(outstanding, currency)}
            </div>
            {breakdown.total > 0 ? (
              <div className="mt-4">
                <ProgressBar
                  ratio={breakdown.totals.paid / Math.max(1, breakdown.totals.paid + outstanding)}
                  height={4}
                />
                <div className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">
                  <span className="text-foreground font-medium">
                    {Math.round((breakdown.totals.paid / Math.max(1, breakdown.totals.paid + outstanding)) * 100)}%
                  </span>{' '}
                  collected
                </div>
              </div>
            ) : (
              <div className="mt-2 text-xs text-muted-foreground">no invoices yet</div>
            )}
            {outstandingOthers.length > 0 ? (
              <div className="mt-3 text-[11px] text-muted-foreground tabular-nums">
                + {outstandingOthers.map((m) => formatMoney(m.amount, m.currency)).join(' · ')} in other currencies
              </div>
            ) : null}
          </div>

          <div className="bg-card p-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Paid in {year}</div>
            <div className="mt-3 font-serif text-4xl leading-none tabular-nums">
              {formatMoney(paid, currency)}
            </div>
            <div className="mt-4">
              <SparkBars
                values={monthly}
                highlightIndex={currentMonth}
                titles={monthly.map((v) => formatMoney(v, currency))}
                height={32}
              />
            </div>
            {paidOthers.length > 0 ? (
              <div className="mt-2 text-[11px] text-muted-foreground tabular-nums">
                + {paidOthers.map((m) => formatMoney(m.amount, m.currency)).join(' · ')} in other currencies
              </div>
            ) : null}
          </div>

          <Link
            href={overdue > 0 ? '/invoices?status=overdue' : '/invoices'}
            className="bg-card p-6 hover:bg-muted/30 transition-colors block"
          >
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Overdue</div>
            <div className="mt-3 flex items-baseline gap-2">
              <div className={'font-serif text-4xl leading-none tabular-nums ' + (overdue > 0 ? 'text-[oklch(0.5_0.18_27)]' : 'text-muted-foreground')}>
                {overdue}
              </div>
              <div className="text-xs text-muted-foreground">
                {overdue === 0 ? 'all caught up' : overdue === 1 ? 'invoice' : 'invoices'}
              </div>
            </div>
            {overdue > 0 ? (
              <div className="mt-4 flex items-center gap-2">
                <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-[oklch(0.62_0.18_27)]"
                    style={{ width: `${Math.min(100, oldestOverdue * 3)}%` }}
                  />
                </div>
                <div className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                  oldest {oldestOverdue}d
                </div>
              </div>
            ) : (
              <div className="mt-4 h-1 rounded-full bg-muted" />
            )}
          </Link>
        </section>

        <section className="mt-12">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-serif text-xl tracking-tight">Recent invoices</h2>
            <Link
              href="/invoices"
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              See all <ArrowUpRight className="size-3.5" />
            </Link>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {recent.map((inv, idx) => {
              const total = computeTotals(inv).total;
              const paidAmt = paidAmountFor(inv.id, payments);
              const status = effectiveStatus(inv, payments, now);
              const ratio = paymentRatio(inv, payments);
              const displayClient = inv.clientSnapshot?.name || '—';
              return (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className={
                    'flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40 transition-colors ' +
                    (idx > 0 ? 'border-t border-border' : '')
                  }
                >
                  <div className="font-mono text-xs text-muted-foreground w-20 shrink-0">
                    {inv.number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{displayClient}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(inv.issueDate)}
                      {status === 'overdue' ? (
                        <span className="ml-2 text-[oklch(0.5_0.18_27)]">
                          · {daysOverdue(inv, now)}d overdue
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="hidden sm:block w-20">
                    {status === 'partial' ? <ProgressBar ratio={ratio} /> : null}
                  </div>
                  <StatusBadge status={status} />
                  <div className="text-right tabular-nums w-32 shrink-0">
                    <div className="text-sm font-medium">{formatMoney(total, inv.currency)}</div>
                    {status === 'partial' ? (
                      <div className="text-xs text-muted-foreground">
                        {formatMoney(total - paidAmt, inv.currency)} due
                      </div>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
