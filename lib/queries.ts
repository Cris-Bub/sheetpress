'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

/** Returns the active profile (v1 has at most one). undefined while loading; null when none exists. */
export function useProfile() {
  return useLiveQuery(async () => {
    const p = await db.profiles.toCollection().first();
    return p ?? null;
  }, []);
}

export function useClients() {
  return useLiveQuery(() => db.clients.orderBy('name').toArray(), []);
}

export function useClient(id: string | undefined) {
  return useLiveQuery(async () => {
    if (!id) return null;
    return (await db.clients.get(id)) ?? null;
  }, [id]);
}

export function useInvoices() {
  return useLiveQuery(() => db.invoices.orderBy('issueDate').reverse().toArray(), []);
}

export function useInvoice(id: string | undefined) {
  return useLiveQuery(async () => {
    if (!id) return null;
    return (await db.invoices.get(id)) ?? null;
  }, [id]);
}

export function usePayments() {
  return useLiveQuery(() => db.payments.orderBy('date').reverse().toArray(), []);
}

export function usePaymentsForInvoice(invoiceId: string | undefined) {
  return useLiveQuery(async () => {
    if (!invoiceId) return [];
    return db.payments.where('invoiceId').equals(invoiceId).reverse().sortBy('date');
  }, [invoiceId]);
}

export function useSetting<T = unknown>(key: string) {
  return useLiveQuery(async () => {
    const row = await db.settings.get(key);
    return (row?.value as T | undefined) ?? null;
  }, [key]);
}

/** Loaded-state guard: returns true once a Dexie query has resolved (not undefined). */
export function isLoaded<T>(value: T | undefined): value is T {
  return value !== undefined;
}
