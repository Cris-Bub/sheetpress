'use server';

import {
  archiveClient,
  createClient,
  getClient,
  listClients,
  updateClient,
} from '@/lib/server/repo/clients';
import type { Client } from '@/lib/types';

export async function listClientsAction(): Promise<Client[]> {
  return listClients();
}

export async function getClientAction(id: string): Promise<Client | null> {
  return getClient(id);
}

export async function createClientAction(input: Omit<Client, 'id' | 'createdAt'>): Promise<Client> {
  return createClient(input);
}

export async function updateClientAction(id: string, patch: Partial<Client>): Promise<void> {
  return updateClient(id, patch);
}

export async function archiveClientAction(id: string): Promise<void> {
  return archiveClient(id);
}
