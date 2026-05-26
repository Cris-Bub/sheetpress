'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Download, Plus, Trash2, Send, Share2, ChevronDown, Check, CreditCard, ExternalLink, Pencil } from 'lucide-react';
import { markInvoiceSent, updateInvoice } from '@/lib/mutations';
import { downloadInvoicePdf } from '@/lib/pdf';
import { sendInvoiceEmail } from '@/lib/email';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { InvoicePreview } from '@/components/app/invoice-preview';
import { ClientFormDialog } from '@/components/app/create-client-dialog';
import { useClients, useProfile, isLoaded } from '@/lib/queries';
import { computeTotals, formatMoney, toMajor, toMinor } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Client, Invoice, LineItem } from '@/lib/types';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'SEK', 'DKK', 'NOK', 'JPY'];

type EditorState = {
  number: string;
  clientId: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  lineItems: LineItem[];
  defaultTaxRate?: number;
  discount?: { type: 'percent' | 'amount'; value: number };
  notes: string;
  paymentInstructions: string;
  stripePaymentLink: string;
};

const stateFromInvoice = (inv: Invoice): EditorState => ({
  number: inv.number,
  clientId: inv.clientId,
  issueDate: inv.issueDate,
  dueDate: inv.dueDate,
  currency: inv.currency,
  lineItems: inv.lineItems,
  defaultTaxRate: inv.defaultTaxRate,
  discount: inv.discount,
  notes: inv.notes ?? '',
  paymentInstructions: inv.paymentInstructions ?? '',
  stripePaymentLink: inv.stripePaymentLink ?? '',
});

const stateToPatch = (s: EditorState): Partial<Invoice> => ({
  clientId: s.clientId,
  issueDate: s.issueDate,
  dueDate: s.dueDate,
  currency: s.currency,
  lineItems: s.lineItems,
  defaultTaxRate: s.defaultTaxRate,
  discount: s.discount,
  notes: s.notes,
  paymentInstructions: s.paymentInstructions,
  stripePaymentLink: s.stripePaymentLink.trim() || undefined,
});

