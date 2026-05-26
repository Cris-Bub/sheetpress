'use client';

import { useEffect, useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createClient, updateClient } from '@/lib/mutations';
import { db } from '@/lib/db';
import type { Client } from '@/lib/types';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'SEK', 'DKK', 'NOK', 'JPY'];

type AddressDraft = {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

const EMPTY_ADDRESS: AddressDraft = {
  line1: '', line2: '', city: '', region: '', postalCode: '', country: '',
};

function addressHasContent(a: AddressDraft): boolean {
  return Boolean(a.line1.trim() || a.city.trim() || a.postalCode.trim() || a.country.trim());
}

function addressFromClient(c: Client): AddressDraft {
  const a = c.address;
  if (!a) return EMPTY_ADDRESS;
  return {
    line1: a.line1 ?? '',
    line2: a.line2 ?? '',
    city: a.city ?? '',
    region: a.region ?? '',
    postalCode: a.postalCode ?? '',
    country: a.country ?? '',
  };
}

/**
 * Create-or-edit client dialog. Pass `existing` to edit an existing record;
 * omit it to create a new one. Used both from the invoice editor's picker
 * (inline add/edit) and from the Clients detail page.
 */
export function ClientFormDialog({
  open,
  onOpenChange,
  defaultCurrency,
  existing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCurrency: string;
  existing?: Client;
  onSaved?: (client: Client) => void;
}) {
  const editing = Boolean(existing);
  const [name, setName] = useState(existing?.name ?? '');
  const [contactName, setContactName] = useState(existing?.contactName ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [taxId, setTaxId] = useState(existing?.taxId ?? '');
  const [currency, setCurrency] = useState(existing?.defaultCurrency ?? defaultCurrency);
  const [address, setAddress] = useState<AddressDraft>(
    existing ? addressFromClient(existing) : EMPTY_ADDRESS,
  );
  const [busy, setBusy] = useState(false);

  // When `existing` changes (e.g. opening the dialog for a different client),
  // reset the form to mirror it. Without this, switching targets would show
  // stale values from the previous open.
  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setContactName(existing.contactName ?? '');
      setEmail(existing.email ?? '');
      setTaxId(existing.taxId ?? '');
      setCurrency(existing.defaultCurrency ?? defaultCurrency);
      setAddress(addressFromClient(existing));
    }
  }, [existing, defaultCurrency]);

  const resetToCreate = () => {
    setName('');
    setContactName('');
    setEmail('');
    setTaxId('');
    setCurrency(defaultCurrency);
    setAddress(EMPTY_ADDRESS);
  };

  const updateAddress = (patch: Partial<AddressDraft>) =>
    setAddress((a) => ({ ...a, ...patch }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) {
      toast.error('Client name is required.');
      return;
    }
    setBusy(true);
    try {
      const addressPatch = addressHasContent(address)
        ? {
            line1: address.line1.trim(),
            line2: address.line2.trim() || undefined,
            city: address.city.trim(),
            region: address.region.trim() || undefined,
            postalCode: address.postalCode.trim(),
            country: address.country.trim().toUpperCase() || 'US',
          }
        : undefined;

      if (editing && existing) {
        await updateClient(existing.id, {
          name: name.trim(),
          contactName: contactName.trim() || undefined,
          email: email.trim() || undefined,
          taxId: taxId.trim() || undefined,
          defaultCurrency: currency,
          address: addressPatch,
        });
        const fresh = await db.clients.get(existing.id);
        toast.success(`Updated ${name.trim()}.`);
        if (fresh) onSaved?.(fresh);
        onOpenChange(false);
      } else {
        const client = await createClient({
          name: name.trim(),
          contactName: contactName.trim() || undefined,
          email: email.trim() || undefined,
          taxId: taxId.trim() || undefined,
          defaultCurrency: currency,
          address: addressPatch,
        });
        toast.success(`Added ${client.name}.`);
        onSaved?.(client);
        onOpenChange(false);
        resetToCreate();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save client');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !editing) resetToCreate();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit client' : 'Add a client'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Changes apply to drafts and future invoices. Already-sent invoices keep the frozen snapshot of how the client looked at send time.'
              : 'Only the name is required — you can fill in the rest later from the Clients page.'}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="client-name" className="text-xs font-normal text-muted-foreground">
              Business name
            </Label>
            <Input
              id="client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mercer & Co."
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-normal text-muted-foreground">
                Contact name <span className="text-muted-foreground/70">(optional)</span>
              </Label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Anna Mercer"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-normal text-muted-foreground">Default currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v ?? 'USD')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-normal text-muted-foreground">
              Email <span className="text-muted-foreground/70">(optional)</span>
            </Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="anna@mercerand.co"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-normal text-muted-foreground">
              Tax ID <span className="text-muted-foreground/70">(optional)</span>
            </Label>
            <Input
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="VAT, EIN, etc."
            />
          </div>

          <div className="pt-2 border-t border-border">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mt-3 mb-2">
              Address <span className="normal-case tracking-normal text-muted-foreground/70">(optional)</span>
            </div>
            <div className="space-y-2">
              <Input
                value={address.line1}
                onChange={(e) => updateAddress({ line1: e.target.value })}
                placeholder="Street"
              />
              <Input
                value={address.line2}
                onChange={(e) => updateAddress({ line2: e.target.value })}
                placeholder="Apt / Suite (optional)"
              />
              <div className="grid grid-cols-[2fr_1fr_1fr] gap-2">
                <Input
                  value={address.city}
                  onChange={(e) => updateAddress({ city: e.target.value })}
                  placeholder="City"
                />
                <Input
                  value={address.region}
                  onChange={(e) => updateAddress({ region: e.target.value })}
                  placeholder="Region"
                />
                <Input
                  value={address.postalCode}
                  onChange={(e) => updateAddress({ postalCode: e.target.value })}
                  placeholder="Postal"
                />
              </div>
              <Input
                value={address.country}
                onChange={(e) => updateAddress({ country: e.target.value.toUpperCase().slice(0, 2) })}
                placeholder="Country (ISO, e.g. US)"
                className="w-32 uppercase tracking-wider font-mono"
                maxLength={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Add client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
