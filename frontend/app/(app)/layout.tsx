import { Sidebar } from '@/components/layout/sidebar';
import { OnboardingCheck } from '@/components/auth/OnboardingCheck';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <OnboardingCheck />
      <Sidebar />
      <div className="pt-14 lg:pt-0 lg:ml-56">
        <main className="max-w-7xl mx-auto px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
