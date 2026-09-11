import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdminSession } from '@/lib/auth/guards';

/**
 * An optimistic gate only. Next's docs are explicit that proxy "should not be
 * used as a full session management or authorization solution", and Server
 * Functions are POSTs to the route that imported them, so a matcher change can
 * silently drop coverage. The enforcing check lives in requireAdminActor().
 */
export const proxy = auth((request) => {
  if (isAdminSession(request.auth)) return NextResponse.next();

  const target = new URL('/login', request.nextUrl.origin);
  target.searchParams.set('from', request.nextUrl.pathname);
  return NextResponse.redirect(target);
});

export const config = {
  matcher: ['/admin/:path*'],
};
