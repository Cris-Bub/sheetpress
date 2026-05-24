// Core data model. Money is always stored as integer minor units (e.g. cents).
// See SPEC.md §5.

export type Address = {
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode: string;
  country: string; // ISO 3166-1 alpha-2
};

export type Profile = {
  id: string;
  businessName: string;
  legalName?: string;
  taxId?: string;
  taxIdLabel?: string;
  email: string;
  phone?: string;
  address: Address;
  logoDataUrl?: string;
  defaultPaymentInstructions?: string;
  defaultPaymentTermsDays: number;
  defaultNotes?: string;
  defaultCurrency: string;
  accentColor: string;
  invoiceNumberFormat: string;
  nextInvoiceNumber: number;
};

export type Client = {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  taxId?: string;
  address?: Address;
  defaultCurrency?: string;
  notes?: string;
  createdAt: string;
  archivedAt?: string;
};

export type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number; // integer minor units
  taxRate?: number; // percent
};

export type Discount =
  | { type: 'percent'; value: number }
  | { type: 'amount'; value: number };

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'paid'
  | 'partial'
  | 'overdue'
  | 'void';

export type Invoice = {
  id: string;
  number: string;
  profileId: string;
  clientId: string;
  clientSnapshot: Client;
  profileSnapshot: Profile;
  issueDate: string;
  dueDate: string;
  currency: string;
  lineItems: LineItem[];
  defaultTaxRate?: number;
  discount?: Discount;
  notes?: string;
  paymentInstructions?: string;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
};

export type Payment = {
  id: string;
  invoiceId: string;
  date: string;
  amount: number; // integer minor units
  method?: string;
  note?: string;
};
