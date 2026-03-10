'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LockSimpleIcon } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { createUserColumns } from '@/columns/users-columns';
import { useUsersQuery, useUpdateUserRoleMutation, useUpdateUserBranchMutation, useDeleteUserMutation } from '@/hooks/useUsersQuery';
import { useCurrentUserQuery } from '@/hooks/useCurrentUserQuery';
import { useBranchesQuery } from '@/hooks/useBranchesQuery';
import { toTitleCase } from '@/utils/text';
import { UserRoleConfirmDialog, type PendingRoleChange } from '@/components/users/UserRoleConfirmDialog';
import { UserBranchConfirmDialog, type PendingBranchChange } from '@/components/users/UserBranchConfirmDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { AppUser, Branch } from '@/lib/types';

export default function StaffPage() {
  const router = useRouter();
  const { data: currentUser, isSuccess: userLoaded } = useCurrentUserQuery();
  const isAdmin = currentUser?.userType === 'admin' || currentUser?.userType === 'superadmin';

  const { data: users = [], isLoading } = useUsersQuery();
  const { data: branches = [] } = useBranchesQuery(false);
  const updateRoleMut = useUpdateUserRoleMutation();
  const updateBranchMut = useUpdateUserBranchMutation();
  const deleteMut = useDeleteUserMutation(() => setDeleteTarget(null));

  const [pendingRoleChange, setPendingRoleChange] = useState<PendingRoleChange | null>(null);
  const [pendingBranchChange, setPendingBranchChange] = useState<PendingBranchChange | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);

  const isSuperadmin = currentUser?.userType === 'superadmin';

  const columns = useMemo(
    () => createUserColumns({
      onRoleChange: (id, newUserType, currentUserType, email) => {
        setPendingRoleChange({ id, email, currentRole: currentUserType, newRole: newUserType });
      },
      onBranchChange: isSuperadmin
        ? (id, newBranchId, currentBranchId, email, newBranchName, currentBranchName) => {
            setPendingBranchChange({ id, email, currentBranchName, newBranchId, newBranchName });
          }
        : undefined,
      onDelete: isSuperadmin ? setDeleteTarget : undefined,
      currentUserId: currentUser?.id,
      isSuperadmin,
      branches: branches as Branch[],
    }),
    [currentUser?.id, isSuperadmin, branches],
  );

  const grouped = useMemo(() => {
    const allUsers = (users as AppUser[]);
    const branchMap = new Map(branches.map((b) => [b.id, b.name]));

    const groups = new Map<string, { label: string; users: AppUser[] }>();

    for (const user of allUsers) {
      const key = user.branchId !== null ? String(user.branchId) : '__none__';
      if (!groups.has(key)) {
        const label = user.branchId !== null
          ? toTitleCase(branchMap.get(user.branchId) ?? `Branch #${user.branchId}`)
          : 'No Branch';
        groups.set(key, { label, users: [] });
      }
      groups.get(key)!.users.push(user);
    }

    return [...groups.entries()]
      .sort(([a], [b]) => {
        if (a === '__none__') return 1;
        if (b === '__none__') return -1;
        return (groups.get(a)!.label).localeCompare(groups.get(b)!.label);
      })
      .map(([, group]) => group);
  }, [users, branches]);

  if (userLoaded && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-3 text-center">
        <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center">
          <LockSimpleIcon size={20} className="text-zinc-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-950">Access restricted</p>
          <p className="text-xs text-zinc-400 mt-0.5">Staff management is only available to admins.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove staff member?"
        description={`Remove ${deleteTarget?.email}? They will no longer be able to access the system.`}
        confirmLabel="Remove"
        onConfirm={() => { if (deleteTarget) deleteMut.mutate(deleteTarget.id); }}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMut.isPending}
      />
      <UserRoleConfirmDialog
        open={pendingRoleChange !== null}
        pendingChange={pendingRoleChange}
        loading={updateRoleMut.isPending}
        onConfirm={() => {
          if (!pendingRoleChange) return;
          updateRoleMut.mutate(
            { id: pendingRoleChange.id, userType: pendingRoleChange.newRole },
            { onSuccess: () => { toast.success('Role updated'); setPendingRoleChange(null); } },
          );
        }}
        onCancel={() => setPendingRoleChange(null)}
      />
      <UserBranchConfirmDialog
        open={pendingBranchChange !== null}
        pendingChange={pendingBranchChange}
        loading={updateBranchMut.isPending}
        onConfirm={() => {
          if (!pendingBranchChange) return;
          updateBranchMut.mutate(
            { id: pendingBranchChange.id, branchId: pendingBranchChange.newBranchId },
            { onSuccess: () => { toast.success('Branch updated'); setPendingBranchChange(null); } },
          );
        }}
        onCancel={() => setPendingBranchChange(null)}
      />
      <div>
        <PageHeader
          title="Staff"
          subtitle="Manage team roles and access"
        />
        {isLoading ? (
          <DataTable
            columns={columns}
            data={[]}
            isLoading
            loadingRows={4}
            emptyTitle="No staff found"
            emptyDescription="Staff appear here once they sign in."
          />
        ) : grouped.length === 0 ? (
          <p className="text-sm text-zinc-400">No staff found.</p>
        ) : (
          <div className="space-y-8">
            {grouped.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">
                  {group.label}
                  <span className="ml-2 font-normal normal-case tracking-normal text-zinc-300">
                    {group.users.length} {group.users.length === 1 ? 'member' : 'members'}
                  </span>
                </p>
                <DataTable
                  columns={columns}
                  data={group.users}
                  isLoading={false}
                  emptyTitle="No staff"
                  emptyDescription=""
                  onRowClick={(user) => router.push(`/staff/${user.id}`)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
