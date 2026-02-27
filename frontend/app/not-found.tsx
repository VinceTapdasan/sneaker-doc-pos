import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50">
      <p className="font-mono text-6xl font-semibold text-zinc-950 mb-2">404</p>
      <p className="text-sm text-zinc-500 mb-6">This page doesn&apos;t exist.</p>
      <Link
        href="/transactions"
        className="px-4 py-2 text-sm font-medium bg-zinc-950 text-white rounded-md hover:bg-zinc-800 transition-colors duration-150"
      >
        Go home
      </Link>
    </div>
  );
}
