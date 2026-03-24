'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { RAW_MAX_SIZE_MB, isValidImageType, compressWithFallback } from '@/utils/photo';
import { transactionDetailKey } from './useTransactionsQuery';

export async function putToStorage(signedUrl: string, body: File, attempt = 1): Promise<void> {
  const res = await fetch(signedUrl, {
    method: 'PUT',
    body,
    headers: { 'Content-Type': 'image/jpeg' },
  });

  if (res.ok) return;

  // One automatic retry on network glitch (common on mobile connections)
  if (attempt < 2) {
    await new Promise((r) => setTimeout(r, 1500));
    return putToStorage(signedUrl, body, attempt + 1);
  }

  throw new Error(`Storage upload failed (${res.status}). Check your connection and try again.`);
}

// Transaction-level photo dump — before/after photos not tied to any specific item
export function useUploadTxnPhotoMutation(txnId: string) {
  const numericTxnId = parseInt(txnId, 10);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      type,
      file,
    }: {
      type: 'before' | 'after';
      file: File;
    }) => {
      if (file.size === 0) throw new Error('File is empty. Try taking the photo again.');
      if (!isValidImageType(file)) throw new Error('Only image files are allowed (JPEG, PNG, WebP, HEIC).');
      if (file.size > RAW_MAX_SIZE_MB * 1024 * 1024) throw new Error(`File must be under ${RAW_MAX_SIZE_MB}MB.`);

      const { blob, sizeKB, compressed } = await compressWithFallback(file);

      const { signedUrl, publicUrl } = await api.uploads.presignedUrl({
        txnId: numericTxnId,
        type,
        extension: 'jpg',
      });

      await putToStorage(signedUrl, blob);

      try {
        await api.transactions.savePhoto(numericTxnId, { type, url: publicUrl });
      } catch {
        throw new Error('Photo uploaded but failed to save. Please upload again to link it.');
      }

      return { sizeKB, compressed };
    },
    onSuccess: ({ sizeKB, compressed }) => {
      void qc.invalidateQueries({ queryKey: transactionDetailKey(txnId) });
      toast.success('Photo saved', {
        description: compressed ? `Compressed to ${sizeKB}KB` : `${sizeKB}KB`,
      });
    },
    onError: (err: Error) => toast.error('Upload failed', { description: err.message }),
  });
}

export function useUploadPhotoMutation(txnId: string) {
  const numericTxnId = parseInt(txnId, 10);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      type,
      file,
    }: {
      itemId: number;
      type: 'before' | 'after';
      file: File;
    }) => {
      // --- Validation ---
      if (file.size === 0) {
        throw new Error('File is empty. Try taking the photo again.');
      }
      if (!isValidImageType(file)) {
        throw new Error('Only image files are allowed (JPEG, PNG, WebP, HEIC).');
      }
      if (file.size > RAW_MAX_SIZE_MB * 1024 * 1024) {
        throw new Error(`File must be under ${RAW_MAX_SIZE_MB}MB.`);
      }

      // --- Step 1: Compress (with fallback to original if compression fails) ---
      const { blob, sizeKB, compressed } = await compressWithFallback(file);

      // --- Step 2: Get presigned upload URL ---
      const { signedUrl, publicUrl } = await api.uploads.presignedUrl({
        txnId: numericTxnId,
        itemId,
        type,
        extension: 'jpg',
      });

      // --- Step 3: Upload to Supabase Storage (1 auto-retry on failure) ---
      await putToStorage(signedUrl, blob);

      // --- Step 4: Save public URL to DB ---
      // If this fails after a successful upload, the file exists in storage
      // but won't be linked in the DB. Surface a distinct error so staff know
      // to try "uploading again" (which will overwrite with a new path).
      try {
        const patch =
          type === 'before'
            ? { beforeImageUrl: publicUrl }
            : { afterImageUrl: publicUrl };
        await api.transactions.updateItem(numericTxnId, itemId, patch);
      } catch {
        throw new Error('Photo uploaded but failed to save. Please upload again to link it.');
      }

      return { sizeKB, compressed };
    },
    onSuccess: ({ sizeKB, compressed }) => {
      void qc.invalidateQueries({ queryKey: transactionDetailKey(txnId) });
      toast.success('Photo saved', {
        description: compressed ? `Compressed to ${sizeKB}KB` : `${sizeKB}KB`,
      });
    },
    onError: (err: Error) => toast.error('Upload failed', { description: err.message }),
  });
}
