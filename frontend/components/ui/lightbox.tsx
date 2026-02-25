'use client';

import { useEffect } from 'react';
import { XIcon } from '@phosphor-icons/react';

interface LightboxProps {
  open: boolean;
  src: string;
  alt?: string;
  onClose: () => void;
}

export function Lightbox({ open, src, alt = 'Photo', onClose }: LightboxProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white/60 hover:text-white transition-colors duration-150"
      >
        <XIcon size={20} />
      </button>
      <div
        className="max-w-3xl max-h-[90vh] w-full mx-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-contain rounded-lg max-h-[90vh]"
        />
      </div>
    </div>
  );
}
