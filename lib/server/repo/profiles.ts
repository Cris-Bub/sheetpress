import 'server-only';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import {
  profileFromRow,
  profileToInsert,
  profileToUpdate,
} from '@/lib/server/mapping';
import { requireWorkspace } from '@/lib/server/workspace';
import type { Profile } from '@/lib/types';

export async function listProfiles(): Promise<Profile[]> {
  const supabase = await getSupabaseServerClient();
  const { workspaceId } = await requireWorkspace();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(profileFromRow);
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const supabase = await getSupabaseServerClient();
  await requireWorkspace();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? profileFromRow(data) : null;
}

/**
 * The "currently selected" profile. Reads workspace_members.active_profile_id
 * first; if unset, falls back to the first profile in the workspace (matches
 * the Dexie behavior in lib/queries.ts).
 */
export async function getActiveProfile(): Promise<Profile | null> {
  const supabase = await getSupabaseServerClient();
  const { workspaceId, userId } = await requireWorkspace();

  const { data: member, error: memberErr } = await supabase
    .from('workspace_members')
    .select('active_profile_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();
  if (memberErr) throw memberErr;

  if (member?.active_profile_id) {
    const profile = await getProfileById(member.active_profile_id);
    if (profile) return profile;
  }

  const { data: first, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return first ? profileFromRow(first) : null;
}

export async function getActiveProfileId(): Promise<string | null> {
  const supabase = await getSupabaseServerClient();
  const { workspaceId, userId } = await requireWorkspace();
  const { data, error } = await supabase
    .from('workspace_members')
    .select('active_profile_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.active_profile_id ?? null;
}

export async function createProfile(input: Omit<Profile, 'id'>): Promise<Profile> {
  const supabase = await getSupabaseServerClient();
  const { workspaceId } = await requireWorkspace();
  const { data, error } = await supabase
    .from('profiles')
    .insert(profileToInsert(input, workspaceId))
    .select('*')
    .single();
  if (error) throw error;
  return profileFromRow(data);
}

export async function updateProfile(id: string, patch: Partial<Profile>): Promise<void> {
  const supabase = await getSupabaseServerClient();
  await requireWorkspace();
  const update = profileToUpdate(patch);
  if (Object.keys(update).length === 0) return;
  const { error } = await supabase.from('profiles').update(update).eq('id', id);
  if (error) throw error;
}

export async function setActiveProfile(id: string): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const { workspaceId, userId } = await requireWorkspace();
  const { error } = await supabase
    .from('workspace_members')
    .update({ active_profile_id: id })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);
  if (error) throw error;
}

/**
 * Deletes a profile. Mirrors the Dexie guards: can't delete the only profile,
 * can't delete one referenced by invoices.
 */
export async function deleteProfile(id: string): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const { workspaceId } = await requireWorkspace();

  const { count: profCount, error: countErr } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);
  if (countErr) throw countErr;
  if ((profCount ?? 0) <= 1) throw new Error('Cannot delete your only profile.');

  const { count: invCount, error: invErr } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', id);
  if (invErr) throw invErr;
  if ((invCount ?? 0) > 0) {
    throw new Error(`This profile is referenced by ${invCount} invoice(s). Delete or reassign them first.`);
  }

  const { error } = await supabase.from('profiles').delete().eq('id', id);
  if (error) throw error;
}
