'use client';

import { useQuery } from '@tanstack/react-query';
import { createBrowserClient } from '@supabase/ssr';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api';

export function useCurrentUserQuery() {
  return useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      try {
        return await api.users.me();
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
          const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          );
          await supabase.auth.signOut();
          window.location.href = '/login';
        }
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
