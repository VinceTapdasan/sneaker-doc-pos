import { RequireAdmin } from '@/components/auth/RequireAdmin';

export default function ExpensesLayout({ children }: { children: React.ReactNode }) {
  return <RequireAdmin>{children}</RequireAdmin>;
}
