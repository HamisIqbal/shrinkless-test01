import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Types } from 'mongoose';
import type Stripe from 'stripe';
import { connectToDatabase } from '@/lib/db/connection';
import { Cart } from '@/lib/db/models/cart';
import { Order } from '@/lib/db/models/order';
import { Payment } from '@/lib/db/models/payment';
import { getCartView } from '@/lib/services/cart';
import { priceOrder } from '@/lib/services/pricing';
import { transitionOrder } from '@/lib/services/orders';
import { CURRENCY, getStripe } from '@/lib/stripe/client';
import type { CheckoutInput } from '@/lib/validation/checkout';
import type { CartViewDTO } from '@/types/dto';

export class EmptyCartError extends Error {
  constructor() {
    super('There is nothing in your cart.');
    this.name = 'EmptyCartError';
  }
}

export class StockChangedError extends Error {
  constructor(readonly title: string, readonly available: number) {
    super(
      available === 0
        ? `${title} sold out while it was in your cart.`
        : `Only ${available} of ${title} left. Adjust the quantity and try again.`,
    );
    this.name = 'StockChangedError';
  }
}

/**
 * `SL-` plus the date and four random characters.
 *
 * Not a sequence: a sequential order number tells a competitor how many orders
 * the shop takes, and needs a counter document that becomes a write
 * bottleneck. The unique index is the real guarantee; the retry below handles
 * the vanishingly rare collision.
 */
function generateOrderNumber(now: Date = new Date()): string {
  const date = now.toISOString().slice(2, 10).replace(/-/g, '');
  const suffix = randomBytes(3).toString('base64url').toUpperCase().slice(0, 4);

  return `SL-${date}-${suffix}`;
}

/**
 * Refuses the whole checkout if any line can no longer be filled.
 *
 * Checked here as well as at payment because taking money for something that
 * sold out ten seconds ago is the one failure a shopper never forgives.
 */
function assertStillAvailable(cart: CartViewDTO): void {
  for (const line of cart.lines) {
    if (line.quantity > line.availableStock) {
      throw new StockChangedError(line.productTitle, line.availableStock);
    }
  }
}

export type StartedCheckout = {
  clientSecret: string;
  orderId: string;
  orderNumber: string;
  totalCents: number;
};

/**
 * Prices the cart, records a pending order, and opens a payment intent for it.
 *
 * The amount is computed here, from the database, and handed to Stripe. The
 * browser never sends a total and could not influence one if it tried — the
 * only things it supplies are an email address and a shipping address, both
 * re-validated before they are used.
 *
 * Reloading checkout updates the existing intent rather than creating another,
 * so an indecisive shopper leaves one pending order behind, not six.
 */
export async function startCheckout(input: {
  cartId: string;
  details: CheckoutInput;
  userId?: string | null;
}): Promise<StartedCheckout> {
  await connectToDatabase();

  const cart = await getCartView(input.cartId);
  if (!cart || cart.lines.length === 0) throw new EmptyCartError();

  assertStillAvailable(cart);

  // No discount code is accepted at this checkout and tax is off, so this
  // resolves to goods plus the shipping method's rate — currently zero.
  const pricing = await priceOrder({
    lines: cart.lines,
    country: input.details.shippingAddress.country,
    state: input.details.shippingAddress.state,
    email: input.details.email,
    userId: input.userId ?? null,
  });

  const order = await upsertPendingOrder({ cart, pricing, details: input.details, userId: input.userId ?? null });

  const stripe = getStripe();

  const params: Stripe.PaymentIntentCreateParams = {
    amount: pricing.totalCents,
    currency: CURRENCY,
    // Lets Stripe decide which methods to show, which is what puts Apple Pay
    // and Google Pay in front of the shoppers whose device supports them
    // without this code knowing anything about either.
    automatic_payment_methods: { enabled: true },
    receipt_email: input.details.email,
    metadata: {
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      cartId: input.cartId,
    },
    shipping: {
      name: input.details.shippingAddress.name,
      phone: input.details.shippingAddress.phone || undefined,
      address: {
        line1: input.details.shippingAddress.line1,
        line2: input.details.shippingAddress.line2 || undefined,
        city: input.details.shippingAddress.city,
        state: input.details.shippingAddress.state,
        postal_code: input.details.shippingAddress.postalCode,
        country: input.details.shippingAddress.country,
      },
    },
  };

  const intent = order.paymentIntentId
    ? await updateIntent(stripe, order.paymentIntentId, params)
    : await stripe.paymentIntents.create(params);

  if (order.paymentIntentId !== intent.id) {
    order.paymentIntentId = intent.id;
    await order.save();
  }

  if (!intent.client_secret) {
    throw new Error('Stripe returned an intent with no client secret.');
  }

  return {
    clientSecret: intent.client_secret,
    orderId: String(order._id),
    orderNumber: order.orderNumber,
    totalCents: pricing.totalCents,
  };
}