export function InvoiceEditor({ existing }: { existing: Invoice }) {
  const router = useRouter();
  const profile = useProfile();
  const clients = useClients();
  const [state, setState] = useState<EditorState>(() => stateFromInvoice(existing));
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [marking, setMarking] = useState(false);
  const [mobilePane, setMobilePane] = useState<'edit' | 'preview'>('edit');
  const skipFirstSave = useRef(true);

  // Debounced autosave: 500ms after the last edit, persist local state to DB.
  // We skip the initial render (state === existing) so we don't write back a no-op.
  useEffect(() => {
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    const handle = setTimeout(() => {
      void updateInvoice(existing.id, stateToPatch(state))
        .then(() => setSavedAt(new Date()))
        .catch((err) => toast.error(err instanceof Error ? err.message : 'Autosave failed'));
    }, 500);
    return () => clearTimeout(handle);
  }, [state, existing.id]);

  // Keyboard shortcuts per SPEC §6.2. Must live above the early return
  // below so React's hooks order stays stable across renders.
  // Refs avoid re-binding the listener every state change.
  const handleMarkSentRef = useRef(() => Promise.resolve());
  const handleDownloadPdfRef = useRef(() => Promise.resolve());
  const handleShareRef = useRef(() => Promise.resolve());
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      // Cmd+Enter or Cmd+S → mark sent
      if (e.key === 'Enter' || e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleMarkSentRef.current();
        return;
      }
      // Cmd+D → download PDF
      if (e.key.toLowerCase() === 'd') {
        e.preventDefault();
        void handleDownloadPdfRef.current();
        return;
      }
      // Cmd+E → share invoice
      if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        void handleShareRef.current();
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!isLoaded(profile) || !profile || !isLoaded(clients)) {
    return (
      <div className="flex items-center justify-center h-screen text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const client: Client | undefined = clients.find((c) => c.id === state.clientId);

  const previewInvoice: Invoice = {
    id: existing.id,
    number: existing.number,
    profileId: profile.id,
    clientId: state.clientId || 'preview',
    profileSnapshot: profile,
    clientSnapshot:
      client ??
      ({
        id: 'placeholder',
        name: 'Client name',
        createdAt: new Date().toISOString(),
      } as Client),
    issueDate: state.issueDate,
    dueDate: state.dueDate,
    currency: state.currency,
    lineItems: state.lineItems,
    defaultTaxRate: state.defaultTaxRate,
    discount: state.discount,
    notes: state.notes,
    paymentInstructions: state.paymentInstructions,
    stripePaymentLink: state.stripePaymentLink.trim() || undefined,
    status: 'draft',
    createdAt: existing.createdAt,
    updatedAt: existing.updatedAt,
  };

  const totals = computeTotals(previewInvoice);

  const update = (patch: Partial<EditorState>) => setState((s) => ({ ...s, ...patch }));
  const updateLine = (id: string, patch: Partial<LineItem>) =>
    setState((s) => ({ ...s, lineItems: s.lineItems.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  const addLine = () =>
    setState((s) => ({
      ...s,
      lineItems: [
        ...s.lineItems,
        { id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0 },
      ],
    }));
  const removeLine = (id: string) =>
    setState((s) => ({ ...s, lineItems: s.lineItems.filter((l) => l.id !== id) }));

  const handleMarkSent = async () => {
    if (marking) return;
    setMarking(true);
    try {
      // Flush any pending edits first so the DB matches what the user sees.
      await updateInvoice(existing.id, stateToPatch(state));
      await markInvoiceSent(existing.id);
      toast.success(`Invoice ${existing.number} marked sent.`);
      router.replace(`/invoices/${existing.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not mark sent');
      setMarking(false);
    }
  };
  // Intentional render-time ref assignment: keeps the keydown listener
  // (bound once in a useEffect above) reading the latest handler closure
  // without re-binding on every state change.
  // eslint-disable-next-line react-hooks/refs
  handleMarkSentRef.current = handleMarkSent;

  const handleDownloadPdf = async () => {
    try {
      await updateInvoice(existing.id, stateToPatch(state));
      await downloadInvoicePdf(previewInvoice);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not download PDF');
    }
  };
  // eslint-disable-next-line react-hooks/refs
  handleDownloadPdfRef.current = handleDownloadPdf;

  const handleShare = async () => {
    try {
      // Flush pending edits so the rendered PDF matches what's on screen.
      await updateInvoice(existing.id, stateToPatch(state));
      const result = await sendInvoiceEmail(previewInvoice);
      if (existing.status === 'draft') {
        await markInvoiceSent(existing.id);
        toast.success(
          result.channel === 'web-share'
            ? `Sharing invoice ${existing.number} — marked as sent.`
            : `Mail client opening — invoice ${existing.number} marked as sent. PDF saved to Downloads.`,
        );
        router.replace(`/invoices/${existing.id}`);
      } else {
        toast.success(
          result.channel === 'web-share'
            ? 'Sharing invoice…'
            : 'Mail client opening. PDF saved to Downloads.',
        );
      }
    } catch (err) {
      // User dismissed the share sheet — silent.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      toast.error(err instanceof Error ? err.message : 'Could not share');
    }
  };
  // eslint-disable-next-line react-hooks/refs
  handleShareRef.current = handleShare;

  return (
    <div className="flex flex-col h-screen">
      {/* top bar */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center justify-between gap-4 h-14 px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              render={<Link href="/invoices" />}
              variant="ghost"
              size="icon"
              className="size-8 -ml-2"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <div className="font-mono text-xs text-muted-foreground">{existing.number}</div>
              <div className="text-sm font-medium leading-tight">Edit invoice</div>
            </div>
            <SavedIndicator savedAt={savedAt} />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadPdf} title="Download PDF (⌘D)">
              <Download className="size-3.5" />
              Download PDF
              <kbd className="ml-1 hidden md:inline text-[10px] text-muted-foreground font-mono">⌘D</kbd>
            </Button>
            <Button variant="outline" size="sm" onClick={handleMarkSent} disabled={marking} title="Mark sent (⌘S)">
              <Send className="size-3.5" />
              Mark sent
              <kbd className="ml-1 hidden md:inline text-[10px] text-muted-foreground font-mono">⌘S</kbd>
            </Button>
            <Button
              size="sm"
              onClick={handleShare}
              title={
                client?.email
                  ? `Share invoice with ${client.email} (⌘E)`
                  : 'Share invoice (⌘E) — pick the recipient in your share sheet or mail app'
              }
            >
              <Share2 className="size-3.5" />
              Share
              <kbd className="ml-1 hidden md:inline text-[10px] text-primary-foreground/70 font-mono">⌘E</kbd>
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile pane switcher — visible below lg, matches the split breakpoint */}
      <div className="lg:hidden border-b border-border bg-background">
        <div className="flex items-center gap-1 p-1 max-w-sm mx-auto">
          <button
            type="button"
            onClick={() => setMobilePane('edit')}
            className={cn(
              'flex-1 text-sm py-1.5 rounded transition-colors',
              mobilePane === 'edit'
                ? 'bg-muted text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setMobilePane('preview')}
            className={cn(
              'flex-1 text-sm py-1.5 rounded transition-colors',
              mobilePane === 'preview'
                ? 'bg-muted text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Preview
          </button>
        </div>
      </div>

      {/* split */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(420px,520px)_1fr] flex-1 min-h-0">
        {/* form */}
        <div
          className={cn(
            'overflow-y-auto border-r border-border',
            mobilePane === 'edit' ? 'block' : 'hidden',
            'lg:block',
          )}
        >
          <div className="px-6 py-6 space-y-8 max-w-[520px]">
            <Section title="From">
              <div className="rounded-md border border-border bg-card px-4 py-3">
                <div className="font-medium text-sm">{profile.businessName}</div>
                <div className="text-xs text-muted-foreground">{profile.email}</div>
                <Link href="/settings" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
                  Edit profile →
                </Link>
              </div>
            </Section>

            <Section title="Bill to">
              <ClientPicker
                clients={clients}
                defaultCurrency={state.currency}
                value={state.clientId}
                onChange={(id) => {
                  const c = clients.find((x) => x.id === id);
                  update({ clientId: id, currency: c?.defaultCurrency ?? state.currency });
                }}
              />
            </Section>

            <Section title="Details">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Invoice number">
                  <Input
                    value={state.number}
                    onChange={(e) => update({ number: e.target.value })}
                    className="font-mono text-sm"
                  />
                </Field>
                <Field label="Currency">
                  <Select value={state.currency} onValueChange={(v) => { if (v) update({ currency: v }); }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Issue date">
                  <Input
                    type="date"
                    value={state.issueDate}
                    onChange={(e) => update({ issueDate: e.target.value })}
                  />
                </Field>
                <Field label="Due date">
                  <Input
                    type="date"
                    value={state.dueDate}
                    onChange={(e) => update({ dueDate: e.target.value })}
                  />
                </Field>
              </div>
              <NetTermsRow
                issueDate={state.issueDate}
                dueDate={state.dueDate}
                onSet={(days) => {
                  const d = new Date(state.issueDate);
                  d.setDate(d.getDate() + days);
                  update({ dueDate: d.toISOString().slice(0, 10) });
                }}
              />
            </Section>

            <Section title="Items">
              <div className="space-y-2">
                {state.lineItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="rounded-md border border-border bg-card p-3 space-y-2 group"
                  >
                    <div className="flex items-start gap-2">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateLine(item.id, { description: e.target.value })}
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9 shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeLine(item.id)}
                        disabled={state.lineItems.length === 1}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="Qty" small>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => updateLine(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                          className="text-right tabular-nums"
                        />
                      </Field>
                      <Field label="Unit price" small>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={item.unitPrice === 0 ? '' : toMajor(item.unitPrice, state.currency)}
                          onChange={(e) =>
                            updateLine(item.id, {
                              unitPrice: toMinor(parseFloat(e.target.value) || 0, state.currency),
                            })
                          }
                          className="text-right tabular-nums"
                        />
                      </Field>
                      <Field label="Amount" small>
                        <div className="h-9 px-3 py-1.5 rounded-md bg-muted text-right tabular-nums text-sm flex items-center justify-end">
                          {formatMoney(
                            Math.round(item.quantity * item.unitPrice),
                            state.currency,
                          )}
                        </div>
                      </Field>
                    </div>
                    <span className="sr-only">Item {idx + 1}</span>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addLine}
                  className="w-full justify-center mt-1"
                >
                  <Plus className="size-4" />
                  Add line item
                </Button>
              </div>
            </Section>

            <Section title="Totals">
              <div className="rounded-md border border-border bg-card p-4 space-y-2 text-sm tabular-nums">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatMoney(totals.subtotal, state.currency)}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Default tax rate (%)</span>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={state.defaultTaxRate ?? ''}
                    placeholder="0"
                    onChange={(e) =>
                      update({
                        defaultTaxRate: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    className="w-20 h-8 text-right tabular-nums"
                  />
                </div>
                {totals.tax > 0 ? (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax</span>
                    <span>{formatMoney(totals.tax, state.currency)}</span>
                  </div>
                ) : null}
                <div className="border-t border-border pt-2 flex justify-between font-medium">
                  <span>Total</span>
                  <span>{formatMoney(totals.total, state.currency)}</span>
                </div>
              </div>
            </Section>

            <Section title="Notes">
              <Textarea
                value={state.notes}
                onChange={(e) => update({ notes: e.target.value })}
                placeholder="Add a thank-you, payment terms, or any extra context…"
                rows={3}
              />
            </Section>

            <Section
              title="Payment & banking"
              description="Where and how the client should pay you — bank details, PayPal, wire instructions."
            >
              <Textarea
                value={state.paymentInstructions}
                onChange={(e) => update({ paymentInstructions: e.target.value })}
                placeholder={
                  'Bank: Chase\nRouting: 021000021\nAccount: ****1234'
                }
                rows={5}
                className="font-mono text-xs"
              />
            </Section>

            <Section
              title="Pay online"
              description="Paste a Stripe Payment Link (or any pay URL). We'll add a clickable “Pay invoice” button to the PDF and the share email."
            >
              <PayLinkInput
                value={state.stripePaymentLink}
                onChange={(v) => update({ stripePaymentLink: v })}
              />
            </Section>

            <div className="h-12" />
          </div>
        </div>

        {/* preview */}
        <div
          className={cn(
            'bg-muted/40 overflow-y-auto overflow-x-auto',
            mobilePane === 'preview' ? 'block' : 'hidden',
            'lg:block',
          )}
        >
          <div className="min-h-full flex items-start justify-center p-4 sm:p-8 min-w-[640px]">
            <div className="w-full max-w-[820px]">
              <div className="text-xs text-muted-foreground mb-3 flex items-center justify-between">
                <span>Preview · A4</span>
                <span className="hidden sm:inline">What you see is what you’ll download</span>
              </div>
              <InvoicePreview invoice={previewInvoice} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SavedIndicator({ savedAt }: { savedAt: Date | null }) {
  if (!savedAt) {
    return <span className="text-xs text-muted-foreground ml-2">Editing…</span>;
  }
  return (
    <span className="text-xs text-muted-foreground ml-2 inline-flex items-center gap-1">
      <Check className="size-3" /> Saved
    </span>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{title}</h2>
      {description ? (
        <p className="text-xs text-muted-foreground/80 mb-2.5 normal-case tracking-normal">{description}</p>
      ) : (
        <div className="mb-2.5" />
      )}
      {children}
    </section>
  );
}

/**
 * One-click presets that snap the due date to issueDate + N days. Highlights the
 * preset that matches the current spread so the user can see "this is Net 30" at a glance.
 */
function NetTermsRow({
  issueDate,
  dueDate,
  onSet,
}: {
  issueDate: string;
  dueDate: string;
  onSet: (days: number) => void;
}) {
  const spreadDays = Math.round(
    (new Date(dueDate).getTime() - new Date(issueDate).getTime()) / (1000 * 60 * 60 * 24),
  );
  const presets = [0, 7, 14, 30, 60, 90];
  return (
    <div className="flex items-center gap-1.5 flex-wrap text-xs mt-2">
      <span className="text-muted-foreground">Set:</span>
      {presets.map((d) => {
        const active = spreadDays === d;
        const label = d === 0 ? 'Due on receipt' : `Net ${d}`;
        return (
          <button
            key={d}
            type="button"
            onClick={() => onSet(d)}
            className={cn(
              'px-2 py-0.5 rounded-full border transition-colors',
              active
                ? 'bg-foreground text-background border-foreground'
                : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground',
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Field({
  label,
  small,
  children,
}: {
  label: string;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className={cn('text-xs text-muted-foreground font-normal', small && 'text-[10px] uppercase tracking-wider')}>
        {label}
      </Label>
      {children}
    </div>
  );
}

function PayLinkInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const trimmed = value.trim();
  let parsed: URL | null = null;
  if (trimmed) {
    try {
      const u = new URL(trimmed);
      if (u.protocol === 'https:' || u.protocol === 'http:') parsed = u;
    } catch {
      parsed = null;
    }
  }
  const looksStripe = parsed?.hostname.endsWith('stripe.com');
  const invalid = trimmed.length > 0 && !parsed;

  return (
    <div className="space-y-2">
      <div className="relative">
        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          type="url"
          inputMode="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://buy.stripe.com/…"
          className={cn('pl-9 font-mono text-xs', invalid && 'border-destructive/60 focus-visible:ring-destructive/30')}
          aria-invalid={invalid || undefined}
        />
      </div>
      {invalid ? (
        <p className="text-[11px] text-destructive">That doesn’t look like a URL. Paste the full link, starting with https://.</p>
      ) : parsed ? (
        <a
          href={parsed.toString()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
            <Check className="size-3" />
            {looksStripe ? 'Stripe link' : 'Link'}
          </span>
          Test it
          <ExternalLink className="size-3" />
        </a>
      ) : (
        <p className="text-[11px] text-muted-foreground/70">
          Create one in your Stripe dashboard → Payment Links, then paste it here.
        </p>
      )}
    </div>
  );
}

function ClientPicker({
  clients,
  value,
  defaultCurrency,
  onChange,
}: {
  clients: Client[];
  value: string;
  defaultCurrency: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const selected = clients.find((c) => c.id === value);
  return (
    <>
      <div className="flex items-stretch gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <button className="flex-1 min-w-0 rounded-md border border-input bg-card px-4 py-3 text-left hover:bg-muted/30 transition-colors flex items-center justify-between gap-2" />
            }
          >
            {selected ? (
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{selected.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {selected.email || (
                    <span className="italic text-muted-foreground/70">No email on file</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Choose a client…</div>
            )}
            <ChevronDown className="size-4 text-muted-foreground shrink-0" />
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[440px]" align="start">
            <Command>
              <CommandInput placeholder="Search clients…" />
              <CommandList>
                <CommandEmpty>No clients found.</CommandEmpty>
                {clients.length > 0 ? (
                  <CommandGroup heading="Your clients">
                    {clients.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={c.name}
                        onSelect={() => {
                          onChange(c.id);
                          setOpen(false);
                        }}
                      >
                        <div>
                          <div className="font-medium">{c.name}</div>
                          {c.email ? <div className="text-xs text-muted-foreground">{c.email}</div> : null}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
                {/* Stable value so cmdk's filter doesn't hide this when the search
                    query doesn't match any existing client name. */}
                <CommandGroup>
                  <CommandItem
                    value="__add_new_client__"
                    onSelect={() => {
                      setOpen(false);
                      setCreating(true);
                    }}
                    className="text-muted-foreground"
                  >
                    <Plus className="size-4" />
                    Add a new client…
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {selected ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-auto self-stretch px-3"
            onClick={() => setEditing(true)}
            title={`Edit ${selected.name}`}
            aria-label={`Edit ${selected.name}`}
          >
            <Pencil className="size-4" />
          </Button>
        ) : null}
      </div>

      <ClientFormDialog
        open={creating}
        onOpenChange={setCreating}
        defaultCurrency={defaultCurrency}
        onSaved={(c) => onChange(c.id)}
      />
      <ClientFormDialog
        open={editing}
        onOpenChange={setEditing}
        defaultCurrency={defaultCurrency}
        existing={selected}
      />
    </>
  );
}
