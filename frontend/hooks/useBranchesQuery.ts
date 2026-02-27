'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useBranchesQuery(activeOnly = false) {
  return useQuery({
    queryKey: ['branches', activeOnly],
    queryFn: () => api.branches.list(activeOnly),
    staleTime: 5 * 60 * 1000,
  });
}
