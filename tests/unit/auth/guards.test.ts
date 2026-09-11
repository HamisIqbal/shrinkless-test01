import { describe, expect, it } from 'vitest';
import { isAdminSession } from '@/lib/auth/guards';

describe('isAdminSession', () => {
  it('accepts a session whose user has the admin role', () => {
    expect(isAdminSession({ user: { role: 'admin' } })).toBe(true);
  });

  it('rejects a signed-in customer', () => {
    expect(isAdminSession({ user: { role: 'customer' } })).toBe(false);
  });

  it('rejects an anonymous visitor', () => {
    expect(isAdminSession(null)).toBe(false);
  });

  it('rejects a session with no user', () => {
    expect(isAdminSession({})).toBe(false);
  });

  it('rejects a missing role rather than defaulting to admin', () => {
    expect(isAdminSession({ user: {} })).toBe(false);
  });

  it('is not fooled by a role that merely contains "admin"', () => {
    expect(isAdminSession({ user: { role: 'not-admin' } })).toBe(false);
  });
});
