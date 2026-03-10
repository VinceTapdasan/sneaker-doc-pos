export const ROUTES = {
  ROOT: '/',
  LOGIN: '/login',
  DASHBOARD: '/',
  TRANSACTIONS: '/transactions',
  UPCOMING_PICKUPS: '/upcoming-pickups',
  SERVICES: '/services',
  PROMOS: '/promos',
  EXPENSES: '/expenses',
  AUDIT: '/audit',
  BRANCHES: '/branches',
  STAFF: '/staff',
  CUSTOMERS: '/customers',
  REPORTS: '/reports',
  ONBOARDING: '/onboarding',
} as const;

// '/' (dashboard) is protected directly in proxy.ts — not here, since startsWith('/') matches everything
export const PROTECTED_ROUTES: string[] = [
  ROUTES.TRANSACTIONS,
  ROUTES.UPCOMING_PICKUPS,
  ROUTES.SERVICES,
  ROUTES.PROMOS,
  ROUTES.EXPENSES,
  ROUTES.AUDIT,
  ROUTES.BRANCHES,
  ROUTES.STAFF,
  ROUTES.CUSTOMERS,
  ROUTES.REPORTS,
  ROUTES.ONBOARDING,
];

export const AUTH_ROUTES: string[] = [ROUTES.LOGIN];
