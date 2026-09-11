import { describe, expect, it } from 'vitest';
import { hash, verify } from '@node-rs/argon2';
import { withTestDatabase } from '@/tests/setup/db';
import { User } from '@/lib/db/models/user';
import { PasswordReset } from '@/lib/db/models/password-reset';
import { RateLimit } from '@/lib/db/models/rate-limit';
import {
  MAX_RESETS_PER_DAY,
  RESET_TTL_MS,
  checkResetToken,
  hashToken,
  requestPasswordReset,
  resetPassword,
} from '@/lib/services/password-reset';

withTestDatabase();

async function seedCustomer(email = 'buyer@example.com') {
  return User.create({
    email,
    passwordHash: await hash('the-old-password'),
    name: 'A Buyer',
    role: 'customer',
  });
}

async function seedAdmin(email = 'admin@example.com') {
  return User.create({
    email,
    passwordHash: await hash('the-old-password'),
    name: 'Admin',
    role: 'admin',
  });
}

describe('requestPasswordReset', () => {
  it('mints a token for a customer and stores only its digest', async () => {
    await seedCustomer();

    const result = await requestPasswordReset('buyer@example.com');
    expect(result.status).toBe('sent');
    if (result.status !== 'sent') return;

    const stored = await PasswordReset.findOne({}).lean();

    expect(stored?.tokenHash).toBe(hashToken(result.token));
    expect(stored?.tokenHash).not.toContain(result.token);
    expect(stored?.sentTo).toBe('buyer@example.com');
  });

  it('never issues a link for an admin account', async () => {
    await seedAdmin();

    const result = await requestPasswordReset('admin@example.com');

    expect(result.status).toBe('ignored');
    expect(await PasswordReset.countDocuments({})).toBe(0);
  });

  it('answers the same way for an address with no account', async () => {
    const result = await requestPasswordReset('nobody@example.com');
    expect(result.status).toBe('ignored');
  });

  it('matches the address case-insensitively', async () => {
    await seedCustomer();
    const result = await requestPasswordReset('  BUYER@Example.COM ');

    expect(result.status).toBe('sent');
  });

  it('retires the previous link so only one is ever live', async () => {
    await seedCustomer();

    const first = await requestPasswordReset('buyer@example.com');
    const second = await requestPasswordReset('buyer@example.com');

    expect(first.status).toBe('sent');
    expect(second.status).toBe('sent');
    if (first.status !== 'sent') return;

    expect(await PasswordReset.countDocuments({})).toBe(1);
    expect((await checkResetToken(first.token)).valid).toBe(false);
  });

  it('allows the daily quota of links and then throttles', async () => {
    await seedCustomer();

    for (let i = 0; i < MAX_RESETS_PER_DAY; i += 1) {
      expect((await requestPasswordReset('buyer@example.com')).status).toBe('sent');
    }

    const blocked = await requestPasswordReset('buyer@example.com');

    expect(blocked.status).toBe('throttled');
    if (blocked.status !== 'throttled') return;
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('spends the budget on the address typed in, not on an account', async () => {
    // No user exists, so a throttle here cannot be read as "that address is a
    // customer" — which is the whole point.
    for (let i = 0; i < MAX_RESETS_PER_DAY; i += 1) {
      await requestPasswordReset('nobody@example.com');
    }

    expect((await requestPasswordReset('nobody@example.com')).status).toBe('throttled');
  });

  it('gives each address its own budget', async () => {
    await seedCustomer();
    await seedCustomer('other@example.com');

    for (let i = 0; i < MAX_RESETS_PER_DAY; i += 1) {
      await requestPasswordReset('buyer@example.com');
    }

    expect((await requestPasswordReset('other@example.com')).status).toBe('sent');
  });

  it('reopens the budget once the day is over', async () => {
    await seedCustomer();
    const start = new Date('2026-08-01T09:00:00Z');

    for (let i = 0; i < MAX_RESETS_PER_DAY; i += 1) {
      await requestPasswordReset('buyer@example.com', start);
    }

    expect((await requestPasswordReset('buyer@example.com', start)).status).toBe('throttled');

    const nextDay = new Date(start.getTime() + 24 * 60 * 60 * 1000 + 1000);
    expect((await requestPasswordReset('buyer@example.com', nextDay)).status).toBe('sent');
  });
});

describe('checkResetToken', () => {
  it('accepts a fresh token and names the account', async () => {
    await seedCustomer();
    const issued = await requestPasswordReset('buyer@example.com');
    if (issued.status !== 'sent') throw new Error('expected a token');

    const check = await checkResetToken(issued.token);

    expect(check.valid).toBe(true);
    if (!check.valid) return;
    expect(check.email).toBe('buyer@example.com');
  });

  it('rejects a token that never existed', async () => {
    const check = await checkResetToken('not-a-real-token');

    expect(check).toEqual({ valid: false, reason: 'unknown' });
  });

  it('rejects an expired token', async () => {
    await seedCustomer();
    const issued = await requestPasswordReset('buyer@example.com');
    if (issued.status !== 'sent') throw new Error('expected a token');

    const later = new Date(Date.now() + RESET_TTL_MS + 1000);

    expect(await checkResetToken(issued.token, later)).toEqual({
      valid: false,
      reason: 'expired',
    });
  });

  it('rejects a token whose account has since become an admin', async () => {
    const user = await seedCustomer();
    const issued = await requestPasswordReset('buyer@example.com');
    if (issued.status !== 'sent') throw new Error('expected a token');

    await User.updateOne({ _id: user._id }, { $set: { role: 'admin' } });

    expect((await checkResetToken(issued.token)).valid).toBe(false);
  });
});

describe('resetPassword', () => {
  it('sets the new password', async () => {
    await seedCustomer();
    const issued = await requestPasswordReset('buyer@example.com');
    if (issued.status !== 'sent') throw new Error('expected a token');

    const outcome = await resetPassword(issued.token, 'a-brand-new-password');
    expect(outcome).toEqual({ ok: true, email: 'buyer@example.com' });

    const stored = await User.findOne({ email: 'buyer@example.com' }).lean();
    expect(await verify(stored!.passwordHash, 'a-brand-new-password')).toBe(true);
    expect(await verify(stored!.passwordHash, 'the-old-password')).toBe(false);
  });

  it('burns the token, so the same link cannot be used twice', async () => {
    await seedCustomer();
    const issued = await requestPasswordReset('buyer@example.com');
    if (issued.status !== 'sent') throw new Error('expected a token');

    await resetPassword(issued.token, 'a-brand-new-password');

    expect(await resetPassword(issued.token, 'another-password')).toEqual({
      ok: false,
      reason: 'used',
    });
  });

  it('refuses an expired token and leaves the password alone', async () => {
    await seedCustomer();
    const issued = await requestPasswordReset('buyer@example.com');
    if (issued.status !== 'sent') throw new Error('expected a token');

    const later = new Date(Date.now() + RESET_TTL_MS + 1000);
    const outcome = await resetPassword(issued.token, 'a-brand-new-password', later);

    expect(outcome).toEqual({ ok: false, reason: 'expired' });

    const stored = await User.findOne({ email: 'buyer@example.com' }).lean();
    expect(await verify(stored!.passwordHash, 'the-old-password')).toBe(true);
  });

  it('hands the daily budget back, so a fumbled reset is not a day-long lockout', async () => {
    await seedCustomer();

    for (let i = 0; i < MAX_RESETS_PER_DAY - 1; i += 1) {
      await requestPasswordReset('buyer@example.com');
    }

    const issued = await requestPasswordReset('buyer@example.com');
    if (issued.status !== 'sent') throw new Error('expected a token');

    await resetPassword(issued.token, 'a-brand-new-password');

    expect(await RateLimit.countDocuments({ key: 'password-reset:buyer@example.com' })).toBe(0);
    expect((await requestPasswordReset('buyer@example.com')).status).toBe('sent');
  });
});
