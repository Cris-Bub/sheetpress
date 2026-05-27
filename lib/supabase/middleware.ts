import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Routes that don't require authentication. Anything not in this set is
 * redirected to /login when the user is signed out.
 *
 * Keep this list tight — public routes are where Phase 4's /pay/[token] will
 * eventually live. Until that ships there's nothing else genuinely public.
 */
function isPublicPath(pathname: string): boolean {
  if (pathname === '/login' || pathname === '/signup') return true;
  if (pathname.startsWith('/auth/')) return true;
  if (pathname.startsWith('/pay/')) return true; // Phase 4 (placeholder allowance)
  return false;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: this getUser() call refreshes the session cookie. Do not remove.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl;
  const pathname = url.pathname;

  if (!user && !isPublicPath(pathname)) {
    const next = url.clone();
    next.pathname = '/login';
    if (pathname !== '/') {
      next.searchParams.set('next', pathname + (url.search || ''));
    } else {
      next.searchParams.delete('next');
    }
    return NextResponse.redirect(next);
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    const next = url.clone();
    next.pathname = url.searchParams.get('next') || '/';
    next.search = '';
    return NextResponse.redirect(next);
  }

  return response;
}
