'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getActiveProfileAction,
  getActiveProfileIdAction,
  getProfileAction,
  listProfilesAction,
} from '@/lib/server/actions/profiles';
import { getClientAction, listClientsAction } from '@/lib/server/actions/clients';
import { getInvoiceAction, listInvoicesAction } from '@/lib/server/actions/invoices';
import {
  listPaymentsAction,
  listPaymentsForInvoiceAction,
} from '@/lib/server/actions/payments';
import { getSettingAction } from '@/lib/server/actions/settings';

// ---- Profile ----

export function useProfile() {
  return useQuery({
    queryKey: ['profile', 'active'],
    queryFn: getActiveProfileAction,
  }).data;
}

export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: listProfilesAction,
  }).data;
}

export function useActiveProfileId() {
  return useQuery({
    queryKey: ['profile', 'active', 'id'],
    queryFn: getActiveProfileIdAction,
  }).data;
}

export function useProfileById(id: string | undefined) {
  const q = useQuery({
    queryKey: ['profile', id ?? 'none'],
    queryFn: () => (id ? getProfileAction(id) : null),
    enabled: !!id,
  });
  if (!id) return null;
  return q.data;
}

// ---- Clients ----

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: listClientsAction,
  }).data;
}

export function useClient(id: string | undefined) {
  const q = useQuery({
    queryKey: ['client', id ?? 'none'],
    queryFn: () => (id ? getClientAction(id) : null),
    enabled: !!id,
  });
  if (!id) return null;
  return q.data;
}

// ---- Invoices ----

export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: listInvoicesAction,
  }).data;
}

export function useInvoice(id: string | undefined) {
  const q = useQuery({
    queryKey: ['invoice', id ?? 'none'],
    queryFn: () => (id ? getInvoiceAction(id) : null),
    enabled: !!id,
  });
  if (!id) return null;
  return q.data;
}

// ---- Payments ----

export function usePayments() {
  return useQuery({
    queryKey: ['payments'],
    queryFn: listPaymentsAction,
  }).data;
}

export function usePaymentsForInvoice(invoiceId: string | undefined) {
  const q = useQuery({
    queryKey: ['payments', 'invoice', invoiceId ?? 'none'],
    queryFn: () => (invoiceId ? listPaymentsForInvoiceAction(invoiceId) : []),
    enabled: !!invoiceId,
  });
  if (!invoiceId) return [];
  return q.data;
}

// ---- Settings k/v ----

export function useSetting<T = unknown>(key: string) {
  return useQuery({
    queryKey: ['setting', key],
    queryFn: () => getSettingAction<T>(key),
  }).data;
}

/** Loaded-state guard: returns true once a query has resolved (not undefined). */
export function isLoaded<T>(value: T | undefined): value is T {
  return value !== undefined;
}
