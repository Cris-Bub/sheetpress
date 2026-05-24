'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Download, Upload, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/app/page-header';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useProfile, useSetting, isLoaded } from '@/lib/queries';
import { updateProfile, wipeAllData } from '@/lib/mutations';
import { exportEverything, importBackup } from '@/lib/backup';
import { formatDate } from '@/lib/format';
import type { Profile, Address } from '@/lib/types';

const REGIONS = [
  { value: 'us', label: 'United States', taxIdLabel: 'EIN' },
  { value: 'eu', label: 'European Union', taxIdLabel: 'VAT ID' },
  { value: 'uk', label: 'United Kingdom', taxIdLabel: 'VAT Number' },
  { value: 'ca', label: 'Canada', taxIdLabel: 'BN' },
  { value: 'au', label: 'Australia', taxIdLabel: 'ABN' },
  { value: 'other', label: 'Other', taxIdLabel: 'Tax ID' },
];

const ACCENT_COLORS = ['#1a1a1a', '#0b6e4f', '#7b3306', '#1e3a8a', '#7c2d12'];

export default function SettingsPage() {
  const profile = useProfile();
  const lastBackupAt = useSetting<string>('lastBackupAt');
  const { resolvedTheme, setTheme } = useTheme();
  const [draft, setDraft] = useState<Profile | null>(null);
  const lastSavedRef = useRef<string>('');
  const [working, setWorking] = useState<string | null>(null);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeText, setWipeText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mirror DB → local draft once.
  useEffect(() => {
    if (profile && draft === null) {
      setDraft(profile);
      lastSavedRef.current = JSON.stringify(profile);
    }
  }, [profile, draft]);

  // Debounced persistence on draft change.
  useEffect(() => {
    if (!draft || !profile) return;
    const serialized = JSON.stringify(draft);
    if (serialized === lastSavedRef.current) return;
    const handle = setTimeout(() => {
      void updateProfile(profile.id, {
        businessName: draft.businessName,
        legalName: draft.legalName,
        taxId: draft.taxId,
        taxIdLabel: draft.taxIdLabel,
        email: draft.email,
        phone: draft.phone,
        address: draft.address,
        defaultPaymentInstructions: draft.defaultPaymentInstructions,
        defaultPaymentTermsDays: draft.defaultPaymentTermsDays,
        defaultNotes: draft.defaultNotes,
        defaultCurrency: draft.defaultCurrency,
        accentColor: draft.accentColor,
        invoiceNumberFormat: draft.invoiceNumberFormat,
        nextInvoiceNumber: draft.nextInvoiceNumber,
      })
        .then(() => {
          lastSavedRef.current = serialized;
        })
        .catch((err) => toast.error(err instanceof Error ? err.message : 'Could not save'));
    }, 600);
    return () => clearTimeout(handle);
  }, [draft, profile]);

  if (!isLoaded(profile)) {
    return (
      <>
        <PageHeader title="Settings" />
        <div className="px-8 py-8 max-w-3xl space-y-3">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      </>
    );
  }

  if (!profile || !draft) {
    return (
      <>
        <PageHeader title="Settings" />
        <div className="px-8 py-8 max-w-3xl">
          <p className="text-sm text-muted-foreground">Finish onboarding to set up your business.</p>
        </div>
      </>
    );
  }

  const updateAddress = (patch: Partial<Address>) =>
    setDraft((d) => (d ? { ...d, address: { ...d.address, ...patch } } : d));

  return (
    <>
      <PageHeader title="Settings" description="Your business info, defaults, and data." />

      <div className="px-8 py-8 max-w-3xl">
        <Tabs defaultValue="profile">
          <TabsList className="mb-8">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="defaults">Defaults</TabsTrigger>
            <TabsTrigger value="region">Region</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-8">
            <Group title="Identity" description="How you appear on every invoice.">
              <Row label="Business name">
                <Input
                  value={draft.businessName}
                  onChange={(e) => setDraft({ ...draft, businessName: e.target.value })}
                />
              </Row>
              <Row label="Legal name" hint="If different from your business name.">
                <Input
                  value={draft.legalName ?? ''}
                  onChange={(e) => setDraft({ ...draft, legalName: e.target.value || undefined })}
                />
              </Row>
              <Row label="Tax ID">
                <Input
                  value={draft.taxId ?? ''}
                  onChange={(e) => setDraft({ ...draft, taxId: e.target.value || undefined })}
                />
              </Row>
            </Group>

            <Group title="Contact">
              <Row label="Email">
                <Input
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                />
              </Row>
              <Row label="Phone">
                <Input
                  value={draft.phone ?? ''}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value || undefined })}
                />
              </Row>
            </Group>

            <Group title="Address">
              <Row label="Street">
                <Input value={draft.address.line1} onChange={(e) => updateAddress({ line1: e.target.value })} />
              </Row>
              <Row label="Apt / Suite">
                <Input
                  value={draft.address.line2 ?? ''}
                  onChange={(e) => updateAddress({ line2: e.target.value || undefined })}
                />
              </Row>
              <Row label="City / Region / Postal">
                <div className="grid grid-cols-[2fr_1fr_1fr] gap-2">
                  <Input
                    value={draft.address.city}
                    onChange={(e) => updateAddress({ city: e.target.value })}
                    placeholder="City"
                  />
                  <Input
                    value={draft.address.region ?? ''}
                    onChange={(e) => updateAddress({ region: e.target.value || undefined })}
                    placeholder="Region"
                  />
                  <Input
                    value={draft.address.postalCode}
                    onChange={(e) => updateAddress({ postalCode: e.target.value })}
                    placeholder="Postal code"
                  />
                </div>
              </Row>
              <Row label="Country" hint="ISO code (e.g. US, GB, FR).">
                <Input
                  value={draft.address.country}
                  onChange={(e) => updateAddress({ country: e.target.value.toUpperCase().slice(0, 2) })}
                  className="w-20 uppercase tracking-wider font-mono"
                  maxLength={2}
                />
              </Row>
            </Group>
          </TabsContent>

          <TabsContent value="defaults" className="space-y-8">
            <Group title="Numbers & dates" description="Used as starting points for every new invoice.">
              <Row label="Invoice number format" hint="Use {YYYY}, {YY}, {MM}, {####} as tokens.">
                <Input
                  value={draft.invoiceNumberFormat}
                  onChange={(e) => setDraft({ ...draft, invoiceNumberFormat: e.target.value })}
                  className="font-mono"
                />
              </Row>
              <Row label="Next number">
                <Input
                  type="number"
                  value={draft.nextInvoiceNumber}
                  onChange={(e) => setDraft({ ...draft, nextInvoiceNumber: parseInt(e.target.value) || 1 })}
                  className="w-32 tabular-nums"
                />
              </Row>
              <Row label="Default payment terms" hint="Days until due.">
                <Input
                  type="number"
                  value={draft.defaultPaymentTermsDays}
                  onChange={(e) =>
                    setDraft({ ...draft, defaultPaymentTermsDays: parseInt(e.target.value) || 0 })
                  }
                  className="w-24 tabular-nums"
                />
              </Row>
              <Row label="Default currency">
                <Select
                  value={draft.defaultCurrency}
                  onValueChange={(v) => setDraft({ ...draft, defaultCurrency: v })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['USD', 'EUR', 'GBP', 'CAD', 'AUD'].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
            </Group>

            <Group title="Boilerplate" description="Pre-fills on new invoices. Edit per-invoice anytime.">
              <Row label="Default notes">
                <Textarea
                  value={draft.defaultNotes ?? ''}
                  onChange={(e) => setDraft({ ...draft, defaultNotes: e.target.value || undefined })}
                  rows={3}
                />
              </Row>
              <Row label="Payment instructions">
                <Textarea
                  value={draft.defaultPaymentInstructions ?? ''}
                  onChange={(e) =>
                    setDraft({ ...draft, defaultPaymentInstructions: e.target.value || undefined })
                  }
                  rows={5}
                  className="font-mono text-xs"
                />
              </Row>
            </Group>
          </TabsContent>

          <TabsContent value="region" className="space-y-8">
            <Group
              title="Region preset"
              description="Sets the tax ID label on your invoices. Doesn't change your stored data."
            >
              <Row label="Tax ID label" hint="What this number is called on your invoices.">
                <Select
                  value={draft.taxIdLabel ?? 'Tax ID'}
                  onValueChange={(v) => setDraft({ ...draft, taxIdLabel: v })}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIONS.map((r) => (
                      <SelectItem key={r.value} value={r.taxIdLabel}>
                        {r.taxIdLabel} ({r.label})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
            </Group>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-8">
            <Group title="Theme">
              <Row label="Dark mode" hint="Affects the app interface, not the invoice PDF.">
                <Switch
                  checked={resolvedTheme === 'dark'}
                  onCheckedChange={(v) => setTheme(v ? 'dark' : 'light')}
                />
              </Row>
              <Row label="Accent color" hint="Used on buttons and the invoice header line.">
                <div className="flex items-center gap-2">
                  {ACCENT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setDraft({ ...draft, accentColor: c })}
                      className={
                        'size-7 rounded-full border border-border ring-offset-2 hover:ring-2 ring-foreground ' +
                        (draft.accentColor === c ? 'ring-2' : '')
                      }
                      style={{ background: c }}
                      aria-label={c}
                    />
                  ))}
                </div>
              </Row>
            </Group>
          </TabsContent>

          <TabsContent value="data" className="space-y-8">
            <Group
              title="Backup"
              description="Your data lives in this browser. Export regularly to avoid losing it."
            >
              <BackupStatus lastBackupAt={lastBackupAt} />
              <div className="flex gap-2 pt-2">
                <Button
                  disabled={working === 'export'}
                  onClick={async () => {
                    setWorking('export');
                    try {
                      const r = await exportEverything();
                      toast.success(`Exported ${r.invoiceCount} invoices, ${r.pdfCount} PDFs.`);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Export failed');
                    } finally {
                      setWorking(null);
                    }
                  }}
                >
                  <Download className="size-4" />
                  {working === 'export' ? 'Exporting…' : 'Export everything (.zip)'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={working === 'import'}
                >
                  <Upload className="size-4" />
                  {working === 'import' ? 'Importing…' : 'Import backup'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    setWorking('import');
                    try {
                      const r = await importBackup(file);
                      toast.success(
                        `Imported ${r.invoices} invoices, ${r.payments} payments` +
                          (r.skipped > 0 ? ` (${r.skipped} duplicates skipped)` : ''),
                      );
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Import failed');
                    } finally {
                      setWorking(null);
                    }
                  }}
                />
              </div>
            </Group>

            <Group title="Danger zone">
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
                <div className="font-medium text-sm mb-1">Wipe all data</div>
                <p className="text-sm text-muted-foreground mb-3">
                  Permanently delete every invoice, client, payment, and setting on this device.
                  This cannot be undone.
                </p>
                {wipeOpen ? (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Type <span className="font-mono">wipe</span> to confirm
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={wipeText}
                        onChange={(e) => setWipeText(e.target.value)}
                        placeholder="wipe"
                        className="max-w-40 font-mono"
                        autoFocus
                      />
                      <Button
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        disabled={wipeText !== 'wipe' || working === 'wipe'}
                        onClick={async () => {
                          setWorking('wipe');
                          try {
                            await wipeAllData();
                            toast.success('Everything wiped.');
                            location.href = '/onboarding';
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : 'Wipe failed');
                            setWorking(null);
                          }
                        }}
                      >
                        {working === 'wipe' ? 'Wiping…' : 'Wipe forever'}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setWipeOpen(false);
                          setWipeText('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setWipeOpen(true)}
                  >
                    Wipe data…
                  </Button>
                )}
              </div>
            </Group>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function BackupStatus({ lastBackupAt }: { lastBackupAt: string | null | undefined }) {
  if (!lastBackupAt) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 px-3 py-2 text-sm">
        <AlertTriangle className="size-4 shrink-0" />
        <span>You haven't backed up yet.</span>
      </div>
    );
  }
  const date = new Date(lastBackupAt);
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  const stale = days > 30;
  return (
    <div
      className={
        'flex items-center gap-2 rounded-md border px-3 py-2 text-sm ' +
        (stale
          ? 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
          : 'border-border bg-muted/40 text-muted-foreground')
      }
    >
      {stale ? <AlertTriangle className="size-4 shrink-0" /> : null}
      <span>
        Last backup: {formatDate(lastBackupAt)} ({days === 0 ? 'today' : `${days}d ago`})
      </span>
    </div>
  );
}

function Group({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-medium">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground mt-0.5">{description}</p> : null}
      </div>
      <div className="space-y-4 pl-0">{children}</div>
    </section>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-2 sm:gap-6 items-start">
      <div className="sm:pt-2">
        <Label className="text-sm font-normal">{label}</Label>
        {hint ? <p className="text-xs text-muted-foreground mt-0.5">{hint}</p> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}
