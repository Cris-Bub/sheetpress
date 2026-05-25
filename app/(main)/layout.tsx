import { AppSidebar } from '@/components/app/sidebar';
import { OnboardingGate } from '@/components/app/onboarding-gate';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <OnboardingGate>{children}</OnboardingGate>
      </main>
    </div>
  );
}
