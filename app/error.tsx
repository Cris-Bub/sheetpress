'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-8">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-3xl tracking-tight">Something went wrong.</h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Your data is safe — it lives on this device. The error has been logged to your browser
          console. Try the action again, or reload.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">{error.digest}</p>
        ) : null}
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button onClick={reset} variant="outline">
            Try again
          </Button>
          <Button render={<Link href="/" />}>Back to dashboard</Button>
        </div>
      </div>
    </div>
  );
}
