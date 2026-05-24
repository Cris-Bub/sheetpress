'use client';

import { useState } from 'react';
import { Database, Sparkles, Trash2, FlaskConical, FastForward, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/db';
import { loadSampleData } from '@/lib/sample-data';
import { wipeAllData, createProfile } from '@/lib/mutations';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

/**
 * Dev-only floating helper. Mounted in app/layout.tsx behind a NODE_ENV check.
 * Gives us one-click control over DB state while building, so we don't have to
 * poke at IndexedDB in devtools every iteration.
 */
export function DevHelper() {
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<unknown>, successMsg?: string) => {
    setBusy(label);
    try {
      await fn();
      if (successMsg) toast.success(successMsg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Popover>
        <PopoverTrigger
          render={
            <button
              aria-label="Dev helper"
              className="size-9 rounded-full bg-foreground/80 text-background backdrop-blur shadow-lg hover:bg-foreground transition-colors flex items-center justify-center opacity-60 hover:opacity-100"
            />
          }
        >
          <FlaskConical className="size-4" />
        </PopoverTrigger>
        <PopoverContent side="top" align="end" className="w-64 p-2">
          <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Dev helper · NODE_ENV
          </div>
          <Action
            icon={<Sparkles className="size-4" />}
            label="Load sample data"
            busy={busy === 'load'}
            onClick={() => run('load', loadSampleData, 'Sample data loaded')}
          />
          <Action
            icon={<Database className="size-4" />}
            label="Inspect DB (console)"
            busy={busy === 'inspect'}
            onClick={() =>
              run('inspect', async () => {
                const [profiles, clients, invoices, payments, settings] = await Promise.all([
                  db.profiles.count(),
                  db.clients.count(),
                  db.invoices.count(),
                  db.payments.count(),
                  db.settings.count(),
                ]);
                // eslint-disable-next-line no-console
                console.table({ profiles, clients, invoices, payments, settings });
              }, 'Counts logged to console')
            }
          />
          <Action
            icon={<FastForward className="size-4" />}
            label="Skip onboarding (stub profile)"
            busy={busy === 'skip'}
            onClick={() =>
              run('skip', async () => {
                const existing = await db.profiles.toCollection().first();
                if (existing) return;
                await createProfile({
                  businessName: 'Dev Studio',
                  email: 'dev@example.com',
                  address: { line1: '', city: '', postalCode: '', country: 'US' },
                  defaultPaymentTermsDays: 14,
                  defaultCurrency: 'USD',
                  accentColor: '#1a1a1a',
                  invoiceNumberFormat: '{YYYY}-{####}',
                  nextInvoiceNumber: 1,
                });
              }, 'Stub profile created')
            }
          />
          <Action
            icon={<Trash2 className="size-4 text-destructive" />}
            label="Wipe DB"
            destructive
            busy={busy === 'wipe'}
            onClick={() => run('wipe', wipeAllData, 'Everything wiped')}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function Action({
  icon,
  label,
  destructive,
  busy,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  destructive?: boolean;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={busy}
      className={
        'w-full justify-start gap-2 h-8 font-normal ' +
        (destructive ? 'text-destructive hover:text-destructive' : '')
      }
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : icon}
      {label}
    </Button>
  );
}
