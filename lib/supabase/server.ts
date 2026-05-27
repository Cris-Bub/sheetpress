import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client. Use from Server Components, Server Actions, and
 * Route Handlers. Reads the request cookies via next/headers.
 *
 * Database typing is omitted while lib/supabase/types.ts is hand-maintained;
 * once `supabase gen types typescript --local` is wired up we can put it back.
 */
export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // RSC context — middleware will refresh on the next request.
          }
        },
      },
    },
  );
}
