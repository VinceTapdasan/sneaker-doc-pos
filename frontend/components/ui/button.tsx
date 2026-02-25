import { cn } from '@/lib/utils';
import { type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';
  size?: 'sm' | 'md';
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-1.5 font-medium transition-all duration-150 rounded-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]',
        size === 'sm' && 'px-3 py-1.5 text-xs',
        size === 'md' && 'px-4 py-2 text-sm',
        variant === 'primary' && 'bg-zinc-950 text-white hover:bg-zinc-800',
        variant === 'secondary' && 'bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50',
        variant === 'ghost' && 'text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100',
        variant === 'danger' && 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200',
        variant === 'dark' && 'bg-zinc-800 text-white hover:bg-zinc-700',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
