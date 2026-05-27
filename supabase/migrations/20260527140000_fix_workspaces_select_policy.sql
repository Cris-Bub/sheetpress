-- Fix: workspaces SELECT policy must allow owners to see their own workspace
-- even before the workspace_members row created by the after-insert trigger
-- becomes visible to the planner.
--
-- Without this, INSERT...RETURNING on workspaces (which the supabase-js client
-- uses by default) fails because the STABLE is_workspace_member() check may be
-- evaluated before the trigger's member-row insert is visible to the policy.
-- Falling back to owner_id = auth.uid() for SELECT bypasses the timing
-- dependency for the common single-user case while leaving multi-member access
-- working as before.

drop policy if exists workspaces_select_member on public.workspaces;

create policy workspaces_select_member
  on public.workspaces for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or private.is_workspace_member(id)
  );
