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
  GitBranchIcon,
  UsersIcon,
  AddressBookIcon,
} from '@phosphor-icons/react';
import { createBrowserClient } from '@supabase/ssr';
import { cn } from '@/lib/utils';
import { useCurrentUserQuery } from '@/hooks/useCurrentUserQuery';
import { ROUTES } from '@/lib/routes';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; weight?: 'fill' | 'regular' | 'bold'; className?: string }>;
  adminOnly: boolean;
  superadminOnly: boolean;
}

interface NavGroup {
  label?: string;
  adminOnly?: boolean;
  superadminOnly?: boolean;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: ROUTES.DASHBOARD, label: 'Dashboard', icon: ChartBarIcon, adminOnly: false, superadminOnly: false },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: ROUTES.TRANSACTIONS, label: 'Transactions', icon: ReceiptIcon, adminOnly: false, superadminOnly: false },
      { href: ROUTES.CUSTOMERS, label: 'Customers', icon: AddressBookIcon, adminOnly: true, superadminOnly: false },
    ],
  },
  {
    label: 'Catalog',
    adminOnly: true,
    items: [
      { href: ROUTES.SERVICES, label: 'Services', icon: WrenchIcon, adminOnly: true, superadminOnly: false },
      { href: ROUTES.PROMOS, label: 'Promos', icon: TagIcon, adminOnly: true, superadminOnly: false },
    ],
  },
  {
    label: 'Finance',
    adminOnly: true,
    items: [
      { href: ROUTES.EXPENSES, label: 'Expenses', icon: CurrencyDollarIcon, adminOnly: true, superadminOnly: false },
    ],
  },
  {
    label: 'Admin',
    adminOnly: true,
    items: [
      { href: ROUTES.AUDIT, label: 'Audit Log', icon: ClockIcon, adminOnly: true, superadminOnly: false },
      { href: ROUTES.USERS, label: 'Users', icon: UsersIcon, adminOnly: true, superadminOnly: false },
      { href: ROUTES.BRANCHES, label: 'Branches', icon: GitBranchIcon, adminOnly: false, superadminOnly: true },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { data: currentUser } = useCurrentUserQuery();
  const isAdmin = currentUser?.userType === 'admin' || currentUser?.userType === 'superadmin';
  const isSuperadmin = currentUser?.userType === 'superadmin';

  function filterItem(item: NavItem) {
    if (item.superadminOnly) return isSuperadmin;
    if (item.adminOnly) return isAdmin;
    return true;
  }

  function filterGroup(group: NavGroup) {
    if (group.superadminOnly) return isSuperadmin;
    if (group.adminOnly) return isAdmin;
    return true;
  }

  async function handleSignOut() {
    setShowSignOutDialog(false);
    setSigningOut(true);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    await supabase.auth.signOut();
    router.push(ROUTES.LOGIN);
  }

  const navLinks = (
    <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
      {NAV_GROUPS.filter(filterGroup).map((group, gi) => {
        const visibleItems = group.items.filter(filterItem);
        if (visibleItems.length === 0) return null;
        return (
          <div key={gi}>
            {group.label && (
              <p className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {visibleItems.map(({ href, label, icon: Icon }) => {
                const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
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
            </div>
          </div>
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
        onClick={() => setShowSignOutDialog(true)}
        className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 transition-colors duration-150"
      >
        <SignOutIcon size={16} />
        Sign out
      </button>
    </div>
  );

  return (
    <>
      {/* Sign-out confirmation dialog */}
      <Dialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
        <DialogContent showCloseButton={false} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sign out?</DialogTitle>
            <DialogDescription>You will be returned to the login screen.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSignOutDialog(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleSignOut}>
              Sign out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signing-out overlay */}
      {signingOut && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-sm bg-white/60">
          <div className="flex flex-col items-center gap-3">
            <Spinner size={24} className="text-zinc-500" />
            <span className="text-sm text-zinc-500 font-medium">Signing out...</span>
          </div>
        </div>
      )}

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-20 h-14 bg-white border-b border-zinc-200 flex items-center px-4 gap-3">
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
          className="lg:hidden fixed inset-0 z-30 bg-black/40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-zinc-200 flex flex-col transition-transform duration-200',
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
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-56 bg-white border-r border-zinc-200 flex-col z-10">
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
