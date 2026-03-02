import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { ROUTES, PROTECTED_ROUTES, AUTH_ROUTES } from '@/lib/routes';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cs: { name: string; value: string; options?: Parameters<typeof response.cookies.set>[2] }[]) =>
          cs.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
      },
    },
  );

  const { data: { session } } = await supabase.auth.getSession();

  // Always use the public app URL for server-side redirects (avoids localhost leaking behind proxy)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;

  // Root "/" — dashboard, requires session
  if (pathname === ROUTES.ROOT) {
    if (!session) return NextResponse.redirect(`${appUrl}${ROUTES.LOGIN}`);
    return response;
  }

  if (!session && PROTECTED_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(`${appUrl}${ROUTES.LOGIN}`);
  }

  if (session && AUTH_ROUTES.includes(pathname)) {
    return NextResponse.redirect(`${appUrl}${ROUTES.ROOT}`);
  }

  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
