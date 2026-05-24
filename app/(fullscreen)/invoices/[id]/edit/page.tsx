import { EditInvoiceView } from './edit-invoice-view';

export default async function EditInvoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditInvoiceView id={id} />;
}
