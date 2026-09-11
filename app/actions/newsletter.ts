'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { notifyWhenBackInStock, subscribe } from '@/lib/services/subscribers';
import { LIMITS, consume } from '@/lib/security/rate-limit';

/**
 * Both forms here are unauthenticated writes, so both are throttled by source
 * address. The limit is generous enough that no real person meets it and tight
 * enough that a loop cannot fill the subscriber collection.
 */
async function withinLimit(): Promise<boolean> {
  const store = await headers();
  const address = (store.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown';

  const result = await consume(
    `public:${address}`,
    LIMITS.publicWrite.limit,
    LIMITS.publicWrite.windowMs,
  );

  return result.allowed;
}

const THROTTLED = 'That is a lot of sign-ups from one place. Try again later.';

const schema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address')),
});

export type NewsletterState =
  | { status: 'idle' }
  | { status: 'ok'; message: string }
  | { status: 'error'; message: string };

export async function subscribeAction(
  _previous: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  const parsed = schema.safeParse({ email: formData.get('email') });

  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Enter a valid email address' };
  }

  if (!(await withinLimit())) return { status: 'error', message: THROTTLED };

  try {
    await subscribe(parsed.data.email);
    return { status: 'ok', message: "You're on the list." };
  } catch {
    return { status: 'error', message: 'Could not sign you up just now. Try again shortly.' };
  }
}

const restockSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address')),
  /* Both come from hidden inputs, so both are a browser's word for what it
     was looking at. Bounded rather than trusted: they end up in a record the
     store reads back when the colourway returns. */
  slug: z.string().trim().min(1).max(200),
  color: z.string().trim().min(1).max(80),
});

/**
 * The sold-out form. Same shape as the newsletter action so the two forms can
 * share a component pattern, but it records which tee and which colourway was
 * asked about rather than dropping the address into one undifferentiated list.
 */
export async function notifyRestockAction(
  _previous: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  const parsed = restockSchema.safeParse({
    email: formData.get('email'),
    slug: formData.get('slug'),
    color: formData.get('color'),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Enter a valid email address',
    };
  }

  if (!(await withinLimit())) return { status: 'error', message: THROTTLED };

  try {
    await notifyWhenBackInStock(parsed.data.email, parsed.data.slug, parsed.data.color);
    return { status: 'ok', message: "We'll email you the moment it's back." };
  } catch {
    return { status: 'error', message: 'Could not save that just now. Try again shortly.' };
  }
}
