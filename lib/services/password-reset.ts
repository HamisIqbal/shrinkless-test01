import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Types } from 'mongoose';
import { hash } from '@node-rs/argon2';
import { connectToDatabase } from '@/lib/db/connection';
import { PasswordReset } from '@/lib/db/models/password-reset';
import { User } from '@/lib/db/models/user';
import { LIMITS, consume, reset as clearLimit } from '@/lib/security/rate-limit';

/** Long enough to find the mail on another device, short enough that a link
 *  left in an inbox overnight is not a standing key to the account. */
export const RESET_TTL_MS = 60 * 60 * 1000;

/** Links mailed per address per day. */
export const MAX_RESETS_PER_DAY = LIMITS.passwordReset.limit;

export const RESET_WINDOW_MS = LIMITS.passwordReset.windowMs;

/** 32 random bytes. Not guessable, so the digest below can be fast. */
function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export type ResetRequest =
  /** A link was minted. The caller mails it — this module never sends. */
  | { status: 'sent'; token: string; sentTo: string; expiresAt: Date }
  /** The daily budget for this address is spent. */
  | { status: 'throttled'; retryAfterMs: number }
  /** No customer account by that address, or the account is an admin. The
   *  caller must answer exactly as it answers 'sent'. */
  | { status: 'ignored' };

function limitKey(email: string): string {
  return `password-reset:${email}`;
}

/**
 * Mints a reset link for a customer account.
 *
 * Two rules make this safe to expose to anyone who can type an email address:
 *
 * The budget is spent on the *address typed into the form*, whether or not an
 * account exists behind it. So a throttle message reveals only that this form
 * has been used five times for that address — never that the address is a
 * customer here.
 *
 * Admin accounts are never issued a link. An admin holds a second factor
 * precisely so that one compromised mailbox is not enough; a reset link that
 * replaced the password from that same mailbox would hand back everything the
 * second factor was bought to protect.
 */
export async function requestPasswordReset(
  email: string,
  now: Date = new Date(),
): Promise<ResetRequest> {
  await connectToDatabase();

  const normalised = email.trim().toLowerCase();

  const budget = await consume(
    limitKey(normalised),
    LIMITS.passwordReset.limit,
    LIMITS.passwordReset.windowMs,
    now,
  );

  if (!budget.allowed) {
    return { status: 'throttled', retryAfterMs: budget.retryAfterMs };
  }

  const user = await User.findOne({ email: normalised }).select('email role').lean();
  if (!user || user.role === 'admin') return { status: 'ignored' };

  // One live link at a time. A new request retires the old one, so a mailbox
  // full of links never means a mailbox full of *working* links.
  await PasswordReset.deleteMany({ userId: user._id, usedAt: null });

  const token = generateToken();
  const expiresAt = new Date(now.getTime() + RESET_TTL_MS);

  await PasswordReset.create({
    userId: user._id,
    tokenHash: hashToken(token),
    sentTo: user.email,
    expiresAt,
  });

  return { status: 'sent', token, sentTo: user.email, expiresAt };
}

export type TokenCheck =
  | { valid: true; userId: string; email: string }
  | { valid: false; reason: 'unknown' | 'expired' | 'used' };

/**
 * Whether a token is still good, without spending it.
 *
 * Used to decide what the reset page renders: a form, or an explanation. The
 * lookup is by digest, and the digest is compared in constant time even though
 * a 256-bit token makes the timing academic — cheap, and it stays correct if
 * tokens ever get shorter.
 */
export async function checkResetToken(
  token: string,
  now: Date = new Date(),
): Promise<TokenCheck> {
  await connectToDatabase();

  const digest = hashToken(token);
  const row = await PasswordReset.findOne({ tokenHash: digest }).lean();

  if (!row || !sameDigest(row.tokenHash, digest)) return { valid: false, reason: 'unknown' };
  if (row.usedAt) return { valid: false, reason: 'used' };
  if (row.expiresAt.getTime() <= now.getTime()) return { valid: false, reason: 'expired' };

  const user = await User.findById(row.userId).select('email role').lean();

  // An account promoted to admin while a link was outstanding must not be
  // resettable by it.
  if (!user || user.role === 'admin') return { valid: false, reason: 'unknown' };

  return { valid: true, userId: String(row.userId), email: user.email };
}

function sameDigest(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && timingSafeEqual(left, right);
}

export type ResetOutcome =
  | { ok: true; email: string }
  | { ok: false; reason: 'unknown' | 'expired' | 'used' };

/**
 * Spends a token and sets the new password.
 *
 * The token is marked used *before* the password is written, and only if it
 * was still unused — `findOneAndUpdate` on `usedAt: null` is atomic, so two
 * simultaneous submissions of the same link cannot both succeed.
 */
export async function resetPassword(
  token: string,
  password: string,
  now: Date = new Date(),
): Promise<ResetOutcome> {
  const check = await checkResetToken(token, now);
  if (!check.valid) return { ok: false, reason: check.reason };

  const claimed = await PasswordReset.findOneAndUpdate(
    { tokenHash: hashToken(token), usedAt: null },
    { $set: { usedAt: now } },
    { returnDocument: 'after' },
  ).lean();

  if (!claimed) return { ok: false, reason: 'used' };

  await User.updateOne(
    { _id: new Types.ObjectId(check.userId) },
    { $set: { passwordHash: await hash(password) } },
  );

  // Any other outstanding link for this account dies with the reset: whoever
  // just set the password is the account holder, and a link mailed before
  // that should not still work afterwards.
  await PasswordReset.deleteMany({
    userId: new Types.ObjectId(check.userId),
    usedAt: null,
  });

  // Getting back in hands the daily budget back, so a customer who fumbled a
  // few links is not locked out of asking again tomorrow morning.
  await clearLimit(limitKey(check.email));

  return { ok: true, email: check.email };
}
