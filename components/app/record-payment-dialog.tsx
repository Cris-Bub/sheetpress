'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { recordPayment } from '@/lib/mutations';
import { toMajor, toMinor, formatMoney } from '@/lib/format';
import type { Invoice } from '@/lib/types';

export function RecordPaymentDialog({
  invoice,
  balance,
  open,
  onOpenChange,
}: {
  invoice: Invoice;
  balance: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState(toMajor(balance, invoice.currency));
  const [method, setMethod] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const amountMinor = toMinor(amount || 0, invoice.currency);
  const tooMuch = amountMinor > balance;
  const tooLittle = amountMinor <= 0;

  const submit = async () => {
    if (busy || tooMuch || tooLittle) return;
    setBusy(true);
    try {
      await recordPayment({
        invoiceId: invoice.id,
        date,
        amount: amountMinor,
        method: method.trim() || undefined,
        note: note.trim() || undefined,
      });
      toast.success(`Payment of ${formatMoney(amountMinor, invoice.currency)} recorded.`);
      onOpenChange(false);
      setMethod('');
      setNote('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not record payment');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Balance due: <span className="tabular-nums">{formatMoney(balance, invoice.currency)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-normal text-muted-foreground">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-normal text-muted-foreground">
                Amount ({invoice.currency})
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="text-right tabular-nums"
              />
            </div>
          </div>
          {tooMuch ? (
            <p className="text-xs text-destructive">Amount exceeds the balance due.</p>
          ) : null}

          <div className="space-y-1.5">
            <Label className="text-xs font-normal text-muted-foreground">
              Method <span className="text-muted-foreground/70">(optional)</span>
            </Label>
            <Input
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              placeholder="Bank transfer, Stripe, Cash…"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-normal text-muted-foreground">
              Note <span className="text-muted-foreground/70">(optional)</span>
            </Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. First half"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || tooMuch || tooLittle}>
            {busy ? 'Recording…' : 'Record payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
