'use client';

import Link from 'next/link';
import { InvoiceEditor } from '@/components/app/invoice-editor';
import { useInvoice, isLoaded } from '@/lib/queries';
import { Button } from '@/components/ui/button';

export function EditInvoiceView({ id }: { id: string }) {
  const invoice = useInvoice(id);

  if (!isLoaded(invoice)) {
    return (
      <div className="flex items-center justify-center h-screen text-sm text-muted-foreground">
        Loading…
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

  return <InvoiceEditor existing={invoice} />;
}
