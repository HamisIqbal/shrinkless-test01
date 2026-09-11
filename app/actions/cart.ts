'use server';

import { revalidatePath } from 'next/cache';
import {
  QuantityRuleError,
  StockError,
  addItemToCart,
  createCart,
  getCartView,
  updateCartItemQuantity,
} from '@/lib/services/cart';
import { persistCartId, readCartId } from '@/lib/cart-session';
import type { CartViewDTO } from '@/types/dto';

export type ActionResult =
  | { ok: true; cart: CartViewDTO }
  | { ok: false; error: string };

/**
 * Two kinds of failure reach here and only one of them is the shopper's
 * business.
 *
 * `QuantityRuleError` and `StockError` carry sentences written for a person —
 * "sold in multiples of 12", "only 3 left" — and are repeated as they are.
 * Everything else names a variant or a cart by its database id, which is no
 * use to anybody reading a toast; it goes to the log and the shopper gets a
 * sentence instead.
 */
function failure(error: unknown): ActionResult {
  if (error instanceof QuantityRuleError || error instanceof StockError) {
    return { ok: false, error: error.message };
  }

  console.error('cart action failed', error);
  return { ok: false, error: 'We could not update your cart. Try again.' };
}

function revalidateCartSurfaces(): void {
  revalidatePath('/cart');
  revalidatePath('/', 'layout');
}

async function resolveCartId(): Promise<string> {
  const existing = await readCartId();
  if (existing && (await getCartView(existing))) return existing;

  const created = await createCart();
  await persistCartId(created);
  return created;
}

export async function addToCartAction(
  variantId: string,
  quantity: number,
): Promise<ActionResult> {
  try {
    const cartId = await resolveCartId();
    const cart = await addItemToCart(cartId, variantId, quantity);
    revalidateCartSurfaces();
    return { ok: true, cart };
  } catch (error) {
    return failure(error);
  }
}

export async function updateQuantityAction(
  variantId: string,
  quantity: number,
): Promise<ActionResult> {
  try {
    const cartId = await readCartId();
    if (!cartId) return { ok: false, error: 'Your cart has expired. Reload the page.' };

    const cart = await updateCartItemQuantity(cartId, variantId, quantity);
    revalidateCartSurfaces();
    return { ok: true, cart };
  } catch (error) {
    return failure(error);
  }
}
