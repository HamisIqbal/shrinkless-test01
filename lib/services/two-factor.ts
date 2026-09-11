import { randomInt } from 'node:crypto';
import { Types } from 'mongoose';
import { hash, verify } from '@node-rs/argon2';
import { connectToDatabase } from '@/lib/db/connection';
import { LoginChallenge } from '@/lib/db/models/login-challenge';
import {
  LIMITS,
  consume,
  peek,
  reset,
  type RateLimitResult,
} from '@/lib/security/rate-limit';

/** Long enough to walk to another device for the mail, short enough that a
 *  code left in an inbox is not a standing key. */
export const CODE_TTL_MS = 10 * 60 * 1000;

/** Five guesses against a six-digit code is a 1-in-200,000 shot. */
export const MAX_ATTEMPTS = 5;

/** Stops a held-down "send again" from filling a mailbox — and from being an
 *  outbound-mail amplifier for anyone who knows the admin password. */
export const RESEND_COOLDOWN_MS = 30 * 1000;

export type IssuedChallenge = {
  /** Plaintext, returned exactly once, for the mail transport to carry.
   *  Null when the last code is still inside the cooldown window. */
  code: string | null;
  sentTo: string;
  expiresAt: Date;
};

/** `randomInt` is CSPRNG-backed and unbiased; `Math.random` is neither. */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Six digits, and only six digits. Spaces and dashes a mail client may have
 *  helpfully inserted are the user's problem to not have caused, so strip them. */
export function normaliseCode(raw: string): string {
  return raw.replace(/[\s-]/g, '');
}

function isSixDigits(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/**
 * Replaces any pending challenge for this admin with a fresh one.
 *
 * Returns `code: null` when a code was issued less than `RESEND_COOLDOWN_MS`
 * ago — the existing code is still live and still valid, so the caller should
 * simply say so rather than sending a second mail.
 */
export async function issueAdminChallenge(
  userId: string,
  sentTo: string,
  now: Date = new Date(),
): Promise<IssuedChallenge> {
  await connectToDatabase();

  const existing = await LoginChallenge.findOne({ userId }).lean();

  if (existing) {
    const issuedAt = (existing as { createdAt?: Date }).createdAt?.getTime() ?? 0;
    const live = existing.expiresAt.getTime() > now.getTime();

    if (live && now.getTime() - issuedAt < RESEND_COOLDOWN_MS) {
      return { code: null, sentTo: existing.sentTo, expiresAt: existing.expiresAt };
    }
  }

  const code = generateCode();
  const expiresAt = new Date(now.getTime() + CODE_TTL_MS);

  await LoginChallenge.findOneAndUpdate(
    { userId },
    {
      $set: {
        codeHash: await hash(code),
        sentTo,
        attempts: 0,
        expiresAt,
        // A replacement is a new challenge, not an edit of the old one, so the
        // cooldown clock has to restart with it.
        createdAt: now,
      },
    },
    { upsert: true },
  );

  return { code, sentTo, expiresAt };
}

/**
 * True only for the right code, still inside its window, within the attempt
 * cap — and it burns the challenge on the way out, so no code is ever good
 * twice.
 */
export async function consumeAdminChallenge(
  userId: string,
  rawCode: string,
  now: Date = new Date(),
): Promise<boolean> {
  if (!Types.ObjectId.isValid(userId)) return false;

  const code = normaliseCode(rawCode);
  if (!isSixDigits(code)) return false;

  await connectToDatabase();

  // Counting the attempt before checking it means a crash mid-verify cannot
  // hand an attacker a free guess, and a burst of parallel guesses each pay.
  const challenge = await LoginChallenge.findOneAndUpdate(
    { userId },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after' },
  ).lean();

  if (!challenge) return false;

  if (challenge.expiresAt.getTime() <= now.getTime() || challenge.attempts > MAX_ATTEMPTS) {
    await LoginChallenge.deleteOne({ userId });
    return false;
  }

  const valid = await verify(challenge.codeHash, code).catch(() => false);
  if (!valid) return false;

  await LoginChallenge.deleteOne({ userId });
  return true;
}

/** Clears a pending challenge — used when a sign-in is abandoned. */
export async function clearAdminChallenge(userId: string): Promise<void> {
  if (!Types.ObjectId.isValid(userId)) return;
  await connectToDatabase();
  await LoginChallenge.deleteOne({ userId });
}

/* --------------------------------------------------------------------------
   The lockout

   The per-challenge attempt cap above protects one code. This protects the
   account: five wrong codes, whether spread across one challenge or fifty,
   and admin sign-in stops answering for an hour.

   It is deliberately a separate counter from `attempts`. A challenge is
   destroyed on its fifth miss, so a script that simply asks for a fresh code
   after every fifth guess would otherwise get unlimited attempts five at a
   time.
   -------------------------------------------------------------------------- */

/** Wrong codes allowed before the lock closes. */
export const LOCK_AFTER_FAILURES = LIMITS.adminCode.limit;

/** How long it stays closed. */
export const LOCK_MS = LIMITS.adminCode.windowMs;

export type LockState = {
  locked: boolean;
  /** Milliseconds until the lock lifts. Zero when not locked. */
  retryAfterMs: number;
  /** Wrong codes still available before the lock closes. */
  remaining: number;
};

function lockKey(userId: string): string {
  return `admin-code:${userId}`;
}

function toLockState(result: RateLimitResult): LockState {
  return {
    locked: !result.allowed,
    retryAfterMs: result.allowed ? 0 : result.retryAfterMs,
    remaining: result.remaining,
  };
}

/** Asks whether admin sign-in is locked, without spending an attempt. */
export async function adminLockState(userId: string): Promise<LockState> {
  if (!Types.ObjectId.isValid(userId)) return { locked: false, retryAfterMs: 0, remaining: LOCK_AFTER_FAILURES };

  return toLockState(await peek(lockKey(userId), LIMITS.adminCode.limit));
}

/** Records one wrong code and reports where that leaves the account. */
export async function recordAdminCodeFailure(userId: string): Promise<LockState> {
  if (!Types.ObjectId.isValid(userId)) return { locked: false, retryAfterMs: 0, remaining: LOCK_AFTER_FAILURES };

  return toLockState(
    await consume(lockKey(userId), LIMITS.adminCode.limit, LIMITS.adminCode.windowMs),
  );
}

/** A correct code clears the record. Getting in is proof the failures were
 *  fumbles rather than an attack. */
export async function clearAdminCodeFailures(userId: string): Promise<void> {
  if (!Types.ObjectId.isValid(userId)) return;
  await reset(lockKey(userId));
}
