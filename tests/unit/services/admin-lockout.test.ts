import { describe, expect, it } from 'vitest';
import { User } from '@/lib/db/models/user';
import {
  LOCK_AFTER_FAILURES,
  LOCK_MS,
  adminLockState,
  clearAdminCodeFailures,
  recordAdminCodeFailure,
} from '@/lib/services/two-factor';
import { withTestDatabase } from '@/tests/setup/db';

withTestDatabase();

async function seedAdmin() {
  const user = await User.create({
    email: 'admin@example.com',
    passwordHash: 'x',
    name: 'Admin',
    role: 'admin',
  });

  return String(user._id);
}

async function failTimes(userId: string, times: number) {
  for (let i = 0; i < times; i += 1) {
    await recordAdminCodeFailure(userId);
  }
}

describe('adminLockState', () => {
  it('starts open, with the full budget', async () => {
    const userId = await seedAdmin();

    expect(await adminLockState(userId)).toEqual({
      locked: false,
      retryAfterMs: 0,
      remaining: LOCK_AFTER_FAILURES,
    });
  });

  it('does not spend an attempt to ask', async () => {
    const userId = await seedAdmin();

    await failTimes(userId, LOCK_AFTER_FAILURES);

    // Asking a hundred times must not be what tips it over.
    for (let i = 0; i < 100; i += 1) {
      expect((await adminLockState(userId)).locked).toBe(false);
    }
  });

  it('ignores an id that is not an id', async () => {
    expect((await adminLockState('not-an-id')).locked).toBe(false);
  });
});

describe('recordAdminCodeFailure', () => {
  it(`stays open for ${LOCK_AFTER_FAILURES} wrong codes`, async () => {
    const userId = await seedAdmin();

    for (let i = 0; i < LOCK_AFTER_FAILURES; i += 1) {
      expect((await recordAdminCodeFailure(userId)).locked).toBe(false);
    }
  });

  it('closes on the next one, and reports how long for', async () => {
    const userId = await seedAdmin();
    await failTimes(userId, LOCK_AFTER_FAILURES);

    const state = await recordAdminCodeFailure(userId);

    expect(state.locked).toBe(true);
    expect(state.retryAfterMs).toBeGreaterThan(0);
    expect(state.retryAfterMs).toBeLessThanOrEqual(LOCK_MS);
    expect((await adminLockState(userId)).locked).toBe(true);
  });

  it('locks one admin without touching another', async () => {
    const locked = await seedAdmin();
    const other = String(
      (await User.create({ email: 'ops@example.com', passwordHash: 'x', role: 'admin' }))._id,
    );

    await failTimes(locked, LOCK_AFTER_FAILURES + 1);

    expect((await adminLockState(locked)).locked).toBe(true);
    expect((await adminLockState(other)).locked).toBe(false);
  });

  it('counts across separate challenges, not just within one', async () => {
    // The point of a second counter: destroying a challenge after five misses
    // must not hand an attacker five fresh guesses.
    const userId = await seedAdmin();

    await failTimes(userId, 3);
    await failTimes(userId, 3);

    expect((await adminLockState(userId)).locked).toBe(true);
  });
});

describe('clearAdminCodeFailures', () => {
  it('reopens sign-in after a correct code', async () => {
    const userId = await seedAdmin();
    await failTimes(userId, LOCK_AFTER_FAILURES + 1);

    await clearAdminCodeFailures(userId);

    expect(await adminLockState(userId)).toEqual({
      locked: false,
      retryAfterMs: 0,
      remaining: LOCK_AFTER_FAILURES,
    });
  });
});
