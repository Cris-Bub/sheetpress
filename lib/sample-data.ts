import { db } from './db';
import { id } from './ids';
import type { Client, Invoice, Payment, Profile } from './types';

/**
 * Inserts a realistic batch of fixtures: a profile, five clients, seven invoices,
 * and four payments. Idempotent-ish: it wipes existing data first so re-running
 * always lands in a known state. Intended for development/QA only via the
 * Dev Helper — never called from end-user flows.
 */
export async function loadSampleData(): Promise<void> {
  await db.transaction('rw', [db.profiles, db.clients, db.invoices, db.payments, db.settings], async () => {
    await Promise.all([
      db.profiles.clear(),
      db.clients.clear(),
      db.invoices.clear(),
      db.payments.clear(),
      db.settings.clear(),
    ]);

    const profile: Profile = {
      id: id(),
      businessName: 'Cris Vega Studio',
      legalName: 'Cristian Vega',
      taxId: '12-3456789',
      taxIdLabel: 'EIN',
      email: 'hello@crisvega.studio',
      phone: '+1 (415) 555-0114',
      address: {
        line1: '742 Folsom St',
        line2: 'Suite 4',
        city: 'San Francisco',
        region: 'CA',
        postalCode: '94107',
        country: 'US',
      },
      defaultPaymentInstructions:
        'Bank: Chase\nRouting: 021000021\nAccount: ****1234\nOr pay via wire — details on request.',
      defaultPaymentTermsDays: 14,
      defaultNotes: 'Thanks for working with me. Payment due within 14 days of issue.',
      defaultCurrency: 'USD',
      accentColor: '#1a1a1a',
      invoiceNumberFormat: '{YYYY}-{####}',
      nextInvoiceNumber: 8,
    };
    await db.profiles.add(profile);

    const clients: Client[] = [
      {
        id: id(), name: 'Mercer & Co.', contactName: 'Anna Mercer',
        email: 'anna@mercerand.co', taxId: '98-7654321',
        address: { line1: '1200 Mission St', city: 'San Francisco', region: 'CA', postalCode: '94103', country: 'US' },
        defaultCurrency: 'USD', createdAt: '2026-01-12T10:00:00Z',
      },
      {
        id: id(), name: 'Halberd Press', contactName: 'Jens Holm',
        email: 'jens@halberdpress.dk', taxId: 'DK37294018',
        address: { line1: 'Bredgade 27', city: 'København', postalCode: '1260', country: 'DK' },
        defaultCurrency: 'EUR', createdAt: '2026-02-03T10:00:00Z',
      },
      {
        id: id(), name: 'Foothill Collective', contactName: 'Maya Patel',
        email: 'maya@foothillcollective.com',
        address: { line1: '88 Page Mill Rd', city: 'Palo Alto', region: 'CA', postalCode: '94304', country: 'US' },
        defaultCurrency: 'USD', createdAt: '2026-02-20T10:00:00Z',
      },
      {
        id: id(), name: 'Northwind Ceramics', contactName: 'Sam Reilly',
        email: 'orders@northwindceramics.com',
        address: { line1: '14 Industrial Way', city: 'Portland', region: 'OR', postalCode: '97214', country: 'US' },
        defaultCurrency: 'USD', createdAt: '2026-03-05T10:00:00Z',
      },
      {
        id: id(), name: 'Atelier Lune', contactName: 'Sophie Tremblay',
        email: 'sophie@atelierlune.fr', taxId: 'FR40123456824',
        address: { line1: '14 rue de Charonne', city: 'Paris', postalCode: '75011', country: 'FR' },
        defaultCurrency: 'EUR', createdAt: '2026-03-22T10:00:00Z',
      },
    ];
    await db.clients.bulkAdd(clients);

    const [merc, halberd, foot, north, lune] = clients;

    const mk = (
      number: string,
      client: Client,
      over: Partial<Invoice> & { lineItems: Invoice['lineItems'] },
    ): Invoice => ({
      id: id(),
      number,
      profileId: profile.id,
      clientId: client.id,
      profileSnapshot: profile,
      clientSnapshot: client,
      issueDate: '2026-05-01',
      dueDate: '2026-05-15',
      currency: client.defaultCurrency ?? 'USD',
      status: 'draft',
      notes: profile.defaultNotes,
      paymentInstructions: profile.defaultPaymentInstructions,
      createdAt: '2026-05-01T10:00:00Z',
      updatedAt: '2026-05-01T10:00:00Z',
      ...over,
    });

    const invoices: Invoice[] = [
      mk('2026-001', merc, {
        issueDate: '2026-01-15', dueDate: '2026-01-29', status: 'paid',
        lineItems: [
          { id: id(), description: 'Brand identity system — discovery & strategy', quantity: 1, unitPrice: 240000 },
          { id: id(), description: 'Logotype design (3 directions)', quantity: 1, unitPrice: 320000 },
          { id: id(), description: 'Brand guidelines document', quantity: 1, unitPrice: 180000 },
        ],
      }),
      mk('2026-002', halberd, {
        issueDate: '2026-02-08', dueDate: '2026-02-22', status: 'paid', currency: 'EUR', defaultTaxRate: 25,
        lineItems: [
          { id: id(), description: 'Catalogue layout — 64 pages', quantity: 1, unitPrice: 480000 },
          { id: id(), description: 'Cover photography direction', quantity: 1, unitPrice: 150000 },
        ],
      }),
      mk('2026-003', foot, {
        issueDate: '2026-03-01', dueDate: '2026-03-15', status: 'paid',
        lineItems: [
          { id: id(), description: 'Website art direction', quantity: 1, unitPrice: 280000 },
          { id: id(), description: 'Homepage + 4 inner page designs', quantity: 1, unitPrice: 520000 },
          { id: id(), description: 'Design handoff & developer support', quantity: 8, unitPrice: 18000 },
        ],
      }),
      mk('2026-004', north, {
        issueDate: '2026-04-02', dueDate: '2026-04-16', status: 'partial',
        lineItems: [
          { id: id(), description: 'Packaging design — 3 SKUs', quantity: 1, unitPrice: 360000 },
          { id: id(), description: 'Print production management', quantity: 1, unitPrice: 120000 },
        ],
      }),
      mk('2026-005', lune, {
        issueDate: '2026-04-18', dueDate: '2026-05-02', status: 'sent', currency: 'EUR', defaultTaxRate: 20,
        lineItems: [
          { id: id(), description: 'Exhibition graphics — design', quantity: 1, unitPrice: 220000 },
          { id: id(), description: 'Signage production oversight', quantity: 1, unitPrice: 80000 },
        ],
      }),
      mk('2026-006', merc, {
        issueDate: '2026-05-05', dueDate: '2026-05-19', status: 'sent',
        lineItems: [
          { id: id(), description: 'Editorial design — May issue', quantity: 1, unitPrice: 280000 },
          { id: id(), description: 'Illustration commissions', quantity: 3, unitPrice: 45000 },
        ],
      }),
      mk('2026-007', foot, {
        issueDate: '2026-05-20', dueDate: '2026-06-03', status: 'draft',
        lineItems: [
          { id: id(), description: 'Photography direction — summer campaign', quantity: 1, unitPrice: 180000 },
        ],
      }),
    ];
    await db.invoices.bulkAdd(invoices);

    const [inv001, inv002, inv003, inv004] = invoices;
    const payments: Payment[] = [
      { id: id(), invoiceId: inv001.id, date: '2026-01-22', amount: 740000, method: 'Bank transfer' },
      { id: id(), invoiceId: inv002.id, date: '2026-02-19', amount: 787500, method: 'Bank transfer' },
      { id: id(), invoiceId: inv003.id, date: '2026-03-12', amount: 944000, method: 'Stripe' },
      { id: id(), invoiceId: inv004.id, date: '2026-04-10', amount: 200000, method: 'Bank transfer', note: 'First half' },
    ];
    await db.payments.bulkAdd(payments);
  });
}
