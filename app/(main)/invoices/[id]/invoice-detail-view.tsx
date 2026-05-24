'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Download,
  Pencil,
  Copy,
  CheckCircle2,
  Ban,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/app/status-badge';
import { InvoicePreview } from '@/components/app/invoice-preview';
import { RecordPaymentDialog } from '@/components/app/record-payment-dialog';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { useInvoice, usePaymentsForInvoice, isLoaded } from '@/lib/queries';
import {
  duplicateInvoice,
  voidInvoice,
  deletePayment,
  deleteInvoiceDraft,
} from '@/lib/mutations';
import { downloadInvoicePdf } from '@/lib/pdf';
import { effectiveStatus, paidAmountFor } from '@/lib/derive';
import { computeTotals, formatDate, formatMoney } from '@/lib/format';

export function InvoiceDetailView({ id }: { id: string }) {
  const router = useRouter();
  const invoice = useInvoice(id);
  const payments = usePaymentsForInvoice(id);

  const [paying, setPaying] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [working, setWorking] = useState(false);

  if (!isLoaded(invoice) || !isLoaded(payments)) {
    return (
      <div className="px-8 py-8 max-w-[1400px] mx-auto space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-[600px] w-full max-w-[820px]" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="px-8 py-20 text-center">
        <p className="text-muted-foreground">This invoice no longer exists.</p>
        <Button render={<Link href="/invoices" />} variant="outline" size="sm" className="mt-4">
          Back to invoices
        </Button>
      </div>
    );
  }

  const now = new Date();
  const status = effectiveStatus(invoice, payments, now);
  const totals = computeTotals(invoice);
  const paid = paidAmountFor(invoice.id, payments);
  const balance = totals.total - paid;

  const handleDuplicate = async () => {
    if (working) return;
    setWorking(true);
    try {
      const dup = await duplicateInvoice(invoice.id);
      router.push(`/invoices/${dup.id}/edit`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not duplicate');
      setWorking(false);
    }
  };

  const handleVoid = async () => {
    setWorking(true);
    try {
      await voidInvoice(invoice.id);
      toast.success(`Invoice ${invoice.number} voided.`);
      setVoiding(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not void');
    } finally {
      setWorking(false);
    }
  };

  const handleDeleteDraft = async () => {
    setWorking(true);
    try {
      await deleteInvoiceDraft(invoice.id);
      toast.success(`Draft ${invoice.number} deleted.`);
      router.replace('/invoices');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete');
      setWorking(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between gap-4 px-8 h-14">
          <div className="flex items-center gap-3 min-w-0">
            <Button render={<Link href="/invoices" />} variant="ghost" size="icon" className="size-8 -ml-2">
              <ArrowLeft className="size-4" />
            </Button>
            <div className="font-mono text-xs text-muted-foreground">{invoice.number}</div>
            <div className="text-sm font-medium truncate">{invoice.clientSnapshot?.name || '—'}</div>
            <StatusBadge status={status} />
          </div>
          <div className="flex items-center gap-2">
            {status === 'draft' ? (
              <Button render={<Link href={`/invoices/${invoice.id}/edit`} />} variant="outline" size="sm">
                <Pencil className="size-3.5" />
                Edit
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={handleDuplicate} disabled={working}>
              <Copy className="size-3.5" />
              Duplicate
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                try {
                  await downloadInvoicePdf(invoice);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Could not download PDF');
                }
              }}
            >
              <Download className="size-3.5" />
              Download PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 px-8 py-8 max-w-[1400px] mx-auto w-full">
        <div className="flex justify-center">
          <InvoicePreview invoice={invoice} />
        </div>

        <aside className="space-y-6 text-sm">
          <section>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Summary</h3>
            <div className="rounded-lg border border-border bg-card p-4 space-y-2 tabular-nums">
              <div className="flex justify-between text-muted-foreground">
                <span>Total</span>
                <span>{formatMoney(totals.total, invoice.currency)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Paid</span>
                <span>{formatMoney(paid, invoice.currency)}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between font-medium">
                <span>Balance due</span>
                <span className={balance > 0 ? '' : 'text-muted-foreground'}>
                  {formatMoney(balance, invoice.currency)}
                </span>
              </div>
            </div>
          </section>

          {status !== 'draft' ? (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Payments</h3>
                {balance > 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 -mr-2 text-xs"
                    onClick={() => setPaying(true)}
                  >
                    <Plus className="size-3" />
                    Record
                  </Button>
                ) : null}
              </div>
              {payments.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No payments recorded.</p>
              ) : (
                <div className="rounded-lg border border-border bg-card divide-y divide-border">
                  {payments.map((p) => (
                    <div key={p.id} className="px-4 py-3 group">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium tabular-nums">
                          {formatMoney(p.amount, invoice.currency)}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-muted-foreground">{formatDate(p.date)}</div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                            onClick={() => deletePayment(p.id)}
                            aria-label="Delete payment"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                      {p.method ? (
                        <div className="text-xs text-muted-foreground mt-0.5">{p.method}</div>
                      ) : null}
                      {p.note ? (
                        <div className="text-xs text-muted-foreground italic mt-0.5">{p.note}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          <section>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Actions</h3>
            <div className="flex flex-col gap-1.5">
              {balance > 0 && status !== 'draft' && status !== 'void' ? (
                <Button variant="outline" size="sm" className="justify-start" onClick={() => setPaying(true)}>
                  <CheckCircle2 className="size-4" />
                  Mark fully paid
                </Button>
              ) : null}
              {status !== 'void' && status !== 'draft' ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start text-destructive hover:text-destructive"
                  onClick={() => setVoiding(true)}
                  disabled={working}
                >
                  <Ban className="size-4" />
                  Void invoice
                </Button>
              ) : null}
              {status === 'draft' ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start text-destructive hover:text-destructive"
                  onClick={() => setDeleting(true)}
                  disabled={working}
                >
                  <Trash2 className="size-4" />
                  Delete draft
                </Button>
              ) : null}
            </div>
          </section>
        </aside>
      </div>

      <RecordPaymentDialog
        invoice={invoice}
        balance={balance}
        open={paying}
        onOpenChange={setPaying}
      />

      <ConfirmDialog
        open={voiding}
        onOpenChange={setVoiding}
        title={`Void invoice ${invoice.number}?`}
        description="It stays on your books with status 'void' — this can't be undone."
        confirmLabel="Void invoice"
        destructive
        busy={working}
        onConfirm={handleVoid}
      />

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete draft ${invoice.number}?`}
        description="The invoice number will not be reused. Are you sure?"
        confirmLabel="Delete draft"
        destructive
        busy={working}
        onConfirm={handleDeleteDraft}
      />
    </div>
  );
}
