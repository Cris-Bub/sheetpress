'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

/** Returns the currently active profile. Falls back to the first if no active is set.
 *  undefined while loading; null when no profiles exist. */
export function useProfile() {
  return useLiveQuery(async () => {
    const activeRow = await db.settings.get('activeProfileId');
    const activeId = typeof activeRow?.value === 'string' ? activeRow.value : null;
    if (activeId) {
      const found = await db.profiles.get(activeId);
      if (found) return found;
    }
    const p = await db.profiles.toCollection().first();
    return p ?? null;
  }, []);
}

/** Returns all profiles, name-sorted. undefined while loading. */
export function useProfiles() {
  return useLiveQuery(() => db.profiles.toArray(), []);
}

/** Returns just the active profile id (or null). */
export function useActiveProfileId() {
  return useLiveQuery(async () => {
    const row = await db.settings.get('activeProfileId');
    return typeof row?.value === 'string' ? row.value : null;
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
