import { db } from './db';
import { id } from './ids';
import { formatInvoiceNumber } from './numbering';
import type { Client, Invoice, LineItem, Payment, Profile } from './types';

const now = () => new Date().toISOString();

// ---------- Profile ----------

export async function createProfile(input: Omit<Profile, 'id'>): Promise<Profile> {
  const profile: Profile = { ...input, id: id() };
  await db.profiles.add(profile);
  return profile;
}

export async function updateProfile(id: string, patch: Partial<Profile>): Promise<void> {
  await db.profiles.update(id, patch);
}

export async function setActiveProfile(id: string): Promise<void> {
  await setSetting('activeProfileId', id);
}

/** Deletes a profile. Throws if this is the only profile or if any invoices reference it. */
export async function deleteProfile(id: string): Promise<void> {
  await db.transaction('rw', db.profiles, db.invoices, db.settings, async () => {
    const all = await db.profiles.toArray();
    if (all.length <= 1) throw new Error('Cannot delete your only profile.');
    const used = await db.invoices.where('profileId').equals(id).count();
    if (used > 0) throw new Error(`This profile is referenced by ${used} invoice(s). Delete or reassign them first.`);
    await db.profiles.delete(id);
    const active = await db.settings.get('activeProfileId');
    if (active?.value === id) {
      const fallback = (await db.profiles.toCollection().first())?.id;
      if (fallback) await db.settings.put({ key: 'activeProfileId', value: fallback, updatedAt: now() });
    }
  });
}

// ---------- Clients ----------

export async function createClient(input: Omit<Client, 'id' | 'createdAt'>): Promise<Client> {
  const client: Client = { ...input, id: id(), createdAt: now() };
  await db.clients.add(client);
  return client;
}

export async function updateClient(id: string, patch: Partial<Client>): Promise<void> {
  await db.clients.update(id, patch);
}

export async function archiveClient(id: string): Promise<void> {
  await db.clients.update(id, { archivedAt: now() });
}

// ---------- Invoices ----------

/**
 * Creates a draft invoice. Atomically increments the profile's counter so two
 * concurrent calls can't produce the same number. Counter is never decremented —
 * deleting a draft leaves a gap (per the permanent-numbering decision).
 */
export async function createInvoiceDraft(): Promise<Invoice> {
  return db.transaction('rw', db.profiles, db.invoices, db.settings, async () => {
    const activeRow = await db.settings.get('activeProfileId');
    const activeId = typeof activeRow?.value === 'string' ? activeRow.value : null;
    const profile = (activeId ? await db.profiles.get(activeId) : null)
      ?? (await db.profiles.toCollection().first());
    if (!profile) throw new Error('No profile found — onboarding is required first.');

    const counter = profile.nextInvoiceNumber;
    const number = formatInvoiceNumber(profile.invoiceNumberFormat, counter);

    const issue = new Date();
    const due = new Date(issue);
    due.setDate(due.getDate() + (profile.defaultPaymentTermsDays ?? 14));

    const invoice: Invoice = {
      id: id(),
      number,
      profileId: profile.id,
      clientId: '',
      profileSnapshot: profile,
      // Empty placeholder snapshot until a client is picked. The full snapshot
      // is captured on `markInvoiceSent`.
      clientSnapshot: {
        id: '',
        name: '',
        createdAt: now(),
      },
      issueDate: issue.toISOString().slice(0, 10),
      dueDate: due.toISOString().slice(0, 10),
      currency: profile.defaultCurrency,
      lineItems: [
        { id: id(), description: '', quantity: 1, unitPrice: 0 } satisfies LineItem,
      ],
      defaultTaxRate: profile.defaultTaxRate,
      notes: profile.defaultNotes,
      paymentInstructions: profile.defaultPaymentInstructions,
      status: 'draft',
      createdAt: now(),
      updatedAt: now(),
    };

    await db.invoices.add(invoice);
    await db.profiles.update(profile.id, { nextInvoiceNumber: counter + 1 });
    return invoice;
  });
}

export async function updateInvoice(id: string, patch: Partial<Invoice>): Promise<void> {
  await db.invoices.update(id, { ...patch, updatedAt: now() });
}

export async function deleteInvoiceDraft(id: string): Promise<void> {
  const inv = await db.invoices.get(id);
  if (!inv) return;
  if (inv.status !== 'draft') {
    throw new Error(`Cannot delete invoice ${inv.number}: only drafts can be deleted (status is ${inv.status}).`);
  }
  await db.invoices.delete(id);
  // Counter intentionally NOT decremented — leaves a gap.
}

/**
 * Mark a draft as sent. Freezes the client snapshot at this moment.
 * Requires the invoice to have a chosen client and at least one line item.
 */
