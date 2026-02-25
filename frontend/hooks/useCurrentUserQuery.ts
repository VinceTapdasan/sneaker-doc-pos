'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useCurrentUserQuery() {
  return useQuery({
    queryKey: ['current-user'],
    queryFn: () => api.users.me(),
    staleTime: 5 * 60 * 1000,
  });
}
