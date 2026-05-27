import 'server-only';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { clientFromRow, clientToInsert, clientToUpdate } from '@/lib/server/mapping';
import { requireWorkspace } from '@/lib/server/workspace';
import type { Client } from '@/lib/types';

export async function listClients(): Promise<Client[]> {
  const supabase = await getSupabaseServerClient();
  const { workspaceId } = await requireWorkspace();
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(clientFromRow);
}

export async function getClient(id: string): Promise<Client | null> {
  const supabase = await getSupabaseServerClient();
  await requireWorkspace();
  const { data, error } = await supabase.from('clients').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? clientFromRow(data) : null;
}

export async function createClient(input: Omit<Client, 'id' | 'createdAt'>): Promise<Client> {
  const supabase = await getSupabaseServerClient();
  const { workspaceId } = await requireWorkspace();
  const { data, error } = await supabase
    .from('clients')
    .insert(clientToInsert(input, workspaceId))
    .select('*')
    .single();
  if (error) throw error;
  return clientFromRow(data);
}

export async function updateClient(id: string, patch: Partial<Client>): Promise<void> {
  const supabase = await getSupabaseServerClient();
  await requireWorkspace();
  const update = clientToUpdate(patch);
  if (Object.keys(update).length === 0) return;
  const { error } = await supabase.from('clients').update(update).eq('id', id);
  if (error) throw error;
}

export async function archiveClient(id: string): Promise<void> {
  await updateClient(id, { archivedAt: new Date().toISOString() });
}
