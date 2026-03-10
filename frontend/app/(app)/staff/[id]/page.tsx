'use client';

import { useRef, useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  FileTextIcon,
  TrashIcon,
  ArrowSquareOutIcon,
  UploadSimpleIcon,
  CameraIcon,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { cn, formatDatetime } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { createClient } from '@/lib/supabase/client';
import {
  useUserQuery,
  useUpdateUserProfileMutation,
  useStaffDocumentsQuery,
  useAddDocumentMutation,
  useDeleteDocumentMutation,
} from '@/hooks/useUsersQuery';
import { useCurrentUserQuery } from '@/hooks/useCurrentUserQuery';
import { ROUTES } from '@/lib/routes';
import type { AppUser } from '@/lib/types';

type Section = 'profile' | 'emergency' | 'documents';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'emergency', label: 'Emergency Contact' },
  { id: 'documents', label: 'Documents' },
];

const ROLE_STYLES: Record<string, string> = {
  staff: 'bg-zinc-100 text-zinc-600',
  admin: 'bg-blue-50 text-blue-600',
  superadmin: 'bg-violet-50 text-violet-700',
};

const BUCKET = 'staff-documents';

function initials(user: AppUser) {
  const name = user.fullName ?? user.nickname;
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return user.email.slice(0, 2).toUpperCase();
}

function displayName(user: AppUser) {
  return user.fullName ?? user.nickname ?? null;
}

