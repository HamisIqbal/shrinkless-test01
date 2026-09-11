import { describe, expect, it } from 'vitest';
import { withTestDatabase } from '@/tests/setup/db';
import { User } from '@/lib/db/models/user';
import {
  EmailTakenError,
  createUser,
  getUserById,
  verifyCredentials,
} from '@/lib/services/users';

withTestDatabase();

const input = { email: 'buyer@example.com', password: 'a-strong-password', name: 'A Buyer' };

describe('createUser', () => {
  it('creates a customer and never returns the hash', async () => {
    const user = await createUser(input);

    expect(user.role).toBe('customer');
    expect(user.email).toBe('buyer@example.com');
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('stores an argon2 hash, not the raw password', async () => {
    await createUser(input);
    const stored = await User.findOne({ email: input.email }).lean();

    expect(stored?.passwordHash).not.toBe(input.password);
    expect(stored?.passwordHash.startsWith('$argon2')).toBe(true);
  });

  it('rejects a duplicate email with a typed error', async () => {
    await createUser(input);
    await expect(createUser(input)).rejects.toBeInstanceOf(EmailTakenError);
  });

  it('always creates a customer, even if a role is smuggled in', async () => {
    const user = await createUser({ ...input, role: 'admin' } as never);
    expect(user.role).toBe('customer');
  });

  it('treats a differently-cased address as the same account', async () => {
    await createUser(input);

    // The schema lowercases on the way in, so 'Buyer@Example.com' and
    // 'buyer@example.com' are one address and one account — not two.
    await expect(
      createUser({ ...input, email: 'Buyer@Example.COM' } as never),
    ).rejects.toBeInstanceOf(EmailTakenError);

    expect(await User.countDocuments({})).toBe(1);
  });

  it('leaves exactly one account behind when two registrations race', async () => {
    const attempts = await Promise.allSettled([
      createUser(input),
      createUser(input),
      createUser(input),
    ]);

    // The unique index is the real guarantee: the read-then-write check above
    // it cannot see a sibling request's uncommitted insert.
    expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(1);
    expect(await User.countDocuments({ email: input.email })).toBe(1);
  });

  it('refuses a second account even when the service is bypassed', async () => {
    await createUser(input);

    await expect(
      User.create({ email: input.email, passwordHash: 'x', role: 'customer' }),
    ).rejects.toThrow(/duplicate key/);
  });

  it('will not create a customer on an admin address', async () => {
    await User.create({ email: 'admin@example.com', passwordHash: 'x', role: 'admin' });

    await expect(
      createUser({ ...input, email: 'admin@example.com' }),
    ).rejects.toBeInstanceOf(EmailTakenError);
  });
});

describe('verifyCredentials', () => {
  it('returns the user for a correct password', async () => {
    await createUser(input);
    const user = await verifyCredentials(input.email, input.password);

    expect(user?.email).toBe(input.email);
  });

  it('returns null for a wrong password', async () => {
    await createUser(input);
    expect(await verifyCredentials(input.email, 'wrong-password')).toBeNull();
  });

  it('returns null for an unknown email', async () => {
    expect(await verifyCredentials('nobody@example.com', 'whatever')).toBeNull();
  });

  it('matches the email case-insensitively', async () => {
    await createUser(input);
    expect(await verifyCredentials('BUYER@EXAMPLE.COM', input.password)).not.toBeNull();
  });
});

describe('getUserById', () => {
  it('returns null for an id that does not exist', async () => {
    expect(await getUserById('507f1f77bcf86cd799439011')).toBeNull();
  });

  it('returns null for a malformed id rather than throwing', async () => {
    expect(await getUserById('not-an-id')).toBeNull();
  });
});
