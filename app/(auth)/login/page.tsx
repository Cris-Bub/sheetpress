import Link from 'next/link';
import { LoginForm } from './login-form';

export const metadata = { title: 'Sign in — sheetPress' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div>
      <h1 className="font-serif text-3xl tracking-tight">Sign in.</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Pick up where you left off.
      </p>

      <LoginForm next={next} />

      <p className="mt-8 text-sm text-muted-foreground">
        New here?{' '}
        <Link href="/signup" className="underline-offset-4 hover:underline text-foreground">
          Create an account
        </Link>
        .
      </p>
    </div>
  );
}
