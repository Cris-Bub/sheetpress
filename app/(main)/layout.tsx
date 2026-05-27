import { redirect } from 'next/navigation';
import { AppSidebar } from '@/components/app/sidebar';
import { tryGetWorkspace, getCurrentUser } from '@/lib/server/workspace';
import { getActiveProfile } from '@/lib/server/repo/profiles';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const ctx = await tryGetWorkspace();
  if (!ctx) {
    redirect('/onboarding');
  }

  const profile = await getActiveProfile();
  if (!profile) {
    redirect('/onboarding');
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <AppSidebar userEmail={user.email ?? ''} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
