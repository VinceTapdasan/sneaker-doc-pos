'use client';

import { useMemo, useState } from 'react';
import { LockSimpleIcon, ArrowRightIcon } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { createUserColumns } from '@/columns/users-columns';
import { useUsersQuery, useUpdateUserRoleMutation } from '@/hooks/useUsersQuery';
import { useCurrentUserQuery } from '@/hooks/useCurrentUserQuery';
import { useBranchesQuery } from '@/hooks/useBranchesQuery';
import { toTitleCase } from '@/utils/text';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { AppUser } from '@/lib/types';

export default function UsersPage() {
  const { data: currentUser, isSuccess: userLoaded } = useCurrentUserQuery();
  const isAdmin = currentUser?.userType === 'admin' || currentUser?.userType === 'superadmin';

  const { data: users = [], isLoading } = useUsersQuery();
  const { data: branches = [] } = useBranchesQuery(false);
  const updateRoleMut = useUpdateUserRoleMutation();

  const [pendingRoleChange, setPendingRoleChange] = useState<{
    id: string;
    email: string;
    currentRole: string;
    newRole: string;
  } | null>(null);

  const columns = useMemo(
    () => createUserColumns({
      onRoleChange: (id, newUserType, currentUserType, email) => {
        setPendingRoleChange({ id, email, currentRole: currentUserType, newRole: newUserType });
      },
      currentUserId: currentUser?.id,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser?.id],
  );

  const grouped = useMemo(() => {
    const allUsers = (users as AppUser[]).filter((u) => u.id !== currentUser?.id);
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

    // Sort: named branches first (alphabetically), unassigned last
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
          <p className="text-xs text-zinc-400 mt-0.5">User management is only available to admins.</p>
        </div>
      </div>
    );
  }

  const ROLE_STYLES: Record<string, string> = {
    staff: 'bg-zinc-100 text-zinc-600',
    admin: 'bg-blue-50 text-blue-600',
    superadmin: 'bg-violet-50 text-violet-700',
  };

  return (
    <>
      <ConfirmDialog
        open={pendingRoleChange !== null}
        title="Change user role?"
        confirmLabel="Update Role"
        confirmVariant="dark"
        loading={updateRoleMut.isPending}
        onConfirm={() => {
          if (!pendingRoleChange) return;
          updateRoleMut.mutate(
            { id: pendingRoleChange.id, userType: pendingRoleChange.newRole },
            { onSuccess: () => { toast.success('Role updated'); setPendingRoleChange(null); } },
          );
        }}
        onCancel={() => setPendingRoleChange(null)}
      >
        {pendingRoleChange && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">User</span>
              <span className="text-zinc-950 truncate max-w-[200px]">{pendingRoleChange.email}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-500">Role</span>
              <div className="flex items-center gap-2">
                <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide', ROLE_STYLES[pendingRoleChange.currentRole] ?? 'bg-zinc-100 text-zinc-600')}>
                  {pendingRoleChange.currentRole}
                </span>
                <ArrowRightIcon size={12} className="text-zinc-400" />
                <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide', ROLE_STYLES[pendingRoleChange.newRole] ?? 'bg-zinc-100 text-zinc-600')}>
                  {pendingRoleChange.newRole}
                </span>
              </div>
            </div>
          </div>
        )}
      </ConfirmDialog>
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage team roles and access"
      />
      {isLoading ? (
        <DataTable
          columns={columns}
          data={[]}
          isLoading
          loadingRows={4}
          emptyTitle="No users found"
          emptyDescription="Users appear here once they sign in."
        />
      ) : grouped.length === 0 ? (
        <p className="text-sm text-zinc-400">No users found.</p>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">
                {group.label}
                <span className="ml-2 font-normal normal-case tracking-normal text-zinc-300">
                  {group.users.length} {group.users.length === 1 ? 'user' : 'users'}
                </span>
              </p>
              <DataTable
                columns={columns}
                data={group.users}
                isLoading={false}
                emptyTitle="No users"
                emptyDescription=""
              />
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  );
}
