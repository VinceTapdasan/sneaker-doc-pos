'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ReceiptIcon,
  WrenchIcon,
  TagIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  ClockIcon,
  SignOutIcon,
  ListIcon,
  XIcon,
  UserIcon,
} from '@phosphor-icons/react';
import { createBrowserClient } from '@supabase/ssr';
import { cn } from '@/lib/utils';
import { useCurrentUserQuery } from '@/hooks/useCurrentUserQuery';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: ChartBarIcon, adminOnly: false },
  { href: '/transactions', label: 'Transactions', icon: ReceiptIcon, adminOnly: false },
  { href: '/services', label: 'Services', icon: WrenchIcon, adminOnly: true },
  { href: '/promos', label: 'Promos', icon: TagIcon, adminOnly: true },
  { href: '/expenses', label: 'Expenses', icon: CurrencyDollarIcon, adminOnly: true },
  { href: '/audit', label: 'Audit Log', icon: ClockIcon, adminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: currentUser } = useCurrentUserQuery();
  const isAdmin = currentUser?.userType === 'admin' || currentUser?.userType === 'superadmin';
  const visibleNav = NAV.filter((item) => !item.adminOnly || isAdmin);

  async function handleSignOut() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    await supabase.auth.signOut();
    router.push('/login');
  }

  const navLinks = (
    <nav className="flex-1 px-3 py-4 space-y-0.5">
      {visibleNav.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        const itemClass = cn(
          'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors duration-150',
          active ? 'bg-zinc-950 text-white' : 'text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100',
        );
        if (active) {
          return (
            <span key={href} className={itemClass}>
              <Icon size={16} weight="fill" />
              {label}
            </span>
          );
        }
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={itemClass}
          >
            <Icon size={16} weight="regular" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="px-3 py-4 border-t border-zinc-200 space-y-1">
      {currentUser && (
        <div className="flex items-center gap-2 px-2.5 mb-3">
          <UserIcon size={12} className="text-zinc-400 shrink-0" />
          <span className="text-xs text-zinc-500 truncate flex-1">{currentUser.email}</span>
          <span
            className={cn(
              'shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide',
              currentUser.userType === 'staff'
                ? 'bg-zinc-100 text-zinc-600'
                : 'bg-blue-50 text-blue-600',
            )}
          >
            {currentUser.userType}
          </span>
        </div>
      )}
      <p className="px-2.5 text-xs text-zinc-400 mb-2">Philippine Peso (₱)</p>
      <button
        onClick={handleSignOut}
        className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 transition-colors duration-150"
      >
        <SignOutIcon size={16} />
        Sign out
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-20 h-14 bg-white border-b border-zinc-200 flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 rounded-md transition-colors"
        >
          <ListIcon size={20} />
        </button>
        <Image
          src="/sneaker-doc-logo.png"
          alt="SneakerDoc"
          width={32}
          height={32}
          className="object-contain"
        />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          'md:hidden fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-zinc-200 flex flex-col transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
          <Image
            src="/sneaker-doc-logo.png"
            alt="SneakerDoc"
            width={48}
            height={48}
            className="object-contain"
          />
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 rounded-md transition-colors"
          >
            <XIcon size={16} />
          </button>
        </div>
        {navLinks}
        {footer}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-56 bg-white border-r border-zinc-200 flex-col z-10">
        <div className="px-5 py-5 border-b border-zinc-200 flex justify-center">
          <Image
            src="/sneaker-doc-logo.png"
            alt="SneakerDoc"
            width={96}
            height={96}
            className="object-contain"
          />
        </div>
        {navLinks}
        {footer}
      </aside>
    </>
  );
}
