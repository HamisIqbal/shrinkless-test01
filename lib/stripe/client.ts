import Stripe from 'stripe';
import { z } from 'zod';

/**
 * The Stripe client, server side only.
 *
 * Separate from lib/env.ts for the same reason Cloudinary is: the storefront
 * has to boot on an environment with no payment keys — a catalogue that cannot
 * render because checkout is unconfigured is a worse failure than a checkout
 * that says so.
 */
const schema = z.object({
  STRIPE_SECRET_KEY: z.string().min(1),
});

export class StripeNotConfiguredError extends Error {
  constructor() {
    super('Payments are not configured on this environment.');
    this.name = 'StripeNotConfiguredError';
  }
}

let cached: Stripe | null = null;

export function stripeConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return schema.safeParse(env).success;
}

export function getStripe(env: NodeJS.ProcessEnv = process.env): Stripe {
  if (cached) return cached;

  const parsed = schema.safeParse(env);
  if (!parsed.success) throw new StripeNotConfiguredError();

  // Pinning the API version means a Stripe-side upgrade cannot silently change
  // the shape of a webhook payload this code already parses.
  cached = new Stripe(parsed.data.STRIPE_SECRET_KEY, {
    apiVersion: '2026-08-26.dahlia',
    appInfo: { name: 'Shrinkless', url: 'https://shrinkless.vercel.app' },
  });

  return cached;
}

/** The key the browser needs. Publishable by design — it can only create,
 *  never capture. */
export function publishableKey(env: NodeJS.ProcessEnv = process.env): string {
  return env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? '';
}

export function webhookSecret(env: NodeJS.ProcessEnv = process.env): string {
  return env.STRIPE_WEBHOOK_SECRET?.trim() ?? '';
}

/** The store sells in one currency, to one country. Both are stated once. */
export const CURRENCY = 'usd';
export const SHIPS_TO = ['US'] as const;
