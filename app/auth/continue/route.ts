import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { landingFor, mergeCartForCurrentUser } from '@/lib/auth/after-sign-in';

/**
 * Where Google hands the browser back once the session cookie is set. The
 * password forms do this work inside their own action; a redirect-based
 * sign-in needs a request of its own to do it in.
 */
export async function GET(request: NextRequest) {
  const role = await mergeCartForCurrentUser();
  revalidatePath('/', 'layout');

  const target = role ? landingFor(role) : '/login';
  return NextResponse.redirect(new URL(target, request.nextUrl.origin));
}
