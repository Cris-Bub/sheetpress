import 'server-only';
import { getSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Returns true if the current user already has at least one workspace.
 * Used by the onboarding flow to decide whether to auto-create one.
 */
export async function userHasWorkspace(userId: string): Promise<boolean> {
  const supabase = await getSupabaseServerClient();
  const { count, error } = await supabase
    .from('workspace_members')
    .select('workspace_id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

/**
 * Creates a workspace owned by `userId`. The after-insert trigger on
 * workspaces inserts the matching workspace_members row, so the caller has
 * full access immediately after this resolves.
 */
export async function createWorkspaceForUser(userId: string, name: string): Promise<string> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('workspaces')
    .insert({ name, owner_id: userId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}