/**
 * Updates an existing intent, falling back to a new one when the old is no
 * longer updatable — an intent that already succeeded or was cancelled cannot
 * be reused, and a shopper hitting that should get a working checkout rather
 * than an error.
 */
async function updateIntent(
  stripe: Stripe,
  id: string,
  params: Stripe.PaymentIntentCreateParams,
): Promise<Stripe.PaymentIntent> {
  try {
    const existing = await stripe.paymentIntents.retrieve(id);

    if (existing.status === 'succeeded' || existing.status === 'canceled') {
      return stripe.paymentIntents.create(params);
    }

    return await stripe.paymentIntents.update(id, {
      amount: params.amount,
      receipt_email: params.receipt_email ?? undefined,
      metadata: params.metadata,
      shipping: params.shipping,
    });
  } catch {
    return stripe.paymentIntents.create(params);
  }
}

/**
 * The pending order.
 *
 * Written before payment so there is always a record to attach the money to,
 * and rewritten on each attempt so an edited cart or address is reflected. It
 * only ever touches orders still in `pending` — once an order is paid it is
 * history, and checkout has no business editing it.
 */
async function upsertPendingOrder(input: {
  cart: CartViewDTO;
  pricing: Awaited<ReturnType<typeof priceOrder>>;
  details: CheckoutInput;
  userId: string | null;
}) {
  const { cart, pricing, details, userId } = input;

  const fields = {
    userId: userId && Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : null,
    email: details.email,
    items: cart.lines.map((line) => ({
      title: line.productTitle,
      size: line.size,
      color: line.color,
      sku: line.variantId,
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
      imagePublicId: line.imagePublicId,
    })),
    shippingAddress: details.shippingAddress,
    subtotalCents: pricing.subtotalCents,
    discountCode: '',
    discountCents: 0,
    shippingCents: pricing.shippingCents,
    shippingMethodCode: pricing.shippingMethodCode || 'STANDARD',
    shippingMethodName: pricing.shippingMethodName || 'Standard shipping',
    taxCents: pricing.taxCents,
    totalCents: pricing.totalCents,
  };

  // The SKU on an order item has to be the variant's real SKU: inventory finds
  // the variant by it when the order is paid.
  const skus = await resolveSkus(cart);
  fields.items = fields.items.map((item) => ({ ...item, sku: skus.get(item.sku) ?? item.sku }));

  const pending = Types.ObjectId.isValid(cart.id)
    ? await Order.findOne({ cartId: new Types.ObjectId(cart.id), status: 'pending' })
    : null;

  if (pending) {
    pending.set(fields);
    await pending.save();
    return pending;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await Order.create({
        ...fields,
        cartId: Types.ObjectId.isValid(cart.id) ? new Types.ObjectId(cart.id) : null,
        orderNumber: generateOrderNumber(),
        status: 'pending',
        statusHistory: [{ status: 'pending', actor: 'checkout', at: new Date(), note: '' }],
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('duplicate key')) continue;
      throw error;
    }
  }

  throw new Error('Could not allocate an order number.');
}

/** Cart lines carry variant ids; orders carry SKUs. */
async function resolveSkus(cart: CartViewDTO): Promise<Map<string, string>> {
  const { Variant } = await import('@/lib/db/models/variant');

  const ids = cart.lines
    .map((line) => line.variantId)
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  const variants = await Variant.find({ _id: { $in: ids } }).select('sku').lean();

  return new Map(variants.map((variant) => [String(variant._id), variant.sku]));
}

/**
 * Turns a succeeded payment into a paid order.
 *
 * Called only from the webhook, never from the browser: a shopper's device
 * telling the server it paid is a claim, and Stripe's signed event is proof.
 *
 * Every step is idempotent because Stripe retries. The Payment row's unique
 * `providerEventId` absorbs a duplicate event, and the order transition
 * refuses to run twice because `paid` is not reachable from `paid`.
 */
export async function settlePaidOrder(
  intent: Stripe.PaymentIntent,
  eventId: string,
): Promise<void> {
  await connectToDatabase();

  const orderId = intent.metadata?.orderId;
  if (!orderId || !Types.ObjectId.isValid(orderId)) return;

  const order = await Order.findById(orderId);
  if (!order) return;

  // The amount Stripe captured has to match the amount this server calculated.
  // They can only differ if something tampered with the intent, and a
  // mismatch is worth a loud log and no order.
  if (intent.amount_received && intent.amount_received !== order.totalCents) {
    console.error(
      `stripe amount mismatch for ${order.orderNumber}: captured ${intent.amount_received}, expected ${order.totalCents}`,
    );
    return;
  }

  await recordPayment(intent, eventId, String(order._id));

  if (order.status === 'pending') {
    await transitionOrder({
      id: String(order._id),
      to: 'paid',
      actor: 'stripe',
      note: `Paid via ${describeMethod(intent)}`,
    });
  }

  // The cart has served its purpose. Removing it here rather than in the
  // browser means a shopper who closes the tab on the Stripe redirect still
  // comes back to an empty basket rather than a phantom one.
  const cartId = intent.metadata?.cartId;
  if (cartId && Types.ObjectId.isValid(cartId)) {
    await Cart.deleteOne({ _id: new Types.ObjectId(cartId) });
  }
}