export default function StaffProfilePage() {
  const params = useParams();
  const userId = params.id as string;

  const { data: currentUser } = useCurrentUserQuery();
  const isAdmin = currentUser?.userType === 'admin' || currentUser?.userType === 'superadmin';

  const { data: user, isLoading } = useUserQuery(userId);
  const { data: docs = [], isLoading: docsLoading } = useStaffDocumentsQuery(userId);

  const updateMut = useUpdateUserProfileMutation();
  const addDocMut = useAddDocumentMutation(userId);
  const deleteDocMut = useDeleteDocumentMutation(userId);

  const [section, setSection] = useState<Section>('profile');

  const [profileForm, setProfileForm] = useState({
    fullName: '',
    nickname: '',
    contactNumber: '',
    birthday: '',
    address: '',
  });

  const [emergencyForm, setEmergencyForm] = useState({
    emergencyContactName: '',
    emergencyContactNumber: '',
  });

  useEffect(() => {
    if (user) {
      setProfileForm({
        fullName: user.fullName ?? '',
        nickname: user.nickname ?? '',
        contactNumber: user.contactNumber ?? '',
        birthday: user.birthday ?? '',
        address: user.address ?? '',
      });
      setEmergencyForm({
        emergencyContactName: user.emergencyContactName ?? '',
        emergencyContactNumber: user.emergencyContactNumber ?? '',
      });
    }
  }, [user]);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [docLabel, setDocLabel] = useState('');

  async function handleDocUpload(file: File) {
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() ?? 'bin';
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
      if (error) throw new Error(error.message);
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      await addDocMut.mutateAsync({ url: urlData.publicUrl, label: docLabel.trim() || file.name });
      setDocLabel('');
      if (fileRef.current) fileRef.current.value = '';
      if (cameraRef.current) cameraRef.current.value = '';
      toast.success('Document uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Spinner size={24} className="text-zinc-300" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-zinc-400">Staff member not found.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Hidden file inputs */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleDocUpload(f); }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleDocUpload(f); }}
      />

      {/* Back link */}
      <div className="mb-6">
        <Link
          href={ROUTES.STAFF}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-950 transition-colors"
        >
          <ArrowLeftIcon size={14} />
          Staff
        </Link>
      </div>

      {/* Identity header */}
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-zinc-200">
        <div className="w-14 h-14 rounded-full bg-zinc-950 text-white flex items-center justify-center text-base font-bold shrink-0 select-none">
          {initials(user)}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-zinc-950 truncate">
            {displayName(user) ?? user.email}
          </h1>
          {displayName(user) && user.fullName && user.nickname && (
            <p className="text-sm text-zinc-400 truncate">{user.nickname}</p>
          )}
        </div>
        <span className={cn(
          'shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide',
          ROLE_STYLES[user.userType] ?? 'bg-zinc-100 text-zinc-600',
        )}>
          {user.userType}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Nav — horizontal tabs on mobile, vertical list on desktop */}
        <nav className="lg:w-44 shrink-0">
          {/* Mobile horizontal strip */}
          <div className="flex lg:hidden gap-1 overflow-x-auto pb-2 -mx-1 px-1">
            {SECTIONS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={cn(
                  'whitespace-nowrap px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 shrink-0',
                  section === id
                    ? 'bg-zinc-950 text-white'
                    : 'text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Desktop vertical list */}
          <div className="hidden lg:flex flex-col gap-0.5">
            {SECTIONS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={cn(
                  'text-left w-full px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150',
                  section === id
                    ? 'bg-zinc-950 text-white'
                    : 'text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>

        {/* Section content */}
        <div className="flex-1 min-w-0">

          {/* Profile */}
          {section === 'profile' && (
            <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
              <h2 className="text-sm font-semibold text-zinc-950 mb-1">Profile</h2>
              <Input
                label="Email"
                value={user.email}
                readOnly
                className="bg-zinc-50 text-zinc-500"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Full Name"
                  value={profileForm.fullName}
                  onChange={(e) => setProfileForm((f) => ({ ...f, fullName: e.target.value }))}
                  placeholder="Juan dela Cruz"
                  readOnly={!isAdmin}
                />
                <Input
                  label="Nickname"
                  value={profileForm.nickname}
                  onChange={(e) => setProfileForm((f) => ({ ...f, nickname: e.target.value }))}
                  placeholder="Juan"
                  readOnly={!isAdmin}
                />
                <Input
                  label="Contact Number"
                  value={profileForm.contactNumber}
                  onChange={(e) => setProfileForm((f) => ({ ...f, contactNumber: e.target.value }))}
                  placeholder="09XX XXX XXXX"
                  readOnly={!isAdmin}
                />
                <Input
                  label="Birthday"
                  type="date"
                  value={profileForm.birthday}
                  onChange={(e) => setProfileForm((f) => ({ ...f, birthday: e.target.value }))}
                  readOnly={!isAdmin}
                />
              </div>
              <Input
                label="Address"
                value={profileForm.address}
                onChange={(e) => setProfileForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Street, Barangay, City"
                readOnly={!isAdmin}
              />
              {isAdmin && (
                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    disabled={updateMut.isPending}
                    onClick={() => updateMut.mutate({
                      id: userId,
                      data: {
                        fullName: profileForm.fullName || undefined,
                        nickname: profileForm.nickname || undefined,
                        contactNumber: profileForm.contactNumber || undefined,
                        birthday: profileForm.birthday || undefined,
                        address: profileForm.address || undefined,
                      },
                    })}
                  >
                    {updateMut.isPending ? <Spinner size={14} /> : 'Save'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Emergency Contact */}
          {section === 'emergency' && (
            <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
              <h2 className="text-sm font-semibold text-zinc-950 mb-1">Emergency Contact</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Name"
                  value={emergencyForm.emergencyContactName}
                  onChange={(e) => setEmergencyForm((f) => ({ ...f, emergencyContactName: e.target.value }))}
                  placeholder="Full name"
                  readOnly={!isAdmin}
                />
                <Input
                  label="Number"
                  value={emergencyForm.emergencyContactNumber}
                  onChange={(e) => setEmergencyForm((f) => ({ ...f, emergencyContactNumber: e.target.value }))}
                  placeholder="09XX XXX XXXX"
                  readOnly={!isAdmin}
                />
              </div>
              {isAdmin && (
                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    disabled={updateMut.isPending}
                    onClick={() => updateMut.mutate({
                      id: userId,
                      data: {
                        emergencyContactName: emergencyForm.emergencyContactName || undefined,
                        emergencyContactNumber: emergencyForm.emergencyContactNumber || undefined,
                      },
                    })}
                  >
                    {updateMut.isPending ? <Spinner size={14} /> : 'Save'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Documents */}
          {section === 'documents' && (
            <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-950">Documents</h2>
                {isAdmin && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => cameraRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors disabled:opacity-50"
                    >
                      <CameraIcon size={13} />
                      Camera
                    </button>
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white bg-zinc-950 hover:bg-zinc-800 rounded-md transition-colors disabled:opacity-50"
                    >
                      {uploading ? <Spinner size={12} /> : <UploadSimpleIcon size={13} />}
                      Add Document
                    </button>
                  </div>
                )}
              </div>

              {isAdmin && (
                <Input
                  placeholder="Document label (optional)"
                  value={docLabel}
                  onChange={(e) => setDocLabel(e.target.value)}
                />
              )}

              {docsLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner size={20} className="text-zinc-300" />
                </div>
              ) : docs.length === 0 ? (
                <p className="text-sm text-zinc-400 py-6 text-center">No documents uploaded yet.</p>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {docs.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 py-3">
                      <FileTextIcon size={16} className="text-zinc-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-950 truncate">{doc.label ?? 'Untitled'}</p>
                        <p className="text-xs text-zinc-400">{formatDatetime(doc.uploadedAt)}</p>
                      </div>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded transition-colors"
                      >
                        <ArrowSquareOutIcon size={15} />
                      </a>
                      {isAdmin && (
                        <button
                          onClick={() => deleteDocMut.mutate(doc.id)}
                          disabled={deleteDocMut.isPending}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <TrashIcon size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
