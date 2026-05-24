'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useProfile, isLoaded } from '@/lib/queries';

/**
 * First-run gate: if no profile exists, push the user to /onboarding.
 * Renders children unchanged once a profile is present. Renders nothing while
 * the initial query is in flight (sidebar still shows from the layout).
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const profile = useProfile();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded(profile)) return;
    if (profile === null && pathname !== '/onboarding') {
      router.replace('/onboarding');
    }
  }, [profile, pathname, router]);

  if (!isLoaded(profile)) return null;
  if (profile === null) return null;
  return <>{children}</>;
}
