import { connectToDatabase } from '@/lib/db/connection';
import { RateLimit } from '@/lib/db/models/rate-limit';

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

/**
 * A fixed-window counter, shared across every instance of the app.
 *
 * Fixed windows are the crude option — a burst can straddle a boundary and get
 * up to twice the allowance — and they are the right one here. What these
 * limits defend against is a script trying thousands of passwords or firing a
 * mailer in a loop, and a factor of two at the boundary does not help that
 * script at all. A sliding window would cost a second collection and a lot
 * more writes to buy a precision nothing here needs.
 *
 * Increment-then-compare, in one atomic upsert: two concurrent requests each
 * pay for their own attempt, so a race cannot buy a free one.
 */
export async function consume(
  key: string,
  limit: number,
  windowMs: number,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  await connectToDatabase();

  const expiresAt = new Date(now.getTime() + windowMs);

  // A window that has already expired is replaced rather than incremented:
  // `$setOnInsert` cannot express "reset if stale", so the stale row is dropped
  // first. The delete is scoped by expiry, so it can never remove a live one.
  await RateLimit.deleteOne({ key, expiresAt: { $lte: now } });

  const doc = await RateLimit.findOneAndUpdate(
    { key },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean();

  const count = doc?.count ?? 1;
  const windowEnd = doc?.expiresAt ?? expiresAt;
  const remaining = Math.max(0, limit - count);

  return {
    allowed: count <= limit,
    remaining,
    retryAfterMs: Math.max(0, windowEnd.getTime() - now.getTime()),
  };
}

/**
 * Reads a window without spending from it.
 *
 * Needed wherever a limit has to be *reported* before the thing it guards is
 * attempted — a lockout message on a sign-in form, for instance, where asking
 * "are you locked out?" must not itself count as an attempt.
 */
export async function peek(
  key: string,
  limit: number,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  await connectToDatabase();

  const doc = await RateLimit.findOne({ key }).lean();

  if (!doc || doc.expiresAt.getTime() <= now.getTime()) {
    return { allowed: true, remaining: limit, retryAfterMs: 0 };
  }

  return {
    allowed: doc.count <= limit,
    remaining: Math.max(0, limit - doc.count),
    retryAfterMs: Math.max(0, doc.expiresAt.getTime() - now.getTime()),
  };
}

/** Clears a key — used after a success, so a legitimate sign-in does not leave
 *  a nearly-spent budget behind for the next one. */
export async function reset(key: string): Promise<void> {
  await connectToDatabase();
  await RateLimit.deleteOne({ key });
}

/** Whole minutes, rounded up, for a message a person reads. */
export function retryAfterMinutes(result: RateLimitResult): number {
  return Math.max(1, Math.ceil(result.retryAfterMs / 60_000));
}

/**
 * The limits themselves, in one place so they can be read as a policy rather
 * than hunted for across call sites.
 */
export const LIMITS = {
  /** Password attempts per email address. */
  login: { limit: 10, windowMs: 15 * 60 * 1000 },
  /** Sign-in attempts from one address, whatever email they name. */
  loginByIp: { limit: 30, windowMs: 15 * 60 * 1000 },
  /** Second-factor codes mailed for one account. Costs real email. */
  twoFactorSend: { limit: 8, windowMs: 60 * 60 * 1000 },
  /** Newsletter and back-in-stock sign-ups from one address. */
  publicWrite: { limit: 20, windowMs: 60 * 60 * 1000 },
  /** Password reset links mailed for one address, per day. Counted against
   *  the address typed into the form whether or not an account exists, so
   *  being throttled never confirms that one does. */
  passwordReset: { limit: 5, windowMs: 24 * 60 * 60 * 1000 },
  /** Wrong admin sign-in codes. Spending this budget locks admin sign-in for
   *  the rest of the window. */
  adminCode: { limit: 5, windowMs: 60 * 60 * 1000 },
} as const;
