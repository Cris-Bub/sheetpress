'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Download, Upload, AlertTriangle, FileSpreadsheet, Plus, Trash2 } from 'lucide-react';
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
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import {
  useProfile,
  useProfiles,
  useActiveProfileId,
  useSetting,
  isLoaded,
  useInvoices,
  usePayments,
} from '@/lib/queries';
import {
  createProfile,
  deleteProfile,
  setActiveProfile,
  updateProfile,
  wipeAllData,
} from '@/lib/mutations';
import { exportEverything, exportTaxYear, importBackup } from '@/lib/backup';
import { availableYears } from '@/lib/derive';
import { formatDate } from '@/lib/format';
import type { Profile, Address } from '@/lib/types';

type RegionPreset = {
  value: string;
  label: string;
  taxIdLabel: string;
  /** A reasonable default — the user can change it per invoice. */
  defaultTaxRate: number;
  defaultCurrency: string;
};

const REGIONS: RegionPreset[] = [
  { value: 'us', label: 'United States', taxIdLabel: 'EIN', defaultTaxRate: 0, defaultCurrency: 'USD' },
  { value: 'eu', label: 'European Union', taxIdLabel: 'VAT ID', defaultTaxRate: 21, defaultCurrency: 'EUR' },
  { value: 'uk', label: 'United Kingdom', taxIdLabel: 'VAT Number', defaultTaxRate: 20, defaultCurrency: 'GBP' },
  { value: 'ca', label: 'Canada', taxIdLabel: 'BN', defaultTaxRate: 5, defaultCurrency: 'CAD' },
  { value: 'au', label: 'Australia', taxIdLabel: 'ABN', defaultTaxRate: 10, defaultCurrency: 'AUD' },
  { value: 'other', label: 'Other', taxIdLabel: 'Tax ID', defaultTaxRate: 0, defaultCurrency: 'USD' },
];

const ACCENT_COLORS = ['#1a1a1a', '#0b6e4f', '#7b3306', '#1e3a8a', '#7c2d12'];