export async function markInvoiceSent(id: string): Promise<void> {
  return db.transaction('rw', db.invoices, db.clients, async () => {
    const inv = await db.invoices.get(id);
    if (!inv) throw new Error('Invoice not found.');
    if (inv.status !== 'draft') throw new Error(`Invoice ${inv.number} is already ${inv.status}.`);
    if (!inv.clientId) throw new Error('Add a client before marking as sent.');
    if (inv.lineItems.length === 0) throw new Error('Add at least one line item before marking as sent.');

    const client = await db.clients.get(inv.clientId);
    if (!client) throw new Error('Selected client no longer exists.');

    await db.invoices.update(id, {
      status: 'sent',
      clientSnapshot: client,
      updatedAt: now(),
    });
  });
}

export async function voidInvoice(id: string): Promise<void> {
  const inv = await db.invoices.get(id);
  if (!inv) throw new Error('Invoice not found.');
  if (inv.status === 'draft' || inv.status === 'void') {
    throw new Error(`Cannot void a ${inv.status} invoice.`);
  }
  await db.invoices.update(id, { status: 'void', updatedAt: now() });
}

export async function duplicateInvoice(sourceId: string): Promise<Invoice> {
  const source = await db.invoices.get(sourceId);
  if (!source) throw new Error('Invoice not found.');
  const draft = await createInvoiceDraft();
  await updateInvoice(draft.id, {
    clientId: source.clientId,
    clientSnapshot: source.clientSnapshot,
    currency: source.currency,
    lineItems: source.lineItems.map((l) => ({ ...l, id: id() })),
    defaultTaxRate: source.defaultTaxRate,
    discount: source.discount,
    notes: source.notes,
    paymentInstructions: source.paymentInstructions,
  });
  const fresh = await db.invoices.get(draft.id);
  if (!fresh) throw new Error('Duplicate failed.');
  return fresh;
}

// ---------- Payments ----------

export async function recordPayment(input: Omit<Payment, 'id'>): Promise<Payment> {
  return db.transaction('rw', db.invoices, db.payments, async () => {
    const inv = await db.invoices.get(input.invoiceId);
    if (!inv) throw new Error('Invoice not found.');
    if (inv.status === 'draft') throw new Error('Cannot record payment on a draft.');
    if (inv.status === 'void') throw new Error('Cannot record payment on a voided invoice.');

    const payment: Payment = { ...input, id: id() };
    await db.payments.add(payment);

    // Update status based on new total paid.
    const paid = (await db.payments.where('invoiceId').equals(inv.id).toArray())
      .reduce((s, p) => s + p.amount, 0);
    const total = computeInvoiceTotal(inv);
    const nextStatus = paid >= total ? 'paid' : paid > 0 ? 'partial' : inv.status;
    if (nextStatus !== inv.status) {
      await db.invoices.update(inv.id, { status: nextStatus, updatedAt: now() });
    }

    return payment;
  });
}

export async function deletePayment(id: string): Promise<void> {
  return db.transaction('rw', db.invoices, db.payments, async () => {
    const pay = await db.payments.get(id);
    if (!pay) return;
    await db.payments.delete(id);

    const inv = await db.invoices.get(pay.invoiceId);
    if (!inv) return;
    const paid = (await db.payments.where('invoiceId').equals(inv.id).toArray())
      .reduce((s, p) => s + p.amount, 0);
    const total = computeInvoiceTotal(inv);
    const nextStatus = paid >= total ? 'paid' : paid > 0 ? 'partial' : 'sent';
    if (nextStatus !== inv.status) {
      await db.invoices.update(inv.id, { status: nextStatus, updatedAt: now() });
    }
  });
}

// ---------- Settings (k/v) ----------

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await db.settings.put({ key, value, updatedAt: now() });
}

// ---------- Bulk ops ----------

export async function wipeAllData(): Promise<void> {
  await db.transaction('rw', [db.profiles, db.clients, db.invoices, db.payments, db.settings], async () => {
    await Promise.all([
      db.profiles.clear(),
      db.clients.clear(),
      db.invoices.clear(),
      db.payments.clear(),
      db.settings.clear(),
    ]);
  });
}

// Local helper that mirrors lib/format.computeTotals but inlined to avoid the
// browser-only Intl call from inside a Dexie transaction. Logic must stay in sync.
function computeInvoiceTotal(invoice: Invoice): number {
  const subtotal = invoice.lineItems.reduce(
    (s, i) => s + Math.round(i.quantity * i.unitPrice),
    0,
  );
  const discount = invoice.discount
    ? invoice.discount.type === 'percent'
      ? Math.round((subtotal * invoice.discount.value) / 100)
      : Math.min(invoice.discount.value, subtotal)
    : 0;
  const tax = invoice.lineItems.reduce((s, i) => {
    const ls = Math.round(i.quantity * i.unitPrice);
    const share = subtotal === 0 ? 0 : ls - (ls * discount) / subtotal;
    const rate = i.taxRate ?? invoice.defaultTaxRate ?? 0;
    return s + Math.round((share * rate) / 100);
  }, 0);
  return subtotal - discount + tax;
}
