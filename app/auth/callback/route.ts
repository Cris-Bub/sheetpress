import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

function safeNext(value: string | null): string {
  if (value && value.startsWith('/') && !value.startsWith('//')) return value;
  return '/';
}

/**
 * Exchanges an email-confirmation / magic-link / OAuth code for a session.
 * Supabase redirects here after the user clicks the link in their inbox.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));

  if (code) {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  const fail = url.clone();
  fail.pathname = '/login';
  fail.search = '?error=auth_callback_failed';
  return NextResponse.redirect(fail);
}
