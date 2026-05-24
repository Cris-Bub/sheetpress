import Dexie, { type EntityTable } from 'dexie';
import type { Client, Invoice, Payment, Profile } from './types';

// Settings is a generic key-value store for things like
// lastBackupAt, theme preference, etc.
export type SettingRow = {
  key: string;
  value: unknown;
  updatedAt: string;
};

export type SheetPressDB = Dexie & {
  profiles: EntityTable<Profile, 'id'>;
  clients: EntityTable<Client, 'id'>;
  invoices: EntityTable<Invoice, 'id'>;
  payments: EntityTable<Payment, 'id'>;
  settings: EntityTable<SettingRow, 'key'>;
};

const db = new Dexie('sheetpress') as SheetPressDB;

db.version(1).stores({
  profiles: 'id',
  clients: 'id, name, createdAt',
  invoices: 'id, number, clientId, issueDate, dueDate, status, profileId',
  payments: 'id, invoiceId, date',
  settings: 'key',
});

export { db };
