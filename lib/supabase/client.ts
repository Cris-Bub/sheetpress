'use client';

import { createBrowserClient } from '@supabase/ssr';

let cached: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Browser Supabase client. Singleton so the auth subscription stays stable
 * across renders. Reads from cookies on every request thanks to @supabase/ssr.
 *
 * The Database generic is omitted while we hand-maintain lib/supabase/types.ts;
 * once `supabase gen types typescript --local` is wired up we can put it back
 * for strict insert/update inference.
 */
export function getSupabaseBrowserClient() {
  if (cached) return cached;
  cached = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return cached;
}
