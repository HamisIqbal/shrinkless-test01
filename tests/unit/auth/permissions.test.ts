import { describe, expect, it } from 'vitest';
import { PERMISSIONS, permissionsFor, roleHas } from '@/lib/auth/permissions';
import { isAdminSession, sessionCan } from '@/lib/auth/guards';

describe('permissionsFor', () => {
  it('gives an admin every permission', () => {
    expect(permissionsFor('admin')).toHaveLength(PERMISSIONS.length);
  });

  it('gives a customer none, including for an unknown or absent role', () => {
    expect(permissionsFor('customer')).toHaveLength(0);
    expect(permissionsFor(undefined)).toHaveLength(0);
    expect(permissionsFor('Admin')).toHaveLength(0);
    expect(permissionsFor('admin ')).toHaveLength(0);
    expect(permissionsFor('superadmin')).toHaveLength(0);
  });
});

describe('roleHas', () => {
  it('answers per permission', () => {
    expect(roleHas('admin', 'orders:write')).toBe(true);
    expect(roleHas('customer', 'orders:write')).toBe(false);
  });
});

describe('sessionCan', () => {
  it('reads the role off the session', () => {
    expect(sessionCan({ user: { role: 'admin' } }, 'products:write')).toBe(true);
    expect(sessionCan({ user: { role: 'customer' } }, 'products:write')).toBe(false);
    expect(sessionCan(null, 'products:write')).toBe(false);
    expect(sessionCan({}, 'products:write')).toBe(false);
  });
});

describe('isAdminSession', () => {
  it('matches the role exactly and nothing else', () => {
    expect(isAdminSession({ user: { role: 'admin' } })).toBe(true);
    expect(isAdminSession({ user: { role: 'administrator' } })).toBe(false);
    expect(isAdminSession({ user: {} })).toBe(false);
    expect(isAdminSession(undefined)).toBe(false);
  });
});
