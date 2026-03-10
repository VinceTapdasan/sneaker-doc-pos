'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { AppUser } from '@/lib/types';

const USERS_KEY = ['users'];
const ASSIGNABLE_KEY = ['users', 'assignable'];
const docsKey = (id: string) => ['users', id, 'documents'];

export function useUsersQuery() {
  return useQuery({
    queryKey: USERS_KEY,
    queryFn: () => api.users.list(),
  });
}

export function useUserQuery(id: string) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => api.users.get(id),
    enabled: !!id,
  });
}

export function useAssignableUsersQuery() {
  return useQuery({
    queryKey: ASSIGNABLE_KEY,
    queryFn: () => api.users.listAssignable(),
    staleTime: 5 * 60 * 1000, // 5 min — user list rarely changes
  });
}

export function useUpdateUserRoleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userType }: { id: string; userType: string }) =>
      api.users.updateRole(id, userType),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: USERS_KEY });
    },
    onError: (err: Error) => toast.error('Failed to update role', { description: err.message }),
  });
}

export function useUpdateUserBranchMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, branchId }: { id: string; branchId: number }) =>
      api.users.updateBranch(id, branchId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: USERS_KEY });
    },
    onError: (err: Error) => toast.error('Failed to update branch', { description: err.message }),
  });
}

export function useDeleteUserMutation(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.users.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: USERS_KEY });
      toast.success('User removed');
      onSuccess?.();
    },
    onError: (err: Error) => toast.error('Failed to remove user', { description: err.message }),
  });
}

export function useUpdateUserProfileMutation(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AppUser> }) =>
      api.users.updateProfile(id, data),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: USERS_KEY });
      void qc.invalidateQueries({ queryKey: ['users', id] });
      toast.success('Profile updated');
      onSuccess?.();
    },
    onError: (err: Error) => toast.error('Failed to update profile', { description: err.message }),
  });
}

export function useStaffDocumentsQuery(userId: string) {
  return useQuery({
    queryKey: docsKey(userId),
    queryFn: () => api.users.getDocuments(userId),
    enabled: !!userId,
  });
}

export function useAddDocumentMutation(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { url: string; label?: string }) =>
      api.users.addDocument(userId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: docsKey(userId) });
    },
    onError: (err: Error) => toast.error('Failed to save document', { description: err.message }),
  });
}

export function useDeleteDocumentMutation(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docId: number) => api.users.deleteDocument(userId, docId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: docsKey(userId) });
      toast.success('Document removed');
    },
    onError: (err: Error) => toast.error('Failed to remove document', { description: err.message }),
  });
}
