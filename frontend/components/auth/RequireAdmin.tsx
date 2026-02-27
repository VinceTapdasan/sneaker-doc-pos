'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUserQuery } from '@/hooks/useCurrentUserQuery';

interface RequireAdminProps {
  children: React.ReactNode;
}

export function RequireAdmin({ children }: RequireAdminProps) {
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUserQuery();

  useEffect(() => {
    if (!isLoading && user && user.userType === 'staff') {
      router.replace('/transactions');
    }
  }, [user, isLoading, router]);

  if (isLoading) return null;
  if (!user || user.userType === 'staff') return null;

  return <>{children}</>;
}