/** A failed attempt. The order stays where a human can see it. */
export async function settleFailedOrder(
  intent: Stripe.PaymentIntent,
  eventId: string,
): Promise<void> {
  await connectToDatabase();

  const orderId = intent.metadata?.orderId;
  if (!orderId || !Types.ObjectId.isValid(orderId)) return;

  const order = await Order.findById(orderId);
  if (!order || order.status !== 'pending') return;

  await recordPayment(intent, eventId, String(order._id));

  await transitionOrder({
    id: String(order._id),
    to: 'payment_failed',
    actor: 'stripe',
    note: intent.last_payment_error?.message ?? 'The payment was declined.',
  });
}

/** Card metadata only: a brand and four digits. The raw payload is never
 *  stored, so nothing here could be used to charge anything. */
async function recordPayment(
  intent: Stripe.PaymentIntent,
  eventId: string,
  orderId: string,
): Promise<void> {
  const card = cardDetails(intent);

  try {
    await Payment.create({
      orderId: new Types.ObjectId(orderId),
      provider: 'stripe',
      providerPaymentId: intent.id,
      providerEventId: eventId,
      amountCents: intent.amount_received || intent.amount,
      status: intent.status,
      last4: card.last4,
      brand: card.brand,
      raw: {},
    });
  } catch (error) {
    // The unique index on providerEventId is what makes a retried webhook
    // harmless. A duplicate is the expected case, not a fault.
    if (error instanceof Error && error.message.includes('duplicate key')) return;
    throw error;
  }
}

function cardDetails(intent: Stripe.PaymentIntent): { brand: string; last4: string } {
  const charge = intent.latest_charge;
  if (!charge || typeof charge === 'string') return { brand: '', last4: '' };

  const card = charge.payment_method_details?.card;
  if (!card) return { brand: '', last4: '' };

  return { brand: card.brand ?? '', last4: card.last4 ?? '' };
}

/** "Apple Pay", "Google Pay" or the card brand — what a person would say. */
function describeMethod(intent: Stripe.PaymentIntent): string {
  const charge = intent.latest_charge;
  if (!charge || typeof charge === 'string') return 'card';

  const card = charge.payment_method_details?.card;
  const wallet = card?.wallet?.type;

  if (wallet === 'apple_pay') return 'Apple Pay';
  if (wallet === 'google_pay') return 'Google Pay';
  if (wallet === 'link') return 'Link';

  return card?.brand ? `${card.brand} card` : 'card';
}

export type ConfirmedOrder = {
  orderNumber: string;
  email: string;
  status: string;
  totalCents: number;
  shippingName: string;
  shippingCity: string;
  shippingState: string;
  items: { title: string; size: string; color: string; quantity: number }[];
};

/**
 * The order behind a payment intent, for the confirmation page.
 *
 * The client secret is required and is verified against Stripe, not against
 * anything this server stored. That is what makes this safe to serve without a
 * session: a shopper checking out as a guest has no account to authenticate
 * against, and the secret is the only thing that proves the person asking is
 * the person who opened that payment.
 *
 * Returns null for anything that does not check out — a wrong secret, an
 * unknown intent, an order that was never written. The page renders the same
 * "we cannot find that" either way, so this is not an oracle for probing
 * intent ids.
 */
export async function findConfirmedOrder(
  intentId: string,
  clientSecret: string,
): Promise<ConfirmedOrder | null> {
  if (!intentId || !clientSecret) return null;

  let intent: Stripe.PaymentIntent;
  try {
    intent = await getStripe().paymentIntents.retrieve(intentId);
  } catch {
    return null;
  }

  if (!intent.client_secret || !sameSecret(intent.client_secret, clientSecret)) return null;

  await connectToDatabase();

  const order = await Order.findOne({ paymentIntentId: intent.id }).lean();
  if (!order) return null;

  return {
    orderNumber: order.orderNumber,
    email: order.email,
    status: order.status,
    totalCents: order.totalCents,
    shippingName: order.shippingAddress?.name ?? '',
    shippingCity: order.shippingAddress?.city ?? '',
    shippingState: order.shippingAddress?.state ?? '',
    items: (order.items ?? []).map((item) => ({
      title: item.title,
      size: item.size,
      color: item.color,
      quantity: item.quantity,
    })),
  };
}

/** Constant time, because this is the comparison that guards the page. */
function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && timingSafeEqual(left, right);
}
