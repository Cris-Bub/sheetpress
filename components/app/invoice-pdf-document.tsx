'use client';

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  Font,
} from '@react-pdf/renderer';
import type { Invoice } from '@/lib/types';
import { computeTotals, formatDate, formatMoney, lineSubtotal } from '@/lib/format';
import { isIntraCommunitySupply } from '@/lib/derive';

// Use built-in PDF fonts. The on-screen preview uses Fraunces + Inter,
// but react-pdf requires TTF/OTF and reliable CDN URLs for those don't exist.
// Helvetica + Times-Roman are guaranteed available, render at all sizes, and
// give the document a clean classic feel. See DESIGN.md §9 for the trade-off.
const FONT_SANS = 'Helvetica';
const FONT_SANS_MEDIUM = 'Helvetica-Bold';
const FONT_SERIF = 'Times-Roman';

// Disable hyphenation — invoice line items shouldn't break mid-word.
Font.registerHyphenationCallback((word) => [word]);

const ink = '#171717';
const muted = '#737373';
const subtle = '#a3a3a3';
const hairline = '#e5e5e5';

const styles = StyleSheet.create({
  page: {
    padding: '8%',
    fontFamily: FONT_SANS,
    fontSize: 10,
    color: ink,
    backgroundColor: '#ffffff',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontFamily: FONT_SERIF,
    fontSize: 32,
    letterSpacing: -0.3,
  },
  accentBar: {
    height: 3,
    width: 36,
    marginTop: 6,
    borderRadius: 1.5,
  },
  number: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    color: muted,
    marginTop: 6,
  },
  fromBlock: {
    alignItems: 'flex-end',
  },
  fromName: {
    fontFamily: FONT_SANS_MEDIUM,
    fontSize: 11,
  },
  smallMuted: {
    fontSize: 10,
    color: muted,
    marginTop: 1,
  },
  smallFaint: {
    fontSize: 10,
    color: subtle,
  },
  billToRow: {
    marginTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sectionLabel: {
    fontSize: 8,
    letterSpacing: 1.5,
    color: subtle,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  billToName: {
    fontFamily: FONT_SANS_MEDIUM,
    fontSize: 11,
  },
  datesGrid: {
    width: 200,
    flexDirection: 'column',
    gap: 4,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemsHeader: {
    marginTop: 40,
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: hairline,
  },
  itemRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: hairline,
  },
  colDescription: { flex: 1, paddingRight: 12 },
  colQty: { width: 50, textAlign: 'right' },
  colPrice: { width: 80, textAlign: 'right' },
  colAmount: { width: 80, textAlign: 'right' },
  colHeader: {
    fontSize: 8,
    letterSpacing: 1.5,
    color: subtle,
    textTransform: 'uppercase',
  },
  cellMuted: { color: muted },
  totalsBlock: {
    marginTop: 24,
    alignItems: 'flex-end',
  },
  totalsBox: {
    width: 220,
    flexDirection: 'column',
    gap: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  grandTotal: {
    borderTopWidth: 1,
    borderTopColor: hairline,
    paddingTop: 8,
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  grandTotalText: {
    fontFamily: FONT_SANS_MEDIUM,
    fontSize: 12,
  },
  footerRow: {
    marginTop: 'auto',
    paddingTop: 30,
    flexDirection: 'row',
    gap: 28,
    fontSize: 9.5,
    color: muted,
  },
  footerCol: { flex: 1 },
  intraCommunityNote: {
    marginTop: 20,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: hairline,
    fontSize: 9,
    color: muted,
    fontStyle: 'italic',
  },
});

function Address({
  address,
  alignRight,
}: {
  address?: Invoice['profileSnapshot']['address'];
  alignRight?: boolean;
}) {
  if (!address) return null;
  const style = alignRight ? { textAlign: 'right' as const } : {};
  return (
    <View style={{ marginTop: 4 }}>
      <Text style={[styles.smallMuted, style]}>{address.line1}</Text>
      {address.line2 ? <Text style={[styles.smallMuted, style]}>{address.line2}</Text> : null}
      <Text style={[styles.smallMuted, style]}>
        {address.city}
        {address.region ? `, ${address.region}` : ''} {address.postalCode}
      </Text>
      <Text style={[styles.smallMuted, style]}>{address.country}</Text>
    </View>
  );
}

export function InvoicePdfDocument({ invoice }: { invoice: Invoice }) {
  const totals = computeTotals(invoice);
  const { profileSnapshot: p, clientSnapshot: c } = invoice;

  return (
    <Document
      title={`${p.businessName} — ${invoice.number}`}
      author={p.businessName}
      subject={`Invoice ${invoice.number}`}
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Invoice</Text>
            <View
              style={[styles.accentBar, { backgroundColor: p.accentColor || '#1a1a1a' }]}
            />
            <Text style={styles.number}>{invoice.number}</Text>
          </View>
          <View style={styles.fromBlock}>
            <Text style={styles.fromName}>{p.businessName}</Text>
            {p.legalName && p.legalName !== p.businessName ? (
              <Text style={styles.smallMuted}>{p.legalName}</Text>
            ) : null}
            <Address address={p.address} alignRight />
            <Text style={[styles.smallMuted, { textAlign: 'right' }]}>{p.email}</Text>
            {p.taxId ? (
              <Text style={[styles.smallFaint, { textAlign: 'right' }]}>
                {p.taxIdLabel ?? 'Tax ID'}: {p.taxId}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Bill to + dates */}
        <View style={styles.billToRow}>
          <View>
            <Text style={styles.sectionLabel}>Billed to</Text>
            <Text style={styles.billToName}>{c?.name || '—'}</Text>
            {c?.contactName ? <Text style={styles.smallMuted}>{c.contactName}</Text> : null}
            <Address address={c?.address} />
            {c?.taxId ? <Text style={[styles.smallFaint, { marginTop: 3 }]}>Tax ID: {c.taxId}</Text> : null}
          </View>
          <View style={styles.datesGrid}>
            <View style={styles.dateRow}>
              <Text style={styles.cellMuted}>Issue date</Text>
              <Text>{formatDate(invoice.issueDate)}</Text>
            </View>
            <View style={styles.dateRow}>
              <Text style={styles.cellMuted}>Due date</Text>
              <Text>{formatDate(invoice.dueDate)}</Text>
            </View>
            <View style={styles.dateRow}>
              <Text style={styles.cellMuted}>Amount due</Text>
              <Text style={{ fontFamily: FONT_SANS_MEDIUM }}>
                {formatMoney(totals.total, invoice.currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* Items */}
        <View style={styles.itemsHeader}>
          <Text style={[styles.colHeader, styles.colDescription]}>Description</Text>
          <Text style={[styles.colHeader, styles.colQty]}>Qty</Text>
          <Text style={[styles.colHeader, styles.colPrice]}>Unit price</Text>
          <Text style={[styles.colHeader, styles.colAmount]}>Amount</Text>
        </View>
        {invoice.lineItems.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <Text style={styles.colDescription}>
              {item.description || '—'}
            </Text>
            <Text style={[styles.colQty, styles.cellMuted]}>{item.quantity}</Text>
            <Text style={[styles.colPrice, styles.cellMuted]}>
              {formatMoney(item.unitPrice, invoice.currency)}
            </Text>
            <Text style={styles.colAmount}>
              {formatMoney(lineSubtotal(item), invoice.currency)}
            </Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.cellMuted}>Subtotal</Text>
              <Text>{formatMoney(totals.subtotal, invoice.currency)}</Text>
            </View>
            {totals.discount > 0 ? (
              <View style={styles.totalRow}>
                <Text style={styles.cellMuted}>Discount</Text>
                <Text style={styles.cellMuted}>
                  −{formatMoney(totals.discount, invoice.currency)}
                </Text>
              </View>
            ) : null}
            {totals.tax > 0 ? (
              <View style={styles.totalRow}>
                <Text style={styles.cellMuted}>Tax</Text>
                <Text style={styles.cellMuted}>{formatMoney(totals.tax, invoice.currency)}</Text>
              </View>
            ) : null}
            <View style={styles.grandTotal}>
              <Text style={styles.grandTotalText}>Total</Text>
              <Text style={styles.grandTotalText}>
                {formatMoney(totals.total, invoice.currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* Intra-community supply reminder (EU↔EU B2B) */}
        {isIntraCommunitySupply(invoice) ? (
          <View style={styles.intraCommunityNote}>
            <Text>
              Intra-community supply — VAT reverse charge, Article 196 of Directive 2006/112/EC.
            </Text>
          </View>
        ) : null}

        {/* Footer: notes + payment */}
        <View style={styles.footerRow}>
          {invoice.notes ? (
            <View style={styles.footerCol}>
              <Text style={styles.sectionLabel}>Notes</Text>
              <Text>{invoice.notes}</Text>
            </View>
          ) : (
            <View style={styles.footerCol} />
          )}
          {invoice.paymentInstructions ? (
            <View style={styles.footerCol}>
              <Text style={styles.sectionLabel}>Payment</Text>
              <Text>{invoice.paymentInstructions}</Text>
            </View>
          ) : null}
        </View>

      </Page>
    </Document>
  );
}
