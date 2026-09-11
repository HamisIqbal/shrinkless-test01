import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { permissionsFor, roleHas, type Permission, type Role } from '@/lib/auth/permissions';

export type AdminActor = {
  id: string;
  email: string;
  name: string;
  role: Role;
  permissions: readonly Permission[];
};

export class NotAuthorizedError extends Error {
  constructor(permission?: Permission) {
    super(
      permission
        ? `The permission "${permission}" is required for this action.`
        : 'Admin privileges are required for this action.',
    );
    this.name = 'NotAuthorizedError';
  }
}

type SessionLike = { user?: { role?: string } } | null | undefined;

/**
 * Pure, so the rule itself is testable without a request context. Exact match
 * only — never a substring test, and never a default of 'admin'.
 */
export function isAdminSession(session: SessionLike): boolean {
  return session?.user?.role === 'admin';
}

/** Session-level permission test. The session's role comes from the JWT, which
 *  is signed — a browser cannot promote itself by editing a cookie. */
export function sessionCan(session: SessionLike, permission: Permission): boolean {
  return roleHas(session?.user?.role, permission);
}

async function currentActor(): Promise<AdminActor | null> {
  const session = await auth();
  if (!isAdminSession(session)) return null;

  const user = (session as { user?: Record<string, string> } | null)?.user;

  return {
    id: user?.id ?? '',
    email: user?.email ?? '',
    name: user?.name ?? '',
    role: 'admin',
    permissions: permissionsFor('admin'),
  };
}

/** For Server Components. Sends non-admins away instead of rendering. */
export async function requireAdminPage(permission?: Permission): Promise<AdminActor> {
  const actor = await currentActor();
  if (!actor) redirect('/login');
  if (permission && !actor.permissions.includes(permission)) redirect('/admin');

  return actor;
}

/**
 * For Server Actions. The proxy can be bypassed — a Server Function is a POST
 * to whatever route imported it — so this is the check that actually enforces.
 */
export async function requireAdminActor(): Promise<AdminActor> {
  const actor = await currentActor();
  if (!actor) throw new NotAuthorizedError();
  return actor;
}

/**
 * The check every mutating admin operation should use. Names what it needs
 * rather than who it trusts.
 */
export async function requirePermission(permission: Permission): Promise<AdminActor> {
  const actor = await currentActor();
  if (!actor) throw new NotAuthorizedError(permission);
  if (!actor.permissions.includes(permission)) throw new NotAuthorizedError(permission);

  return actor;
}
