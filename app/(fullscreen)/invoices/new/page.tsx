'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createInvoiceDraft } from '@/lib/mutations';

/**
 * Landing page for "/invoices/new". Creates a draft in the DB and replaces the
 * URL with /invoices/<id>/edit so the back button doesn't bounce back here.
 * Guarded with a ref so React 19 StrictMode's double-invoke doesn't create
 * two drafts in development.
 */
export default function NewInvoice() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const draft = await createInvoiceDraft();
        router.replace(`/invoices/${draft.id}/edit`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not create draft');
        router.replace('/invoices');
      }
    })();
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen text-sm text-muted-foreground">
      Starting a new invoice…
    </div>
  );
}
