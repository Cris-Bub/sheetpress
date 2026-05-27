'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signUpAction, type AuthFormState } from '../actions';

export function SignupForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    signUpAction,
    {},
  );

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-sm font-normal text-muted-foreground">
          Email
        </Label>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-sm font-normal text-muted-foreground">
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>

      {state.error ? (
        <p className="text-sm text-[oklch(0.58_0.15_27)]" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? 'Creating…' : 'Create account'}
      </Button>
    </form>
  );
}
