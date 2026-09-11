import { describe, expect, it } from 'vitest';
import { User } from '@/lib/db/models/user';
import { LoginChallenge } from '@/lib/db/models/login-challenge';
import {
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  consumeAdminChallenge,
  clearAdminChallenge,
  generateCode,
  issueAdminChallenge,
  normaliseCode,
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

describe('generateCode', () => {
  it('is always six digits', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateCode()).toMatch(/^\d{6}$/);
    }
  });
});

describe('normaliseCode', () => {
  it('drops the spacing a mail client may have added', () => {
    expect(normaliseCode(' 123 456 ')).toBe('123456');
    expect(normaliseCode('123-456')).toBe('123456');
  });
});

describe('issueAdminChallenge', () => {
  it('stores a hash, never the code itself', async () => {
    const userId = await seedAdmin();
    const { code } = await issueAdminChallenge(userId, 'ops@example.com');

    const stored = await LoginChallenge.findOne({ userId }).lean();

    expect(code).toMatch(/^\d{6}$/);
    expect(stored?.codeHash).not.toContain(code as string);
    expect(stored?.sentTo).toBe('ops@example.com');
  });

  it('withholds a second code inside the cooldown window', async () => {
    const userId = await seedAdmin();
    const first = await issueAdminChallenge(userId, 'ops@example.com');

    const again = await issueAdminChallenge(userId, 'ops@example.com');

    expect(first.code).not.toBeNull();
    expect(again.code).toBeNull();
  });

  it('issues a fresh code once the cooldown has passed, and retires the old one', async () => {
    const userId = await seedAdmin();
    const first = await issueAdminChallenge(userId, 'ops@example.com');

    const later = new Date(Date.now() + RESEND_COOLDOWN_MS + 1000);
    const second = await issueAdminChallenge(userId, 'ops@example.com', later);

    expect(second.code).not.toBeNull();
    expect(await consumeAdminChallenge(userId, first.code as string, later)).toBe(false);
    expect(await consumeAdminChallenge(userId, second.code as string, later)).toBe(true);
  });

  it('keeps one challenge per admin', async () => {
    const userId = await seedAdmin();
    await issueAdminChallenge(userId, 'ops@example.com');
    await issueAdminChallenge(
      userId,
      'ops@example.com',
      new Date(Date.now() + RESEND_COOLDOWN_MS + 1000),
    );

    expect(await LoginChallenge.countDocuments({ userId })).toBe(1);
  });
});

describe('consumeAdminChallenge', () => {
  it('accepts the right code exactly once', async () => {
    const userId = await seedAdmin();
    const { code } = await issueAdminChallenge(userId, 'ops@example.com');

    expect(await consumeAdminChallenge(userId, code as string)).toBe(true);
    expect(await consumeAdminChallenge(userId, code as string)).toBe(false);
  });

  it('rejects the wrong code and anything that is not six digits', async () => {
    const userId = await seedAdmin();
    const { code } = await issueAdminChallenge(userId, 'ops@example.com');
    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0');

    expect(await consumeAdminChallenge(userId, wrong)).toBe(false);
    expect(await consumeAdminChallenge(userId, '')).toBe(false);
    expect(await consumeAdminChallenge(userId, '12345')).toBe(false);
    expect(await consumeAdminChallenge(userId, 'abcdef')).toBe(false);
  });

  it('rejects an expired code', async () => {
    const userId = await seedAdmin();
    const { code } = await issueAdminChallenge(userId, 'ops@example.com');

    const tooLate = new Date(Date.now() + CODE_TTL_MS + 1000);

    expect(await consumeAdminChallenge(userId, code as string, tooLate)).toBe(false);
  });

  it('burns the challenge after the attempt cap, right code or not', async () => {
    const userId = await seedAdmin();
    const { code } = await issueAdminChallenge(userId, 'ops@example.com');

    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      expect(await consumeAdminChallenge(userId, '000000')).toBe(false);
    }

    expect(await consumeAdminChallenge(userId, code as string)).toBe(false);
    expect(await LoginChallenge.countDocuments({ userId })).toBe(0);
  });

  it('returns false rather than throwing for an id that is not an ObjectId', async () => {
    expect(await consumeAdminChallenge('not-an-id', '123456')).toBe(false);
  });

  it('has nothing to consume once the challenge is cleared', async () => {
    const userId = await seedAdmin();
    const { code } = await issueAdminChallenge(userId, 'ops@example.com');

    await clearAdminChallenge(userId);

    expect(await consumeAdminChallenge(userId, code as string)).toBe(false);
  });
});
