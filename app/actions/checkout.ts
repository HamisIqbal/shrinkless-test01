'use server';

import { auth } from '@/auth';
import { readCartId } from '@/lib/cart-session';
import {
  EmptyCartError,
  StockChangedError,
  startCheckout,
  type StartedCheckout,
} from '@/lib/services/checkout';
import { StripeNotConfiguredError } from '@/lib/stripe/client';
import { checkoutInputSchema } from '@/lib/validation/checkout';

export type CheckoutResult =
  | { ok: true; data: StartedCheckout }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Opens a payment for the current cart.
 *
 * The cart id comes from the httpOnly cookie, never from the request body — a
 * caller cannot check out somebody else's basket by naming it. Everything that
 * decides money is read from the database on this side of the wire.
 */
export async function startCheckoutAction(raw: unknown): Promise<CheckoutResult> {
  const parsed = checkoutInputSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.') || '_';
      fieldErrors[path] ??= issue.message;
    }

    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Check your details and try again.',
      fieldErrors,
    };
  }

  const cartId = await readCartId();
  if (!cartId) return { ok: false, error: 'Your cart is empty.' };

  const session = await auth();

  try {
    const started = await startCheckout({
      cartId,
      details: parsed.data,
      userId: session?.user?.id ?? null,
    });

    return { ok: true, data: started };
  } catch (error) {
    if (error instanceof EmptyCartError) return { ok: false, error: error.message };
    if (error instanceof StockChangedError) return { ok: false, error: error.message };

    if (error instanceof StripeNotConfiguredError) {
      return {
        ok: false,
        error: 'Checkout is not available yet. Please try again shortly.',
      };
    }

    console.error('checkout failed', error);
    return { ok: false, error: 'We could not start the payment. Try again.' };
  }
}
