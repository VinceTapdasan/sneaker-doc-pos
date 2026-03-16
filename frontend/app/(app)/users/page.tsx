'use client';

import { useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LockSimpleIcon } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { createUserColumns } from '@/columns/users-columns';
import { useUsersQuery, useUpdateUserRoleMutation, useUpdateUserBranchMutation, useDeleteUserMutation, useApproveUserMutation, useRejectUserMutation } from '@/hooks/useUsersQuery';
import { useCurrentUserQuery } from '@/hooks/useCurrentUserQuery';
import { useBranchesQuery } from '@/hooks/useBranchesQuery';
import { toTitleCase } from '@/utils/text';
import { UserRoleConfirmDialog, type PendingRoleChange } from '@/components/users/UserRoleConfirmDialog';
import { UserBranchConfirmDialog, type PendingBranchChange } from '@/components/users/UserBranchConfirmDialog';
import { EditStaffDialog } from '@/components/users/EditStaffDialog';
import { StaffDocumentsDialog } from '@/components/users/StaffDocumentsDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { AppUser, Branch } from '@/lib/types';

type Tab = 'approved' | 'pending';

export default function UsersPageWrapper() {
  return (
    <Suspense>
      <UsersPage />
    </Suspense>
  );
}

function UsersPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'pending' ? 'pending' : 'approved';

  const { data: currentUser, isSuccess: userLoaded } = useCurrentUserQuery();
  const isAdmin = currentUser?.userType === 'admin' || currentUser?.userType === 'superadmin';

  const { data: users = [], isLoading } = useUsersQuery();
  const { data: branches = [] } = useBranchesQuery(false);
  const updateRoleMut = useUpdateUserRoleMutation();
  const updateBranchMut = useUpdateUserBranchMutation();
  const deleteMut = useDeleteUserMutation(() => setDeleteTarget(null));
  const approveMut = useApproveUserMutation(() => setApproveTarget(null));
  const rejectMut = useRejectUserMutation(() => setRejectTarget(null));

  const [tab, setTab] = useState<Tab>(initialTab);
  const [pendingRoleChange, setPendingRoleChange] = useState<PendingRoleChange | null>(null);
  const [pendingBranchChange, setPendingBranchChange] = useState<PendingBranchChange | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [approveTarget, setApproveTarget] = useState<AppUser | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AppUser | null>(null);
  const [editTarget, setEditTarget] = useState<AppUser | null>(null);
  const [docsTarget, setDocsTarget] = useState<AppUser | null>(null);

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
      onApprove: isSuperadmin ? setApproveTarget : undefined,
      onReject: isSuperadmin ? setRejectTarget : undefined,
      onEdit: setEditTarget,
      onDocuments: setDocsTarget,
      currentUserId: currentUser?.id,
      isSuperadmin,
      branches: branches as Branch[],
    }),
    [currentUser?.id, isSuperadmin, branches],
  );

  // Separate pending users from active ones
  const { pendingUsers, grouped } = useMemo(() => {
    const allUsers = (users as AppUser[]).filter((u) => u.id !== currentUser?.id);
    const pending = allUsers.filter((u) => u.status === 'pending');
    const active = allUsers.filter((u) => u.status !== 'pending');
    const branchMap = new Map(branches.map((b) => [b.id, b.name]));

    const groups = new Map<string, { label: string; users: AppUser[] }>();

    for (const user of active) {
      const key = user.branchId !== null ? String(user.branchId) : '__none__';
      if (!groups.has(key)) {
        const label = user.branchId !== null
          ? toTitleCase(branchMap.get(user.branchId) ?? `Branch #${user.branchId}`)
          : 'No Branch';
        groups.set(key, { label, users: [] });
      }
      groups.get(key)!.users.push(user);
    }

    const sorted = [...groups.entries()]
      .sort(([a], [b]) => {
        if (a === '__none__') return 1;
        if (b === '__none__') return -1;
        return (groups.get(a)!.label).localeCompare(groups.get(b)!.label);
      })
      .map(([, group]) => group);

    return { pendingUsers: pending, grouped: sorted };
  }, [users, branches, currentUser?.id]);

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

  return (
    <>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove user?"
        description={`Remove ${deleteTarget?.email}? They will no longer be able to access the system.`}
        confirmLabel="Remove"
        onConfirm={() => { if (deleteTarget) deleteMut.mutate(deleteTarget.id); }}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMut.isPending}
      />
      <ConfirmDialog
        open={!!approveTarget}
        title="Approve user?"
        description={`Approve ${approveTarget?.email}? They will be able to sign in and access the system.`}
        confirmLabel="Approve"
        onConfirm={() => { if (approveTarget) approveMut.mutate(approveTarget.id); }}
        onCancel={() => setApproveTarget(null)}
        loading={approveMut.isPending}
      />
      <ConfirmDialog
        open={!!rejectTarget}
        title="Reject user?"
        description={`Reject ${rejectTarget?.email}? They will not be able to access the system.`}
        confirmLabel="Reject"
        onConfirm={() => { if (rejectTarget) rejectMut.mutate(rejectTarget.id); }}
        onCancel={() => setRejectTarget(null)}
        loading={rejectMut.isPending}
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
      <EditStaffDialog user={editTarget} onClose={() => setEditTarget(null)} />
      <StaffDocumentsDialog user={docsTarget} onClose={() => setDocsTarget(null)} />
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
          title="Users"
          subtitle="Manage team roles and access"
        />

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-200 mb-6">
          <button
            onClick={() => setTab('approved')}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors relative',
              tab === 'approved'
                ? 'text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-600',
            )}
          >
            Approved
            {tab === 'approved' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-950 rounded-t" />
            )}
          </button>
          <button
            onClick={() => setTab('pending')}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors relative',
              tab === 'pending'
                ? 'text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-600',
            )}
          >
            <span className="flex items-center gap-1.5">
              Pending
              {pendingUsers.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500" />
              )}
            </span>
            {tab === 'pending' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-950 rounded-t" />
            )}
          </button>
        </div>

        {/* Approved tab */}
        {tab === 'approved' && (
          <>
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
              <p className="text-sm text-zinc-400">No approved users found.</p>
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
          </>
        )}

        {/* Pending tab */}
        {tab === 'pending' && (
          <>
            {isLoading ? (
              <DataTable
                columns={columns}
                data={[]}
                isLoading
                loadingRows={3}
                emptyTitle="No pending users"
                emptyDescription=""
              />
            ) : pendingUsers.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-sm text-zinc-400">No pending approval requests.</p>
                <p className="text-xs text-zinc-300 mt-1">New signups will appear here for review.</p>
              </div>
            ) : (
              <DataTable
                columns={columns}
                data={pendingUsers}
                isLoading={false}
                emptyTitle="No pending users"
                emptyDescription=""
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
