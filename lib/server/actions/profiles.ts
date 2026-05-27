'use server';

import {
  createProfile,
  deleteProfile,
  getActiveProfile,
  getActiveProfileId,
  getProfileById,
  listProfiles,
  setActiveProfile,
  updateProfile,
} from '@/lib/server/repo/profiles';
import { createWorkspaceForUser } from '@/lib/server/repo/workspaces';
import { userHasWorkspace } from '@/lib/server/repo/workspaces';
import { getCurrentUser } from '@/lib/server/workspace';
import type { Profile } from '@/lib/types';

export async function listProfilesAction(): Promise<Profile[]> {
  return listProfiles();
}

export async function getProfileAction(id: string): Promise<Profile | null> {
  return getProfileById(id);
}

export async function getActiveProfileAction(): Promise<Profile | null> {
  try {
    return await getActiveProfile();
  } catch {
    return null;
  }
}

export async function getActiveProfileIdAction(): Promise<string | null> {
  try {
    return await getActiveProfileId();
  } catch {
    return null;
  }
}

/**
 * The "smart" create. Bootstraps a workspace on the first call (during
 * onboarding) so callers don't have to coordinate two server actions.
 * Subsequent calls just insert a profile into the user's existing workspace.
 * Setting the newly created profile as the active one mirrors the local-first
 * UX where adding a new profile becomes the editor's default.
 */
export async function createProfileAction(input: Omit<Profile, 'id'>): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Sign in to create a profile.');

  const hasWs = await userHasWorkspace(user.id);
  if (!hasWs) {
    const wsName = (input.businessName?.trim() || 'My workspace').slice(0, 80);
    await createWorkspaceForUser(user.id, wsName);
  }

  const profile = await createProfile(input);
  await setActiveProfile(profile.id);
  return profile;
}

export async function updateProfileAction(id: string, patch: Partial<Profile>): Promise<void> {
  await updateProfile(id, patch);
}

export async function setActiveProfileAction(id: string): Promise<void> {
  await setActiveProfile(id);
}

export async function deleteProfileAction(id: string): Promise<void> {
  await deleteProfile(id);
}
