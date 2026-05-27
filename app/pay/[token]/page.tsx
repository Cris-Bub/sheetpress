import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicInvoiceByTokenAction } from '@/lib/server/actions/public-invoices';
import { PublicInvoicePage } from './public-invoice-page';

export const metadata: Metadata = {
  title: 'Invoice — sheetPress',
  // Don't let search engines index public pay links. Tokens are opaque, but
  // we don't want any of these URLs surfacing in results either way.
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function PayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getPublicInvoiceByTokenAction(token);
  if (!data) notFound();

  return <PublicInvoicePage data={data} />;
}
