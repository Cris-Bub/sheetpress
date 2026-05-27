import 'server-only';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireWorkspace } from '@/lib/server/workspace';
import type { Json } from '@/lib/supabase/types';

export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const supabase = await getSupabaseServerClient();
  const { workspaceId } = await requireWorkspace();
  const { data, error } = await supabase
    .from('workspace_settings')
    .select('value')
    .eq('workspace_id', workspaceId)
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  return (data?.value ?? null) as T | null;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const { workspaceId } = await requireWorkspace();
  const { error } = await supabase
    .from('workspace_settings')
    .upsert(
      {
        workspace_id: workspaceId,
        key,
        value: value as unknown as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,key' },
    );
  if (error) throw error;
}
