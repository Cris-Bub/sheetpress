import 'server-only';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export type WorkspaceContext = {
  userId: string;
  workspaceId: string;
};

export class UnauthenticatedError extends Error {
  constructor() {
    super('UNAUTHENTICATED');
    this.name = 'UnauthenticatedError';
  }
}

export class NoWorkspaceError extends Error {
  constructor() {
    super('NO_WORKSPACE');
    this.name = 'NoWorkspaceError';
  }
}

/**
 * Resolves the current user and the workspace they belong to. Throws if the
 * user is signed out (caller redirects to /login) or has no workspace yet
 * (caller redirects to /onboarding).
 *
 * v1 assumes a single workspace per user — picks the first/only membership.
 */
export async function requireWorkspace(): Promise<WorkspaceContext> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthenticatedError();

  const { data: member, error } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!member) throw new NoWorkspaceError();
  return { userId: user.id, workspaceId: member.workspace_id };
}

/** Returns the signed-in user, or null. Does not throw. */
export async function getCurrentUser() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Resolves the workspace context without throwing. Returns null on either failure. */
export async function tryGetWorkspace(): Promise<WorkspaceContext | null> {
  try {
    return await requireWorkspace();
  } catch (err) {
    if (err instanceof UnauthenticatedError || err instanceof NoWorkspaceError) return null;
    throw err;
  }
}
