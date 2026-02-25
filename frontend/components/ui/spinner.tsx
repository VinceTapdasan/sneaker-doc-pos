import { CircleNotchIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface SpinnerProps {
  size?: number;
  className?: string;
}

export function Spinner({ size = 14, className }: SpinnerProps) {
  return <CircleNotchIcon size={size} className={cn('animate-spin', className)} />;
}
