import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { settleFailedOrder, settlePaidOrder } from '@/lib/services/checkout';
import { getStripe, webhookSecret } from '@/lib/stripe/client';

/**
 * Stripe's webhook.
 *
 * This is the only thing in the application allowed to decide that an order has
 * been paid. The browser reporting success is a claim from a machine the shop
 * does not control; a signed Stripe event is evidence.
 *
 * The signature is verified against the raw body — which is why this reads
 * `req.text()` and never `req.json()`. Parsing first would change the bytes and
 * the signature would never match.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const secret = webhookSecret();
  const signature = request.headers.get('stripe-signature');

  if (!secret || !signature) {
    // A missing secret means this environment is not configured to trust
    // Stripe yet. Refusing is the only safe answer: without it, anyone who
    // finds this URL could mark orders paid.
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch (error) {
    console.error('stripe webhook signature rejected', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await settlePaidOrder(event.data.object, event.id);
        break;

      case 'payment_intent.payment_failed':
        await settleFailedOrder(event.data.object, event.id);
        break;

      default:
        // Everything else is acknowledged and ignored. Returning 200 stops
        // Stripe retrying events this store has no opinion about.
        break;
    }
  } catch (error) {
    // A 500 asks Stripe to retry, which is what we want for a transient
    // database fault. The handlers are idempotent, so a retry is safe.
    console.error(`stripe webhook ${event.type} failed`, error);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