export default function SettingsPage() {
  const profile = useProfile();
  const profiles = useProfiles();
  const activeProfileId = useActiveProfileId();
  const lastBackupAt = useSetting<string>('lastBackupAt');
  const invoices = useInvoices();
  const payments = usePayments();
  const { resolvedTheme, setTheme } = useTheme();
  const [draft, setDraft] = useState<Profile | null>(null);
  const lastSavedRef = useRef<string>('');
  const [working, setWorking] = useState<string | null>(null);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeText, setWipeText] = useState('');
  const [taxYear, setTaxYear] = useState<number>(new Date().getFullYear() - 1);
  const [deleteProfileOpen, setDeleteProfileOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mirror DB → local draft, including when the active profile changes.
  // Controlled form mirroring external data is a recognized exception to the
  // "no setState in effect" rule — see the React docs on syncing state to props.
  useEffect(() => {
    if (profile && (draft === null || draft.id !== profile.id)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(profile);
      lastSavedRef.current = JSON.stringify(profile);
    }
  }, [profile, draft]);

  // Debounced persistence on draft change.
  useEffect(() => {
    if (!draft || !profile) return;
    // If the user just switched profiles, skip — the draft will be re-mirrored.
    if (draft.id !== profile.id) return;
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
        defaultTaxRate: draft.defaultTaxRate,
        accentColor: draft.accentColor,
        invoiceNumberFormat: draft.invoiceNumberFormat,
        nextInvoiceNumber: draft.nextInvoiceNumber,
        logoDataUrl: draft.logoDataUrl,
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
            {isLoaded(profiles) && profiles.length > 0 ? (
              <Group title="Profile" description="Switch between businesses or add another (e.g. a DBA).">
                <Row label="Active profile">
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={activeProfileId ?? profile?.id ?? ''}
                      onValueChange={async (v) => {
                        if (!v) return;
                        try {
                          await setActiveProfile(v);
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Could not switch');
                        }
                      }}
                    >
                      <SelectTrigger className="w-64" aria-label="Active profile">
                        <SelectValue>
                          {(value) => {
                            const v = String(value ?? '');
                            const found = profiles.find((p) => p.id === v);
                            return found?.businessName || 'Untitled';
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {profiles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.businessName || 'Untitled'}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const fresh = await createProfile({
                            businessName: 'New profile',
                            email: '',
                            address: { line1: '', city: '', postalCode: '', country: 'US' },
                            defaultPaymentTermsDays: profile?.defaultPaymentTermsDays ?? 14,
                            defaultCurrency: profile?.defaultCurrency ?? 'USD',
                            accentColor: profile?.accentColor ?? '#1a1a1a',
                            invoiceNumberFormat: profile?.invoiceNumberFormat ?? '{YYYY}-{####}',
                            nextInvoiceNumber: 1,
                          });
                          await setActiveProfile(fresh.id);
                          toast.success('Added a new profile.');
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Could not add');
                        }
                      }}
                    >
                      <Plus className="size-4" />
                      Add profile
                    </Button>
                    {profiles.length > 1 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteProfileOpen(true)}
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </Row>
              </Group>
            ) : null}

            <Group title="Identity" description="How you appear on every invoice.">
              <Row label="Logo" hint="Shown on the invoice header. PNG, JPG, or SVG up to ~500 KB.">
                <LogoField
                  logoDataUrl={draft.logoDataUrl}
                  onChange={(v) => setDraft({ ...draft, logoDataUrl: v })}
                />
              </Row>
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
                  onValueChange={(v) => {
                    if (v) setDraft({ ...draft, defaultCurrency: v });
                  }}
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
              <Row label="Default tax rate" hint="Percent. Applied to new invoices; you can override per-line or per-invoice.">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={draft.defaultTaxRate ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        defaultTaxRate: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    placeholder="0"
                    className="w-24 tabular-nums"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
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
              description="Pick a region to apply sensible defaults: tax ID label, tax rate, and currency. You can change any of them afterward."
            >
              <RegionPicker draft={draft} setDraft={setDraft} />
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
              <Row label="Accent color" hint="A small bar under the “Invoice” headline on every PDF and preview.">
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
              title="Tax year export"
              description="A spreadsheet-friendly ZIP scoped to one year — invoices.csv, payments.csv, and PDFs. Hand it to your accountant."
            >
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={String(taxYear)}
                  onValueChange={(v) => {
                    if (v) setTaxYear(parseInt(v, 10));
                  }}
                >
                  <SelectTrigger size="sm" className="w-32" aria-label="Tax year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoaded(invoices) && isLoaded(payments)
                      ? availableYears(invoices, payments).map((y) => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))
                      : null}
                  </SelectContent>
                </Select>
                <Button
                  disabled={working === 'tax-export'}
                  onClick={async () => {
                    setWorking('tax-export');
                    try {
                      const r = await exportTaxYear(taxYear);
                      toast.success(
                        `Exported ${r.invoiceCount} invoices, ${r.paymentCount} payments, ${r.pdfCount} PDFs for ${taxYear}.`,
                      );
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Tax export failed');
                    } finally {
                      setWorking(null);
                    }
                  }}
                >
                  <FileSpreadsheet className="size-4" />
                  {working === 'tax-export' ? 'Exporting…' : `Export ${taxYear} (.zip)`}
                </Button>
              </div>
            </Group>

            <Group
              title="Backup"
              description="Your data lives in this browser. Export regularly to avoid losing it. The full backup now includes CSV files alongside the JSON."
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
      <ConfirmDialog
        open={deleteProfileOpen}
        onOpenChange={setDeleteProfileOpen}
        title={profile ? `Delete profile "${profile.businessName}"?` : ''}
        description="Profiles with existing invoices can't be deleted — the invoices reference them. This only removes a profile that's never been used."
        confirmLabel="Delete profile"
        destructive
        onConfirm={async () => {
          if (!profile) return;
          try {
            await deleteProfile(profile.id);
            toast.success('Profile deleted.');
            setDeleteProfileOpen(false);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not delete');
          }
        }}
      />
    </>
  );
}

