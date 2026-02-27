import { RequireAdmin } from '@/components/auth/RequireAdmin';

export default function PromosLayout({ children }: { children: React.ReactNode }) {
  return <RequireAdmin>{children}</RequireAdmin>;
}
