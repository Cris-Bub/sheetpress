'use server';

import {
  deletePayment,
  listPayments,
  listPaymentsForInvoice,
  recordPayment,
} from '@/lib/server/repo/payments';
import type { Payment } from '@/lib/types';

export async function listPaymentsAction(): Promise<Payment[]> {
  return listPayments();
}

export async function listPaymentsForInvoiceAction(invoiceId: string): Promise<Payment[]> {
  return listPaymentsForInvoice(invoiceId);
}

export async function recordPaymentAction(input: Omit<Payment, 'id'>): Promise<Payment> {
  return recordPayment(input);
}

export async function deletePaymentAction(id: string): Promise<void> {
  return deletePayment(id);
}
