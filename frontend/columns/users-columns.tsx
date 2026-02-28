'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { formatDatetime, cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import type { AppUser } from '@/lib/types';

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
  currentUserId?: string;
}

export const createUserColumns = ({ onRoleChange, currentUserId }: UserColumnsOptions): ColumnDef<AppUser>[] => [
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-950">{row.original.email}</span>
      </div>
    ),
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
    accessorKey: 'createdAt',
    header: 'Joined',
    size: 200,
    cell: ({ row }) => (
      <span className="text-xs text-zinc-400">{formatDatetime(row.original.createdAt)}</span>
    ),
  },
];
