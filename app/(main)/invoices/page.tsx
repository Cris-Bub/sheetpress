'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search, MoreHorizontal, Download, Copy, Eye, CheckCircle2, Ban, ChevronUp, ChevronDown } from 'lucide-react';
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
import { duplicateInvoice, voidInvoice } from '@/lib/mutations';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { RecordPaymentDialog } from '@/components/app/record-payment-dialog';
import type { InvoiceStatus, Invoice } from '@/lib/types';

const FILTERS: { value: 'all' | InvoiceStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'sent', label: 'Sent' },
  { value: 'partial', label: 'Partial' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
];

type SortKey = 'issued' | 'due' | 'status' | 'amount';
type SortDir = 'asc' | 'desc';

// Urgency ranking — higher = more actionable. Used so "desc" sort surfaces
// overdue first by default, which matches what users typically want.
const STATUS_URGENCY: Record<InvoiceStatus, number> = {
  overdue: 5,
  partial: 4,
  sent: 3,
  draft: 2,
  paid: 1,
  void: 0,
};

export default function InvoicesPage() {
  const [filter, setFilter] = useState<'all' | InvoiceStatus>('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ by: SortKey; dir: SortDir }>({ by: 'issued', dir: 'desc' });
  const [voidingInv, setVoidingInv] = useState<Invoice | null>(null);
  const [voidWorking, setVoidWorking] = useState(false);
  const [payingInv, setPayingInv] = useState<Invoice | null>(null);
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

  const handleVoid = async () => {
    if (!voidingInv) return;
    setVoidWorking(true);
    try {
      await voidInvoice(voidingInv.id);
      toast.success(`Invoice ${voidingInv.number} voided.`);
      setVoidingInv(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not void');
    } finally {
      setVoidWorking(false);
    }
  };

  const filtered = useMemo(() => {
    if (!isLoaded(invoices) || !isLoaded(payments)) return [];
    return [...invoices]
      .map((inv) => ({
        inv,
        status: effectiveStatus(inv, payments, now),
        total: computeTotals(inv).total,
      }))
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
      .sort((a, b) => {
        let v = 0;
        switch (sort.by) {
          case 'issued':
            v = a.inv.issueDate.localeCompare(b.inv.issueDate);
            break;
          case 'due':
            v = a.inv.dueDate.localeCompare(b.inv.dueDate);
            break;
          case 'status':
            v = STATUS_URGENCY[a.status] - STATUS_URGENCY[b.status];
            break;
          case 'amount':
            v = a.total - b.total;
            break;
        }
        // Stable tiebreaker: newest issued first, then by number — keeps order
        // deterministic when two rows tie on the chosen column.
        if (v === 0) v = a.inv.issueDate.localeCompare(b.inv.issueDate);
        if (v === 0) v = a.inv.number.localeCompare(b.inv.number);
        return sort.dir === 'desc' ? -v : v;
      });
  }, [filter, q, sort, invoices, payments]);

  const toggleSort = (by: SortKey) => {
    setSort((prev) =>
      prev.by === by ? { by, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { by, dir: 'desc' },
    );
  };

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
                  <SortableTh label="Issued" sortKey="issued" sort={sort} onToggle={toggleSort} className="w-32" />
                  <SortableTh label="Due" sortKey="due" sort={sort} onToggle={toggleSort} className="w-32" />
                  <SortableTh label="Status" sortKey="status" sort={sort} onToggle={toggleSort} className="w-28" />
                  <SortableTh label="Amount" sortKey="amount" sort={sort} onToggle={toggleSort} align="right" className="w-36" />
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ inv, status, total }) => {
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
                            {status !== 'paid' && status !== 'void' && status !== 'draft' ? (
                              <DropdownMenuItem onClick={() => setPayingInv(inv)}>
                                <CheckCircle2 className="size-4" /> Mark paid
                              </DropdownMenuItem>
                            ) : null}
                            {status !== 'void' && status !== 'draft' ? (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setVoidingInv(inv)}
                              >
                                <Ban className="size-4" /> Void
                              </DropdownMenuItem>
                            ) : null}
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
      <ConfirmDialog
        open={voidingInv !== null}
        onOpenChange={(open) => { if (!open) setVoidingInv(null); }}
        title={voidingInv ? `Void invoice ${voidingInv.number}?` : ''}
        description={
          voidingInv
            ? `It stays on your books with status 'void' — this can't be undone. ` +
              `The number ${voidingInv.number} stays consumed; future invoices will skip it. ` +
              `That's legal but unusual.`
            : ''
        }
        confirmLabel="Void invoice"
        destructive
        busy={voidWorking}
        onConfirm={handleVoid}
      />
      {payingInv ? (
        <RecordPaymentDialog
          invoice={payingInv}
          balance={computeTotals(payingInv).total - paidAmountFor(payingInv.id, payments)}
          open={payingInv !== null}
          onOpenChange={(open) => { if (!open) setPayingInv(null); }}
        />
      ) : null}
    </>
  );
}

function SortableTh({
  label,
  sortKey,
  sort,
  onToggle,
  align = 'left',
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: { by: SortKey; dir: SortDir };
  onToggle: (by: SortKey) => void;
  align?: 'left' | 'right';
  className?: string;
}) {
  const active = sort.by === sortKey;
  const Icon = active && sort.dir === 'asc' ? ChevronUp : ChevronDown;
  return (
    <th className={cn('font-medium px-5 py-2.5', align === 'right' ? 'text-right' : 'text-left', className)}>
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={cn(
          'inline-flex items-center gap-1 uppercase tracking-wider text-xs transition-colors hover:text-foreground',
          align === 'right' && 'flex-row-reverse',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
        <Icon className={cn('size-3 transition-opacity', active ? 'opacity-100' : 'opacity-30')} />
      </button>
    </th>
  );
}
