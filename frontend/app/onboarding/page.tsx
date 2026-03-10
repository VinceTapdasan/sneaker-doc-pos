'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useCurrentUserQuery } from '@/hooks/useCurrentUserQuery';
import { api } from '@/lib/api';
import { useBranchesQuery } from '@/hooks/useBranchesQuery';
import { toTitleCase } from '@/utils/text';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);

  const { data: currentUser, isLoading: userLoading } = useCurrentUserQuery();
  const { data: branches = [], isLoading: branchesLoading } = useBranchesQuery(true);

  // Redirect away if already assigned to a branch
  useEffect(() => {
    if (!userLoading && currentUser && currentUser.branchId !== null) {
      router.replace('/');
    }
  }, [currentUser, userLoading, router]);

  const onboardMut = useMutation({
    mutationFn: (branchId: number) => api.users.onboard(branchId),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['current-user'] });
      window.location.href = '/transactions';
    },
  });

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-zinc-950 tracking-tight">Welcome</h1>
          <p className="text-sm text-zinc-500 mt-1">Select your branch to get started</p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Branch</p>

          {branchesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-zinc-200 rounded animate-pulse" />
              ))}
            </div>
          ) : branches.length === 0 ? (
            <p className="text-sm text-zinc-400">No branches available. Contact your admin.</p>
          ) : (
            <div className="space-y-2">
              {branches.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBranchId(b.id)}
                  className={`w-full text-left px-4 py-3 rounded-md border text-sm font-medium transition-colors duration-150 ${
                    selectedBranchId === b.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  {toTitleCase(b.name)}
                </button>
              ))}
            </div>
          )}

          {onboardMut.isError && (
            <p className="text-xs text-red-500">Something went wrong. Try again.</p>
          )}

          <Button
            variant="dark"
            className="w-full"
            disabled={!selectedBranchId || onboardMut.isPending}
            onClick={() => selectedBranchId && onboardMut.mutate(selectedBranchId)}
          >
            {onboardMut.isPending ? <Spinner /> : 'Confirm Branch'}
          </Button>
        </div>
      </div>
    </div>
  );
}
