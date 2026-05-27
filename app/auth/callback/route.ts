import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Exchanges an email-confirmation / magic-link / OAuth code for a session.
 * Supabase redirects here after the user clicks the link in their inbox.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/';

  if (code) {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const redirect = url.clone();
      redirect.pathname = next.startsWith('/') ? next : '/';
      redirect.search = '';
      return NextResponse.redirect(redirect);
    }
  }

  const fail = url.clone();
  fail.pathname = '/login';
  fail.search = '?error=auth_callback_failed';
  return NextResponse.redirect(fail);
}
