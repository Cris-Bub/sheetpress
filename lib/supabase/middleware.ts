import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Routes that don't require authentication. Anything not in this set is
 * redirected to /login when the user is signed out.
 *
 * Keep this list tight — /pay/[token] is the only public invoice surface.
 */
function isPublicPath(pathname: string): boolean {
  if (pathname === '/login' || pathname === '/signup') return true;
  if (pathname.startsWith('/auth/')) return true;
  if (pathname.startsWith('/pay/')) return true;
  return false;
}

function safeNext(value: string | null): string {
  if (value && value.startsWith('/') && !value.startsWith('//')) return value;
  return '/';
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
    return NextResponse.redirect(new URL(safeNext(url.searchParams.get('next')), url.origin));
  }

  return response;
}
