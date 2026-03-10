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
import { toTitleCase } from '@/utils/text';
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

type Section = 'profile' | 'documents';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'profile', label: 'Profile' },
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
  const isSelf = currentUser?.id === userId;
  const canUpload = isAdmin || isSelf;

  const { data: user, isLoading } = useUserQuery(userId);
  const { data: docs = [], isLoading: docsLoading } = useStaffDocumentsQuery(userId);

  const updateMut = useUpdateUserProfileMutation();
  const addDocMut = useAddDocumentMutation(userId);
  const deleteDocMut = useDeleteDocumentMutation(userId);

  const [section, setSection] = useState<Section>('profile');

  const [form, setForm] = useState({
    fullName: '',
    nickname: '',
    contactNumber: '',
    birthday: '',
    address: '',
    emergencyContactName: '',
    emergencyContactNumber: '',
  });

  const [touched, setTouched] = useState<Partial<Record<keyof typeof form, boolean>>>({});

  const PHONE_RE = /^(09|\+639)\d{9}$/;

  function isValidDate(val: string) {
    if (!val) return true;
    const d = new Date(val);
    if (isNaN(d.getTime())) return false;
    const year = d.getFullYear();
    return year >= 1900 && year <= new Date().getFullYear();
  }

  const errors = {
    contactNumber:
      touched.contactNumber && form.contactNumber && !PHONE_RE.test(form.contactNumber)
        ? 'Enter a valid PH mobile number (e.g. 09XX XXX XXXX)'
        : undefined,
    birthday:
      touched.birthday && !isValidDate(form.birthday)
        ? 'Enter a valid date'
        : undefined,
  };

  const hasErrors = Object.values(errors).some(Boolean);

  function touch(field: keyof typeof form) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  useEffect(() => {
    if (user) {
      setForm({
        fullName: user.fullName ?? '',
        nickname: user.nickname ?? '',
        contactNumber: user.contactNumber ?? '',
        birthday: user.birthday ?? '',
        address: user.address ?? '',
        emergencyContactName: user.emergencyContactName ?? '',
        emergencyContactNumber: user.emergencyContactNumber ?? '',
      });
    }
  }, [user]);

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSave() {
    setTouched({ contactNumber: true, birthday: true });
    if (hasErrors) return;
    updateMut.mutate({
      id: userId,
      data: {
        fullName: form.fullName || undefined,
        nickname: form.nickname || undefined,
        contactNumber: form.contactNumber || undefined,
        birthday: form.birthday || undefined,
        address: form.address || undefined,
        emergencyContactName: form.emergencyContactName || undefined,
        emergencyContactNumber: form.emergencyContactNumber || undefined,
      },
    });
  }

  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [uploading, setUploading] = useState(false);
  const [docLabel, setDocLabel] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<{ url: string; file: File } | null>(null);

  async function openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      setCapturedImage(null);
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 50);
    } catch {
      toast.error('Camera not available');
    }
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
    setCapturedImage(null);
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
      // stop stream and show preview
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCapturedImage({ url: URL.createObjectURL(blob), file });
    }, 'image/jpeg', 0.9);
  }

  function retakePhoto() {
    if (capturedImage) URL.revokeObjectURL(capturedImage.url);
    setCapturedImage(null);
    // restart stream
    void openCamera();
  }

  function confirmPhoto() {
    if (!capturedImage) return;
    const file = capturedImage.file;
    URL.revokeObjectURL(capturedImage.url);
    setCapturedImage(null);
    setCameraOpen(false);
    void handleDocUpload(file);
  }

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
      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleDocUpload(f); }}
      />

      {/* Camera modal — fullscreen on mobile */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black sm:items-center sm:justify-center sm:bg-black/80">
          <div className="flex flex-col flex-1 sm:flex-none sm:rounded-xl sm:overflow-hidden sm:shadow-xl sm:w-full sm:max-w-md bg-black">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-black/60 sm:bg-zinc-900">
              <span className="text-sm font-semibold text-white">
                {capturedImage ? 'Preview' : 'Take Photo'}
              </span>
              <button onClick={closeCamera} className="text-xs text-zinc-400 hover:text-white transition-colors">Cancel</button>
            </div>

            {/* Video / Preview */}
            <div className="flex-1 sm:flex-none relative">
              {capturedImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={capturedImage.url} alt="Preview" className="w-full sm:max-h-96 object-contain bg-black" />
              ) : (
                <video ref={videoRef} className="w-full sm:max-h-96 object-cover bg-black" playsInline muted />
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-center p-4 bg-black/60 sm:bg-zinc-900">
              {capturedImage ? (
                <>
                  <button
                    onClick={retakePhoto}
                    className="flex-1 sm:flex-none px-5 py-2.5 text-sm font-medium text-zinc-300 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors"
                  >
                    Retake
                  </button>
                  <button
                    onClick={confirmPhoto}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                  >
                    Use Photo
                  </button>
                </>
              ) : (
                <button
                  onClick={capturePhoto}
                  className="w-16 h-16 flex items-center justify-center rounded-full border-4 border-white bg-white/20 hover:bg-white/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-white" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
            {user.fullName ? (
              <>
                {toTitleCase(user.fullName)}
                {user.nickname && (
                  <span className="font-normal text-zinc-400"> ({toTitleCase(user.nickname)})</span>
                )}
              </>
            ) : user.nickname ? (
              toTitleCase(user.nickname)
            ) : (
              user.email
            )}
          </h1>
          {(() => {
            const meta = [
              user.email,
              user.contactNumber ?? null,
              user.address ? toTitleCase(user.address) : null,
            ].filter(Boolean).join(' | ');
            return meta ? (
              <p className="text-sm text-zinc-400 truncate mt-0.5">{meta}</p>
            ) : null;
          })()}
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
          <div className="flex lg:hidden gap-1 overflow-x-auto pb-2 -mx-1 px-1">
            {SECTIONS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={cn(
                  'whitespace-nowrap px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 shrink-0',
                  section === id ? 'bg-zinc-950 text-white' : 'text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="hidden lg:flex flex-col gap-0.5">
            {SECTIONS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={cn(
                  'text-left w-full px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150',
                  section === id ? 'bg-zinc-950 text-white' : 'text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>

        {/* Section content */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Profile + Emergency Contact + Save */}
          {section === 'profile' && (
            <>
              {/* Profile card */}
              <div className="bg-white border border-zinc-200 rounded-lg p-5 sm:p-6 space-y-4">
                <h2 className="text-sm font-semibold text-zinc-950">Profile</h2>
                <Input
                  label="Email"
                  value={user.email}
                  readOnly
                  className="bg-zinc-50 text-zinc-500"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Full Name"
                    value={form.fullName}
                    onChange={(e) => set('fullName', e.target.value)}
                    placeholder="Juan dela Cruz"
                    readOnly={!isAdmin}
                  />
                  <Input
                    label="Nickname"
                    value={form.nickname}
                    onChange={(e) => set('nickname', e.target.value)}
                    placeholder="Juan"
                    readOnly={!isAdmin}
                  />
                  <Input
                    label="Contact Number"
                    value={form.contactNumber}
                    onChange={(e) => set('contactNumber', e.target.value)}
                    onBlur={() => touch('contactNumber')}
                    placeholder="09XX XXX XXXX"
                    readOnly={!isAdmin}
                    error={errors.contactNumber}
                  />
                  <Input
                    label="Birthday"
                    type="date"
                    value={form.birthday}
                    onChange={(e) => set('birthday', e.target.value)}
                    onBlur={() => touch('birthday')}
                    readOnly={!isAdmin}
                    error={errors.birthday}
                  />
                </div>
                <Input
                  label="Address"
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  placeholder="Street, Barangay, City"
                  readOnly={!isAdmin}
                />
              </div>

              {/* Emergency Contact card */}
              <div className="bg-white border border-zinc-200 rounded-lg p-5 sm:p-6 space-y-4">
                <h2 className="text-sm font-semibold text-zinc-950">Emergency Contact</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Name"
                    value={form.emergencyContactName}
                    onChange={(e) => set('emergencyContactName', e.target.value)}
                    placeholder="Full name"
                    readOnly={!isAdmin}
                  />
                  <Input
                    label="Number"
                    value={form.emergencyContactNumber}
                    onChange={(e) => set('emergencyContactNumber', e.target.value)}
                    placeholder="09XX XXX XXXX"
                    readOnly={!isAdmin}
                  />
                </div>
              </div>

              {/* Single save button for all profile changes */}
              {isAdmin && (
                <div className="flex justify-end">
                  <Button size="sm" disabled={updateMut.isPending} onClick={handleSave}>
                    {updateMut.isPending ? <Spinner size={14} /> : 'Save Changes'}
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Documents */}
          {section === 'documents' && (
            <div className="bg-white border border-zinc-200 rounded-lg p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-950">Documents</h2>
                {canUpload && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => void openCamera()}
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

              {canUpload && (
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
                      {canUpload && (
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
