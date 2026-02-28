'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUserQuery } from '@/hooks/useCurrentUserQuery';

export function OnboardingCheck() {
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUserQuery();

  useEffect(() => {
    // Admin and superadmin are not required to have a branch
    if (!isLoading && user && user.branchId === null && user.userType === 'staff') {
      router.push('/onboarding');
    }
  }, [user, isLoading, router]);

  return null;
}
