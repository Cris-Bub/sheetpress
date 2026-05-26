import { renderInvoiceToBlob, pdfFileName } from './pdf';
import { computeTotals, formatDate, formatMoney } from './format';
import type { Invoice } from './types';

export type ComposedEmail = {
  to: string;
  subject: string;
  body: string;
};

/**
 * Default subject + body for an invoice email. Pulls from the invoice's
 * snapshots so the wording matches the PDF the client will see attached.
 */
export function composeInvoiceEmail(invoice: Invoice): ComposedEmail {
  const client = invoice.clientSnapshot;
  const profile = invoice.profileSnapshot;
  const totals = computeTotals(invoice);

  const greetingName = client.contactName || client.name || 'there';
  const total = formatMoney(totals.total, invoice.currency);
  const dueDate = formatDate(invoice.dueDate);

  const subject = `Invoice ${invoice.number} from ${profile.businessName}`;
  const lines = [
    `Hi ${greetingName},`,
    '',
    `Please find invoice ${invoice.number} for ${total} attached. Payment is due ${dueDate}.`,
  ];
  if (invoice.stripePaymentLink) {
    lines.push('', `Pay online: ${invoice.stripePaymentLink}`);
  }
  lines.push(
    '',
    `Let me know if you have any questions.`,
    '',
    `Thanks,`,
    profile.businessName,
  );
  const body = lines.join('\n');

  return { to: client.email ?? '', subject, body };
}

export type SendChannel = 'web-share' | 'mailto';

export type SendResult = { channel: SendChannel };

/**
 * Send an invoice by handing it to the user's mail client.
 *
 * Tries Web Share API with the PDF file first (Mac/iOS Safari hands it to
 * Apple Mail with the file pre-attached). Falls back to mailto: + an auto-
 * download of the PDF for manual attach on platforms without file sharing.
 *
 * Throws on PDF render failure or when the user cancels the share sheet.
 * Resolves once a delivery path has been initiated.
 */
export async function sendInvoiceEmail(invoice: Invoice): Promise<SendResult> {
  const { to, subject, body } = composeInvoiceEmail(invoice);

  const blob = await renderInvoiceToBlob(invoice);
  const filename = pdfFileName(invoice);
  const file = new File([blob], filename, { type: 'application/pdf' });

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: subject,
        text: to ? `${body}\n\nTo: ${to}` : body,
      });
      return { channel: 'web-share' };
    } catch (err) {
      // User dismissed the share sheet — propagate so the caller skips
      // auto-mark-sent. Any other share failure falls through to mailto.
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
    }
  }

  triggerPdfDownload(blob, filename);
  openMailto(to, subject, body);
  return { channel: 'mailto' };
}

function triggerPdfDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openMailto(to: string, subject: string, body: string): void {
  const params = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const href = `mailto:${encodeURIComponent(to)}?${params}`;
  const a = document.createElement('a');
  a.href = href;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
