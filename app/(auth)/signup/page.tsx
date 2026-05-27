import Link from 'next/link';
import { SignupForm } from './signup-form';

export const metadata = { title: 'Create account — sheetPress' };

export default function SignupPage() {
  return (
    <div>
      <h1 className="font-serif text-3xl tracking-tight">Create your account.</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Free during development. Your invoices, hosted.
      </p>

      <SignupForm />

      <p className="mt-8 text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="underline-offset-4 hover:underline text-foreground">
          Sign in
        </Link>
        .
      </p>
    </div>
  );
}
