import { auth } from '@/auth';
import { mergeGuestCartIntoUserCart } from '@/lib/services/cart';
import { persistCartId, readCartId } from '@/lib/cart-session';

/**
 * Where a sign-in lands.
 *
 * An admin signs in to work, so the panel is the destination rather than a
 * customer account page they have no use for. `/account` is still there, and
 * the rail's "View store" link is how they leave.
 */
export function landingFor(role: string | undefined): string {
  return role === 'admin' ? '/admin' : '/account';
}

/**
 * After a successful sign-in, fold any guest cart into the account cart so a
 * shopper who filled a basket before logging in does not lose it.
 *
 * Writes a cookie, so only for a Server Action or Route Handler.
 */
export async function mergeCartForCurrentUser(): Promise<string | undefined> {
  const session = await auth();
  const userId = session?.user?.id;
  const guestCartId = await readCartId();

  // Returned rather than fetched again by the caller: the session was already
  // read here, and it is the only authority on what the browser now holds.
  const role = session?.user?.role;

  if (!userId || !guestCartId) return role;

  try {
    const mergedId = await mergeGuestCartIntoUserCart(guestCartId, userId);
    await persistCartId(mergedId);
  } catch {
    // A missing or already-merged cart must never block signing in.
  }

  return role;
}
