import { RequireAdmin } from '@/components/auth/RequireAdmin';

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return <RequireAdmin>{children}</RequireAdmin>;
}
