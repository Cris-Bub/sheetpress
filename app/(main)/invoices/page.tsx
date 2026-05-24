'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search, MoreHorizontal, Download, Copy, Eye, CheckCircle2, Ban } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { StatusBadge } from '@/components/app/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useInvoices, usePayments, isLoaded } from '@/lib/queries';
import { effectiveStatus, paidAmountFor, paymentRatio, daysOverdue } from '@/lib/derive';
import { ProgressBar } from '@/components/app/proportion-bar';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/app/empty-state';
import { computeTotals, formatDate, formatMoney } from '@/lib/format';
import { downloadInvoicePdf } from '@/lib/pdf';
import { duplicateInvoice } from '@/lib/mutations';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { InvoiceStatus, Invoice } from '@/lib/types';

const FILTERS: { value: 'all' | InvoiceStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'sent', label: 'Sent' },
  { value: 'partial', label: 'Partial' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
];

export default function InvoicesPage() {
  const [filter, setFilter] = useState<'all' | InvoiceStatus>('all');
  const [q, setQ] = useState('');
  const router = useRouter();

  const invoices = useInvoices();
  const payments = usePayments();
  const now = new Date();

  const handleDownload = async (inv: Invoice) => {
    try {
      await downloadInvoicePdf(inv);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not download PDF');
    }
  };

  const handleDuplicate = async (inv: Invoice) => {
    try {
      const dup = await duplicateInvoice(inv.id);
      router.push(`/invoices/${dup.id}/edit`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not duplicate');
    }
  };

  const filtered = useMemo(() => {
    if (!isLoaded(invoices) || !isLoaded(payments)) return [];
    return [...invoices]
      .map((inv) => ({ inv, status: effectiveStatus(inv, payments, now) }))
      .filter(({ inv, status }) => {
        if (filter !== 'all' && status !== filter) return false;
        if (q.trim()) {
          const needle = q.toLowerCase();
          const haystack = `${inv.number} ${inv.clientSnapshot?.name ?? ''} ${inv.lineItems
            .map((l) => l.description)
            .join(' ')}`.toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        return true;
      })
      .sort((a, b) => b.inv.issueDate.localeCompare(a.inv.issueDate));
  }, [filter, q, invoices, payments]);

  if (!isLoaded(invoices) || !isLoaded(payments)) {
    return (
      <>
        <PageHeader title="Invoices" />
        <div className="px-8 py-8 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </>
    );
  }

  if (invoices.length === 0) {
    return (
      <>
        <PageHeader title="Invoices" />
        <div className="px-8 py-8">
          <EmptyState
            title="No invoices yet"
            description="You'll see every invoice you create here — paid, sent, overdue, and drafts."
            action={
              <Button render={<Link href="/invoices/new" />}>Create your first invoice</Button>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Invoices" description={`${invoices.length} ${invoices.length === 1 ? 'invoice' : 'invoices'}`}>
        <Button render={<Link href="/invoices/new" />}>New invoice</Button>
      </PageHeader>

      <div className="px-8 py-8">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative max-w-sm flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by number, client, or item…"
              className="pl-9 h-9"
            />
          </div>
          <div className="flex items-center gap-1 rounded-md bg-muted p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded transition-colors',
                  filter === f.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-20 text-center">
            <p className="text-sm text-muted-foreground">No invoices match.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-5 py-2.5 w-24">Number</th>
                  <th className="text-left font-medium px-5 py-2.5">Client</th>
                  <th className="text-left font-medium px-5 py-2.5 w-32">Issued</th>
                  <th className="text-left font-medium px-5 py-2.5 w-32">Due</th>
                  <th className="text-left font-medium px-5 py-2.5 w-28">Status</th>
                  <th className="text-right font-medium px-5 py-2.5 w-36">Amount</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ inv, status }) => {
                  const total = computeTotals(inv).total;
                  const paid = paidAmountFor(inv.id, payments);
                  const ratio = paymentRatio(inv, payments);
                  const overdueDays = status === 'overdue' ? daysOverdue(inv, now) : 0;
                  return (
                    <tr
                      key={inv.id}
                      className="border-t border-border hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                        <Link href={`/invoices/${inv.id}`} className="block">
                          {inv.number}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <Link href={`/invoices/${inv.id}`} className="block">
                          <div className="font-medium">{inv.clientSnapshot?.name || '—'}</div>
                          {status === 'partial' ? (
                            <ProgressBar ratio={ratio} className="mt-1.5 max-w-[140px]" />
                          ) : null}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{formatDate(inv.issueDate)}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        <div>{formatDate(inv.dueDate)}</div>
                        {overdueDays > 0 ? (
                          <div className="text-[11px] text-[oklch(0.5_0.18_27)] tabular-nums">
                            {overdueDays}d overdue
                          </div>
                        ) : null}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={status} />
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        <div className="font-medium">{formatMoney(total, inv.currency)}</div>
                        {status === 'partial' ? (
                          <div className="text-xs text-muted-foreground">
                            {formatMoney(total - paid, inv.currency)} due
                          </div>
                        ) : null}
                      </td>
                      <td className="px-2 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-7" />}>
                            <MoreHorizontal className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem render={<Link href={`/invoices/${inv.id}`} />}>
                              <Eye className="size-4" /> View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload(inv)}>
                              <Download className="size-4" /> Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(inv)}>
                              <Copy className="size-4" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {status !== 'paid' ? (
                              <DropdownMenuItem>
                                <CheckCircle2 className="size-4" /> Mark paid
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem className="text-destructive">
                              <Ban className="size-4" /> Void
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
