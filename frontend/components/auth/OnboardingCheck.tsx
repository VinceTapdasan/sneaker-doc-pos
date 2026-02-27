'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUserQuery } from '@/hooks/useCurrentUserQuery';

export function OnboardingCheck() {
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUserQuery();

  useEffect(() => {
    // Superadmin may not have a branch — skip onboarding for them
    if (!isLoading && user && user.branchId === null && user.userType !== 'superadmin') {
      router.push('/onboarding');
    }
  }, [user, isLoading, router]);

  return null;
}
