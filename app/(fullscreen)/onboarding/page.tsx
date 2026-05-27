'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
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
import { createProfile } from '@/lib/mutations';
import { useProfile, isLoaded } from '@/lib/queries';

type Region = 'us' | 'eu' | 'uk' | 'ca' | 'au' | 'other';
const REGION_TAX_LABEL: Record<Region, string> = {
  us: 'EIN',
  eu: 'VAT ID',
  uk: 'VAT Number',
  ca: 'BN',
  au: 'ABN',
  other: 'Tax ID',
};

export default function Onboarding() {
  const router = useRouter();
  const existing = useProfile();
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [region, setRegion] = useState<Region>('us');
  const [currency, setCurrency] = useState('USD');
  const [busy, setBusy] = useState(false);

  // If a profile already exists (re-entered the route), kick back to home.
  useEffect(() => {
    if (isLoaded(existing) && existing) router.replace('/');
  }, [existing, router]);

  const canSubmit = businessName.trim().length > 0 && /\S+@\S+\.\S+/.test(email.trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      await createProfile({
        businessName: businessName.trim(),
        email: email.trim(),
        taxIdLabel: REGION_TAX_LABEL[region],
        address: { line1: '', city: '', postalCode: '', country: region.toUpperCase() },
        defaultPaymentTermsDays: 14,
        defaultCurrency: currency,
        accentColor: '#1a1a1a',
        invoiceNumberFormat: '{YYYY}-{####}',
        nextInvoiceNumber: 1,
      });
      toast.success('You\'re all set.');
      router.replace('/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-8 py-6">
        <div className="inline-flex items-baseline gap-1">
          <span className="font-serif text-2xl leading-none tracking-tight">sheet</span>
          <span className="font-serif text-2xl leading-none tracking-tight italic text-muted-foreground">press</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-8 pb-16">
        <div className="w-full max-w-lg">
          <h1 className="font-serif text-4xl tracking-tight text-balance">Let&apos;s set you up.</h1>
          <p className="text-muted-foreground mt-3 text-balance">
            A few details that go on every invoice. You can change them anytime — and skip what you don&apos;t have yet.
          </p>

          <form className="mt-10 space-y-5" onSubmit={submit}>
            <div className="space-y-1.5">
              <Label htmlFor="business" className="text-sm font-normal text-muted-foreground">
                Business name
              </Label>
              <Input
                id="business"
                placeholder="e.g. Cris Vega Studio"
                autoFocus
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-normal text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="hello@yourstudio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-normal text-muted-foreground">Region</Label>
                <Select value={region} onValueChange={(v) => { if (v) setRegion(v as Region); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="us">United States</SelectItem>
                    <SelectItem value="eu">European Union</SelectItem>
                    <SelectItem value="uk">United Kingdom</SelectItem>
                    <SelectItem value="ca">Canada</SelectItem>
                    <SelectItem value="au">Australia</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-normal text-muted-foreground">Default currency</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v ?? 'USD')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['USD', 'EUR', 'GBP', 'CAD', 'AUD'].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">A heads up.</span> Your data lives in your sheetPress account — synced and backed up. You can still download an export anytime.
            </div>

            <div className="flex items-center justify-between pt-2">
              <Link
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (!busy) submit(e as unknown as React.FormEvent);
                }}
                className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
              >
                Save and continue
              </Link>
              <Button type="submit" size="lg" disabled={!canSubmit || busy}>
                {busy ? 'Saving…' : 'Get started'}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