function BackupStatus({ lastBackupAt }: { lastBackupAt: string | null | undefined }) {
  if (!lastBackupAt) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 px-3 py-2 text-sm">
        <AlertTriangle className="size-4 shrink-0" />
        <span>You haven&apos;t backed up yet.</span>
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

function RegionPicker({
  draft,
  setDraft,
}: {
  draft: Profile;
  setDraft: (p: Profile) => void;
}) {
  const [picked, setPicked] = useState<string>('');
  const [applyLabel, setApplyLabel] = useState(true);
  const [applyRate, setApplyRate] = useState(true);
  const [applyCurrency, setApplyCurrency] = useState(true);

  const region = REGIONS.find((r) => r.value === picked);

  const apply = () => {
    if (!region) return;
    const patch: Partial<Profile> = {};
    if (applyLabel) patch.taxIdLabel = region.taxIdLabel;
    if (applyRate) patch.defaultTaxRate = region.defaultTaxRate;
    if (applyCurrency) patch.defaultCurrency = region.defaultCurrency;
    setDraft({ ...draft, ...patch });
    toast.success(`Applied ${region.label} preset.`);
    setPicked('');
  };

  return (
    <div className="space-y-4">
      <Row label="Region">
        <Select value={picked} onValueChange={(v) => setPicked(v ?? '')}>
          <SelectTrigger className="w-64" aria-label="Region">
            <SelectValue placeholder="Choose a region…" />
          </SelectTrigger>
          <SelectContent>
            {REGIONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>
      {region ? (
        <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3 ml-0 sm:ml-[224px]">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Apply to your profile
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={applyLabel}
              onChange={(e) => setApplyLabel(e.target.checked)}
              className="size-4"
            />
            <span>Tax ID label</span>
            <span className="text-muted-foreground">→ {region.taxIdLabel}</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={applyRate}
              onChange={(e) => setApplyRate(e.target.checked)}
              className="size-4"
            />
            <span>Default tax rate</span>
            <span className="text-muted-foreground">→ {region.defaultTaxRate}%</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={applyCurrency}
              onChange={(e) => setApplyCurrency(e.target.checked)}
              className="size-4"
            />
            <span>Default currency</span>
            <span className="text-muted-foreground">→ {region.defaultCurrency}</span>
          </label>
          <div className="pt-1">
            <Button
              size="sm"
              onClick={apply}
              disabled={!applyLabel && !applyRate && !applyCurrency}
            >
              Apply preset
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground ml-0 sm:ml-[224px]">
          Current: <span className="text-foreground">{draft.taxIdLabel ?? 'Tax ID'}</span> ·{' '}
          {draft.defaultTaxRate ?? 0}% · {draft.defaultCurrency}
        </p>
      )}
    </div>
  );
}

function LogoField({
  logoDataUrl,
  onChange,
}: {
  logoDataUrl: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (file.size > 600_000) {
      toast.error('Logo is too large (max ~500 KB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') onChange(result);
    };
    reader.onerror = () => toast.error('Could not read file.');
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex items-center gap-4">
      {logoDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoDataUrl}
          alt="Logo"
          className="h-14 w-14 object-contain rounded-md border border-border bg-card"
        />
      ) : (
        <div className="h-14 w-14 rounded-md border border-dashed border-border bg-card text-[10px] uppercase tracking-wider text-muted-foreground flex items-center justify-center">
          No logo
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) handleFile(file);
          }}
        />
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          {logoDataUrl ? 'Replace' : 'Upload logo'}
        </Button>
        {logoDataUrl ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => onChange(undefined)}
          >
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}
