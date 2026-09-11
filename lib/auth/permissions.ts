/**
 * What a role is allowed to do.
 *
 * Roles stay coarse — there is one admin and one shop — but every sensitive
 * operation names a *permission* rather than a role, so adding a "fulfilment"
 * or "support" role later is a change to this table and nothing else. A guard
 * that asks `role === 'admin'` has to be found and rewritten; a guard that
 * asks for `orders:write` does not.
 *
 * Pure data and pure functions: no database, no request context, no imports
 * that drag mongoose anywhere near a client bundle.
 */

export const PERMISSIONS = [
  'dashboard:read',
  'products:read',
  'products:write',
  'inventory:read',
  'inventory:write',
  'orders:read',
  'orders:write',
  'customers:read',
  'customers:write',
  'categories:read',
  'categories:write',
  'discounts:read',
  'discounts:write',
  'shipping:read',
  'shipping:write',
  'payments:read',
  'media:read',
  'media:write',
  'content:read',
  'content:write',
  'settings:read',
  'settings:write',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type Role = 'customer' | 'admin';

/** An admin holds everything today. The point of the indirection is that this
 *  is the only line that has to change when that stops being true. */
const BY_ROLE: Record<Role, readonly Permission[]> = {
  customer: [],
  admin: PERMISSIONS,
};

export function permissionsFor(role: string | undefined): readonly Permission[] {
  return role === 'admin' ? BY_ROLE.admin : BY_ROLE.customer;
}

export function roleHas(role: string | undefined, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}
