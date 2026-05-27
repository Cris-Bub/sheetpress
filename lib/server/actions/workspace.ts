'use server';

import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireWorkspace } from '@/lib/server/workspace';

/**
 * Removes all business data from the current user's workspace. The workspace
 * itself, the membership, and the auth user all stay. Used by Settings →
 * Data → Wipe to "start fresh" without deleting the account.
 *
 * Deletion order respects the FK graph:
 *   invoices → cascades to line_items, payments, events
 *   then clients, profiles, settings
 */
export async function wipeWorkspaceDataAction(): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const { workspaceId } = await requireWorkspace();

  // Clear active_profile_id first so the FK doesn't block profile deletion.
  await supabase
    .from('workspace_members')
    .update({ active_profile_id: null })
    .eq('workspace_id', workspaceId);

  // Invoices cascade to line_items, payments, events.
  await supabase.from('invoices').delete().eq('workspace_id', workspaceId);
  await supabase.from('clients').delete().eq('workspace_id', workspaceId);
  await supabase.from('profiles').delete().eq('workspace_id', workspaceId);
  await supabase.from('workspace_settings').delete().eq('workspace_id', workspaceId);
}
