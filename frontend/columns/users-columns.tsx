'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { TrashIcon, PencilSimpleIcon, FolderOpenIcon } from '@phosphor-icons/react';
import { formatDatetime, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { toTitleCase } from '@/utils/text';
import type { AppUser, Branch } from '@/lib/types';

const ROLES = ['staff', 'admin', 'superadmin'] as const;

const ROLE_STYLES: Record<string, string> = {
  staff: 'bg-zinc-100 text-zinc-600',
  admin: 'bg-blue-50 text-blue-600',
  superadmin: 'bg-violet-50 text-violet-700',
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide',
      ROLE_STYLES[role] ?? 'bg-zinc-100 text-zinc-600',
    )}>
      {role}
    </span>
  );
}

interface UserColumnsOptions {
  onRoleChange: (id: string, newUserType: string, currentUserType: string, email: string) => void;
  onBranchChange?: (id: string, newBranchId: number, currentBranchId: number | null, email: string, newBranchName: string, currentBranchName: string | null) => void;
  onDelete?: (user: AppUser) => void;
  onEdit?: (user: AppUser) => void;
  onDocuments?: (user: AppUser) => void;
  currentUserId?: string;
  isSuperadmin?: boolean;
  branches?: Branch[];
}

export const createUserColumns = ({
  onRoleChange,
  onBranchChange,
  onDelete,
  onEdit,
  onDocuments,
  currentUserId,
  isSuperadmin,
  branches = [],
}: UserColumnsOptions): ColumnDef<AppUser>[] => [
  {
    accessorKey: 'email',
    header: 'Staff',
    cell: ({ row }) => {
      const u = row.original;
      const name = u.fullName ?? u.nickname ?? null;
      const primary = name ? toTitleCase(name) : u.email;
      return <span className="text-sm text-zinc-950">{primary}</span>;
    },
  },
  {
    accessorKey: 'userType',
    header: 'Role',
    size: 160,
    cell: ({ row }) => {
      const user = row.original;
      const isSelf = user.id === currentUserId;
      return (
        <div className="flex items-center">
          {isSelf ? (
            <RoleBadge role={user.userType} />
          ) : (
            <Select value={user.userType} onValueChange={(v) => onRoleChange(user.id, v, user.userType, user.email)}>
              <SelectTrigger className="h-auto border-0 bg-transparent shadow-none p-0 gap-1.5 focus-visible:ring-0 w-auto">
                <RoleBadge role={user.userType} />
              </SelectTrigger>
              <SelectContent position="popper">
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    <RoleBadge role={r} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      );
    },
  },
  {
    id: 'branch',
    header: 'Branch',
    size: 180,
    cell: ({ row }) => {
      const user = row.original;
      const isSelf = user.id === currentUserId;
      const currentBranch = branches.find((b) => b.id === user.branchId) ?? null;

      if (isSelf || !isSuperadmin || !onBranchChange) {
        return (
          <span className={cn('text-sm', currentBranch ? 'text-zinc-700' : 'text-zinc-400')}>
            {toTitleCase(currentBranch?.name) || 'No branch'}
          </span>
        );
      }

      return (
        <Select
          value={user.branchId !== null ? String(user.branchId) : ''}
          onValueChange={(v) => {
            const newBranchId = parseInt(v, 10);
            const newBranch = branches.find((b) => b.id === newBranchId);
            if (!newBranch) return;
            onBranchChange(user.id, newBranchId, user.branchId, user.email, newBranch.name, currentBranch?.name ?? null);
          }}
        >
          <SelectTrigger className="h-auto border-0 bg-transparent shadow-none p-0 gap-1.5 focus-visible:ring-0 w-auto text-sm text-zinc-700">
            <span className={cn('text-sm', currentBranch ? 'text-zinc-700' : 'text-zinc-400')}>
              {toTitleCase(currentBranch?.name) || 'No branch'}
            </span>
          </SelectTrigger>
          <SelectContent position="popper">
            {branches.map((b) => (
              <SelectItem key={b.id} value={String(b.id)}>
                {toTitleCase(b.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Joined',
    size: 200,
    cell: ({ row }) => (
      <span className="text-xs text-zinc-400">{formatDatetime(row.original.createdAt)}</span>
    ),
  },
  {
    id: 'actions',
    header: '',
    size: 200,
    cell: ({ row }) => {
      const user = row.original;
      const isSelf = user.id === currentUserId;
      return (
        <div className="flex items-center justify-end gap-2">
          {onEdit && (
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => { e.stopPropagation(); onEdit(user); }}
            >
              <PencilSimpleIcon size={13} />
              Edit
            </Button>
          )}
          {onDocuments && (
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => { e.stopPropagation(); onDocuments(user); }}
            >
              <FolderOpenIcon size={13} />
              Docs
            </Button>
          )}
          {!isSelf && isSuperadmin && onDelete && (
            <Button
              size="sm"
              variant="danger"
              onClick={(e) => { e.stopPropagation(); onDelete(user); }}
            >
              <TrashIcon size={13} />
            </Button>
          )}
        </div>
      );
    },
  },
];
