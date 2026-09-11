import { cookies } from 'next/headers';
import { getCartView } from '@/lib/services/cart';
import type { CartViewDTO } from '@/types/dto';

export const CART_COOKIE = 'shrinkless_cart';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 30,
} as const;

/**
 * A cart id is a Mongo ObjectId: twenty-four hex characters, nothing else.
 *
 * The cookie is the one input to the storefront that arrives without ever
 * having been through a form, so anything at all can be in it. Checking the
 * shape here means a browser carrying a value this store did not write is
 * simply a browser with no cart.
 */
const CART_ID = /^[0-9a-f]{24}$/i;

/** Read-only: safe to call from Server Components. */
export async function readCartId(): Promise<string | null> {
  const value = (await cookies()).get(CART_COOKIE)?.value;
  return value && CART_ID.test(value) ? value : null;
}

/** Read-only: safe to call from Server Components. */
export async function readCartView(): Promise<CartViewDTO | null> {
  const cartId = await readCartId();
  if (!cartId) return null;

  return getCartView(cartId);
}

/** Writes a cookie - only valid inside a Server Action or Route Handler. */
export async function persistCartId(cartId: string): Promise<void> {
  const store = await cookies();
  store.set(CART_COOKIE, cartId, COOKIE_OPTIONS);
}
