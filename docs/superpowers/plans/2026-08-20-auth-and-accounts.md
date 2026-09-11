# Shrinkless Auth & Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a customer register, sign in, and sign out; expose the session to server code with the user's role attached; and merge a guest cart into the account cart on login.

**Architecture:** Auth.js v5 (`next-auth@5.0.0-beta.32`) with the Credentials provider and a JWT session — no database adapter, because the credentials flow does not need one. Password verification lives in `lib/services/users`, never in the Auth.js config, so it is unit-testable without a request context. `role` is copied into the JWT at sign-in and re-exposed on the session.

**Tech Stack:** Next.js 16, Auth.js v5 beta.32, `@node-rs/argon2`, Zod, Mongoose 9, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-08-20-shrinkless-design.md`

## Global Constraints

- **`verify(hash, password)` takes the hash FIRST.** Reversing the arguments fails open-ish in confusing ways — always hash first, password second.
- **Never reveal whether an email exists.** Login failures return one generic message for both "no such user" and "wrong password", and the verify path runs an argon2 comparison even when the user is missing, so response timing does not leak existence.
- **`session.strategy` must be `'jwt'`.** The Credentials provider does not support database sessions.
- **Roles are never self-assigned.** `createUser` always writes `role: 'customer'`. Admins come only from `scripts/seed-admin.ts`.
- **`signIn` throws inside Server Actions.** Auth.js redirects on the web flow but throws `CredentialsSignin` in a server-side form action — every call must be wrapped in try/catch.
- **NO STYLING.** Forms are semantic HTML. Design lands in Phase 6.
- **Commit after every task.**

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/validation/auth.ts` | Zod schemas for register and login |
| `lib/services/users.ts` | User creation, credential verification, lookup |
| `auth.ts` | Auth.js config; exports `handlers`, `auth`, `signIn`, `signOut` |
| `types/next-auth.d.ts` | Module augmentation adding `id` and `role` to the session |
| `app/api/auth/[...nextauth]/route.ts` | Re-exports the Auth.js handlers |
| `app/actions/auth.ts` | Server Actions: register, login, logout |
| `app/(account)/login/page.tsx` | Login form |
| `app/(account)/register/page.tsx` | Registration form |
| `app/(account)/account/page.tsx` | Account overview, protected |
| `components/account/AuthForm.tsx` | Shared client form with pending/error state |

---

## Task 1: Auth validation schemas

**Files:**
- Create: `lib/validation/auth.ts`, `tests/unit/validation/auth.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `registerSchema`, `loginSchema`, and their inferred types

- [ ] **Step 1: Write the failing test**

Create `tests/unit/validation/auth.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from '@/lib/validation/auth';

describe('registerSchema', () => {
  it('accepts a valid registration', () => {
    const parsed = registerSchema.parse({
      email: 'Buyer@Example.com',
      password: 'a-strong-password',
      name: 'A Buyer',
    });

    expect(parsed.email).toBe('buyer@example.com');
    expect(parsed.name).toBe('A Buyer');
  });

  it('lowercases and trims the email', () => {
    expect(registerSchema.parse({
      email: '  MiXeD@Example.com ',
      password: 'a-strong-password',
    }).email).toBe('mixed@example.com');
  });

  it('rejects an invalid email', () => {
    expect(() => registerSchema.parse({ email: 'nope', password: 'a-strong-password' })).toThrow();
  });

  it('rejects a password under 8 characters', () => {
    expect(() => registerSchema.parse({ email: 'a@b.com', password: 'short12' })).toThrow();
  });

  it('accepts a password of exactly 8 characters', () => {
    expect(registerSchema.parse({ email: 'a@b.com', password: '12345678' }).password).toBe('12345678');
  });

  it('defaults name to an empty string', () => {
    expect(registerSchema.parse({ email: 'a@b.com', password: 'a-strong-password' }).name).toBe('');
  });
});

describe('loginSchema', () => {
  it('accepts any non-empty password', () => {
    const parsed = loginSchema.parse({ email: 'a@b.com', password: 'x' });
    expect(parsed.password).toBe('x');
  });

  it('rejects an empty password', () => {
    expect(() => loginSchema.parse({ email: 'a@b.com', password: '' })).toThrow();
  });
});
```

`loginSchema` deliberately does **not** enforce the 8-character minimum. Login must accept whatever the user types so it can fail on credentials rather than on validation — otherwise the form leaks that short passwords cannot exist.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- validation/auth`
Expected: FAIL — cannot resolve `@/lib/validation/auth`.

- [ ] **Step 3: Implement**

Create `lib/validation/auth.ts`:

```ts
import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email());

export const registerSchema = z.object({
  email,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().trim().default(''),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
```

> **Zod 4 note:** top-level `z.email()` replaces the deprecated `z.string().email()`. Verified working with the installed Zod 4.4.3, including the `trim().toLowerCase()` pipe.

- [ ] **Step 4: Run the tests**

Run: `npm test -- validation/auth`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add auth validation schemas"
```

---

## Task 2: Users service

**Files:**
- Create: `lib/services/users.ts`, `tests/unit/services/users.test.ts`

**Interfaces:**
- Consumes: `User` model, `connectToDatabase`
- Produces:
  - `createUser(input: RegisterInput): Promise<UserDTO>` — throws `EmailTakenError`
  - `verifyCredentials(email: string, password: string): Promise<UserDTO | null>`
  - `getUserById(id: string): Promise<UserDTO | null>`
  - `UserDTO = { id: string; email: string; name: string; role: 'customer' | 'admin' }`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/services/users.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- services/users`
Expected: FAIL — cannot resolve `@/lib/services/users`.

- [ ] **Step 3: Implement**

Create `lib/services/users.ts`:

```ts
import { Types } from 'mongoose';
import { hash, verify } from '@node-rs/argon2';
import { connectToDatabase } from '@/lib/db/connection';
import { User } from '@/lib/db/models/user';
import type { RegisterInput } from '@/lib/validation/auth';

export type UserDTO = {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'admin';
};

export class EmailTakenError extends Error {
  constructor(email: string) {
    super(`An account already exists for ${email}`);
    this.name = 'EmailTakenError';
  }
}

/**
 * A real argon2 hash of a throwaway value. When no user matches, we verify
 * against this so a missing account costs the same time as a wrong password
 * and cannot be detected by timing.
 *
 * Computed lazily and cached rather than with a top-level await: `tsx`
 * transforms scripts to CJS, which rejects top-level await outright.
 */
let dummyHashPromise: Promise<string> | null = null;

function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hash('shrinkless-dummy-password');
  return dummyHashPromise;
}

type UserShape = {
  _id: Types.ObjectId;
  email: string;
  name: string;
  role: string;
};

function toUserDTO(user: UserShape): UserDTO {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role === 'admin' ? 'admin' : 'customer',
  };
}

export async function createUser(input: RegisterInput): Promise<UserDTO> {
  await connectToDatabase();

  const existing = await User.findOne({ email: input.email }).lean();
  if (existing) throw new EmailTakenError(input.email);

  try {
    const created = await User.create({
      email: input.email,
      passwordHash: await hash(input.password),
      name: input.name,
      role: 'customer', // never taken from input
    });

    return toUserDTO(created as unknown as UserShape);
  } catch (error) {
    // The unique index is the real guard; the check above is only a nicety.
    if (error instanceof Error && error.message.includes('duplicate key')) {
      throw new EmailTakenError(input.email);
    }
    throw error;
  }
}

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<UserDTO | null> {
  await connectToDatabase();

  const normalised = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalised }).lean();

  if (!user) {
    await verify(await getDummyHash(), password).catch(() => false);
    return null;
  }

  const valid = await verify(user.passwordHash, password).catch(() => false);
  if (!valid) return null;

  return toUserDTO(user as unknown as UserShape);
}

export async function getUserById(id: string): Promise<UserDTO | null> {
  if (!Types.ObjectId.isValid(id)) return null;

  await connectToDatabase();
  const user = await User.findById(id).lean();

  return user ? toUserDTO(user as unknown as UserShape) : null;
}
```

`role: 'customer'` is written literally rather than spread from `input`, so a crafted request body cannot create an admin. The test that smuggles `role: 'admin'` exists to keep that true.

- [ ] **Step 4: Run the tests**

Run: `npm test -- services/users`
Expected: 10 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add users service with argon2 credential verification"
```

---

## Task 3: Auth.js configuration

**Files:**
- Create: `auth.ts`, `types/next-auth.d.ts`, `app/api/auth/[...nextauth]/route.ts`
- Modify: `lib/env.ts` (AUTH_SECRET is already required — no change expected)

**Interfaces:**
- Consumes: `verifyCredentials`, `loginSchema`
- Produces: `handlers`, `auth`, `signIn`, `signOut`

- [ ] **Step 1: Augment the session types**

Create `types/next-auth.d.ts`:

```ts
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'customer' | 'admin';
    } & DefaultSession['user'];
  }

  interface User {
    role?: 'customer' | 'admin';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: 'customer' | 'admin';
  }
}
```

Without this, `session.user.role` is a type error everywhere it is read.

- [ ] **Step 2: Write the config**

Create `auth.ts` at the project root:

```ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { loginSchema } from '@/lib/validation/auth';
import { verifyCredentials } from '@/lib/services/users';

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await verifyCredentials(parsed.data.email, parsed.data.password);
        if (!user) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      // `user` is only present on the sign-in pass.
      if (user) {
        token.id = user.id;
        token.role = user.role ?? 'customer';
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? '';
        session.user.role = token.role ?? 'customer';
      }
      return session;
    },
  },
});
```

`authorize` returns `null` for every failure — bad schema, unknown user, wrong password — so the client cannot distinguish them.

- [ ] **Step 3: Expose the route handlers**

Create `app/api/auth/[...nextauth]/route.ts`:

```ts
export { GET, POST } from '@/auth';
```

- [ ] **Step 4: Verify it compiles and builds**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: `/api/auth/[...nextauth]` appears in the route list.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: configure Auth.js v5 with credentials and role-aware JWT"
```

---

## Task 4: Auth Server Actions

**Files:**
- Create: `app/actions/auth.ts`

**Interfaces:**
- Consumes: `createUser`, `signIn`, `signOut`, `readCartId`, `mergeGuestCartIntoUserCart`, `persistCartId`, `auth`
- Produces:
  - `registerAction(formData: FormData): Promise<AuthResult>`
  - `loginAction(formData: FormData): Promise<AuthResult>`
  - `logoutAction(): Promise<void>`
  - `AuthResult = { ok: true } | { ok: false; error: string }`

- [ ] **Step 1: Write the actions**

Create `app/actions/auth.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { AuthError } from 'next-auth';
import { auth, signIn, signOut } from '@/auth';
import { EmailTakenError, createUser } from '@/lib/services/users';
import { loginSchema, registerSchema } from '@/lib/validation/auth';
import { mergeGuestCartIntoUserCart } from '@/lib/services/cart';
import { persistCartId, readCartId } from '@/lib/cart-session';

export type AuthResult = { ok: true } | { ok: false; error: string };

const GENERIC_LOGIN_ERROR = 'That email and password combination is not correct.';

/**
 * After a successful sign-in, fold any guest cart into the account cart so a
 * shopper who filled a basket before logging in does not lose it.
 */
async function mergeCartForCurrentUser(): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  const guestCartId = await readCartId();

  if (!userId || !guestCartId) return;

  try {
    const mergedId = await mergeGuestCartIntoUserCart(guestCartId, userId);
    await persistCartId(mergedId);
  } catch {
    // A missing or already-merged cart must never block signing in.
  }
}

export async function registerAction(formData: FormData): Promise<AuthResult> {
  const parsed = registerSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name') ?? '',
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check your details.' };
  }

  try {
    await createUser(parsed.data);
  } catch (error) {
    if (error instanceof EmailTakenError) {
      return { ok: false, error: 'An account with that email already exists.' };
    }
    return { ok: false, error: 'Could not create your account. Try again.' };
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch {
    // The account exists; let them sign in manually rather than failing hard.
    redirect('/login');
  }

  await mergeCartForCurrentUser();
  revalidatePath('/', 'layout');
  redirect('/account');
}

export async function loginAction(formData: FormData): Promise<AuthResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: GENERIC_LOGIN_ERROR };
    }
    throw error;
  }

  await mergeCartForCurrentUser();
  revalidatePath('/', 'layout');
  redirect('/account');
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirect: false });
  revalidatePath('/', 'layout');
  redirect('/');
}
```

> **Two traps this code is written around.**
> 1. `redirect()` throws a control-flow signal that Next catches. It must be called **outside** the try/catch, or the catch swallows the redirect and the user sits on a dead form.
> 2. `signIn` throws `CredentialsSignin` (an `AuthError`) inside Server Actions instead of redirecting. Unwrapped, that surfaces as a 500 rather than a friendly message.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add register, login, and logout Server Actions"
```

---

## Task 5: Login and registration pages

**Files:**
- Create: `app/(account)/login/page.tsx`, `app/(account)/register/page.tsx`, `components/account/AuthForm.tsx`

**Interfaces:**
- Consumes: `registerAction`, `loginAction`, `auth`
- Produces: `/login` and `/register`

- [ ] **Step 1: Write the shared form island**

Create `components/account/AuthForm.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import type { AuthResult } from '@/app/actions/auth';

type Props = {
  action: (formData: FormData) => Promise<AuthResult>;
  submitLabel: string;
  includeName?: boolean;
};

export function AuthForm({ action, submitLabel, includeName = false }: Props) {
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError('');
    startTransition(async () => {
      const result = await action(formData);
      // A successful action redirects, so reaching here means it failed.
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit}>
      {includeName && (
        <label>
          Name
          <input type="text" name="name" autoComplete="name" />
        </label>
      )}

      <label>
        Email
        <input type="email" name="email" required autoComplete="email" />
      </label>

      <label>
        Password
        <input
          type="password"
          name="password"
          required
          autoComplete={includeName ? 'new-password' : 'current-password'}
        />
      </label>

      <button type="submit" disabled={pending}>
        {pending ? 'Working…' : submitLabel}
      </button>

      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
```

- [ ] **Step 2: Write the login page**

Create `app/(account)/login/page.tsx`:

```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loginAction } from '@/app/actions/auth';
import { AuthForm } from '@/components/account/AuthForm';

export const metadata = { title: 'Sign in' };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect('/account');

  return (
    <div>
      <h1>Sign in</h1>
      <AuthForm action={loginAction} submitLabel="Sign in" />
      <p>
        No account? <Link href="/register">Create one</Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Write the registration page**

Create `app/(account)/register/page.tsx`:

```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { registerAction } from '@/app/actions/auth';
import { AuthForm } from '@/components/account/AuthForm';

export const metadata = { title: 'Create an account' };

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) redirect('/account');

  return (
    <div>
      <h1>Create an account</h1>
      <AuthForm action={registerAction} submitLabel="Create account" includeName />
      <p>
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </div>
  );
}
```

Both pages bounce a signed-in visitor to `/account` rather than showing a login form to someone already logged in.

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: `/login` and `/register` appear in the route list.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add login and registration pages"
```

---

## Task 6: Account page and header session state

**Files:**
- Create: `app/(account)/account/page.tsx`, `components/account/LogoutButton.tsx`
- Modify: `app/(shop)/layout.tsx`

**Interfaces:**
- Consumes: `auth`, `logoutAction`
- Produces: `/account`, protected; header reflects sign-in state

- [ ] **Step 1: Write the logout button**

Create `components/account/LogoutButton.tsx`:

```tsx
'use client';

import { useTransition } from 'react';
import { logoutAction } from '@/app/actions/auth';

export function LogoutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button type="button" disabled={pending} onClick={() => startTransition(logoutAction)}>
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
```

- [ ] **Step 2: Write the account page**

Create `app/(account)/account/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { LogoutButton } from '@/components/account/LogoutButton';

export const metadata = { title: 'Your account' };

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <div>
      <h1>Your account</h1>
      <dl>
        <dt>Name</dt>
        <dd>{session.user.name || 'Not set'}</dd>
        <dt>Email</dt>
        <dd>{session.user.email}</dd>
      </dl>

      <section aria-labelledby="orders-heading">
        <h2 id="orders-heading">Orders</h2>
        <p>Your order history will appear here once checkout is live.</p>
      </section>

      <LogoutButton />
    </div>
  );
}
```

The order list is deliberately a placeholder: the orders service does not exist until Phase 5, and stubbing a fake one would be worse than saying so.

- [ ] **Step 3: Show session state in the header**

In `app/(shop)/layout.tsx`, import `auth` and include it in the existing `Promise.all`:

```tsx
import { auth } from '@/auth';
// ...
const [settings, cart, session] = await Promise.all([
  getStoreSettings(),
  readCartView(),
  auth(),
]);
```

Then replace the About list item with an account-aware link:

```tsx
<li>
  {session?.user ? (
    <Link href="/account">Account</Link>
  ) : (
    <Link href="/login">Sign in</Link>
  )}
</li>
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: `/account` appears in the route list.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add account page and session-aware header"
```

---

## Task 7: Runtime verification

**Files:**
- Modify: none (verification only)

**Interfaces:**
- Consumes: everything above
- Produces: proof that registration, login, logout, and cart merging work against the real database

> **Environment note:** run the dev server and every request through the **PowerShell** tool. The Bash sandbox blocks raw TCP/DNS, so anything touching MongoDB fails there.

- [ ] **Step 1: Start the dev server**

```powershell
Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npm run dev > dev-out.log 2> dev-err.log" -WindowStyle Hidden
Start-Sleep -Seconds 20
Get-Content dev-out.log -Tail 8
```

- [ ] **Step 2: Check the pages respond**

```powershell
foreach ($path in '/login', '/register', '/account') {
  $code = 0
  try { $code = (Invoke-WebRequest -Uri "http://localhost:3000$path" -UseBasicParsing -TimeoutSec 60).StatusCode }
  catch { $code = $_.Exception.Response.StatusCode.value__ }
  "$path -> $code"
}
```

Expected: `/login` and `/register` return 200. `/account` redirects to `/login` for an anonymous visitor — `Invoke-WebRequest` follows redirects, so a 200 whose content contains "Sign in" is the correct result.

- [ ] **Step 3: Confirm `/account` is actually protected**

```powershell
$r = Invoke-WebRequest -Uri "http://localhost:3000/account" -UseBasicParsing -TimeoutSec 60
"final url: " + $r.BaseResponse.RequestMessage.RequestUri
"shows sign-in form: " + [bool]($r.Content -match 'Sign in')
```

Expected: the final URL is `/login`. An anonymous user must never see account content.

- [ ] **Step 4: Verify registration and login against the database**

Register through the real form flow is hard to script, so verify the service layer directly against Atlas:

```powershell
@'
import { connectToDatabase, disconnectFromDatabase } from "@/lib/db/connection";
import { createUser, verifyCredentials } from "@/lib/services/users";
import { User } from "@/lib/db/models/user";

async function main() {
  await connectToDatabase();
  const email = `probe-${Date.now()}@example.com`;

  const created = await createUser({ email, password: "a-strong-password", name: "Probe" });
  console.log("created role:", created.role);

  console.log("correct password:", (await verifyCredentials(email, "a-strong-password")) !== null);
  console.log("wrong password:", (await verifyCredentials(email, "nope")) === null);
  console.log("unknown email:", (await verifyCredentials("nobody@example.com", "x")) === null);

  await User.deleteOne({ email });
  console.log("probe user removed");
  await disconnectFromDatabase();
}
main().catch((e) => { console.error(e); process.exit(1); });
'@ | Out-File -FilePath tmp-auth-probe.ts -Encoding utf8

npx tsx --env-file=.env.local tmp-auth-probe.ts
Remove-Item tmp-auth-probe.ts
```

Expected: role `customer`, correct password true, wrong password true, unknown email true, probe user removed.

- [ ] **Step 5: Exercise the browser flow**

Open `http://localhost:3000/register`, create an account, and confirm you land on `/account` with the header showing "Account". Add an item to the cart while signed out first, then sign in, and confirm the cart survives the merge. This is the one path that cannot be scripted, because it depends on the full cookie and redirect round-trip.

- [ ] **Step 6: Stop the server and clean up**

```powershell
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item dev-out.log, dev-err.log -ErrorAction SilentlyContinue
```

- [ ] **Step 7: Run the full check suite**

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: verify auth flows against the live database"
```

---

## Definition of Done

- [ ] A visitor can register, and lands signed in
- [ ] A registered user can sign in and sign out
- [ ] `/account` redirects anonymous visitors to `/login`
- [ ] `/login` and `/register` redirect signed-in users to `/account`
- [ ] Login failures show one generic message for both unknown email and wrong password
- [ ] `createUser` cannot produce an admin, even with `role` in the payload
- [ ] A guest cart survives signing in
- [ ] `session.user.role` is typed and populated
- [ ] `npm test`, `tsc --noEmit`, `lint`, and `build` are all clean

## Not In This Plan

| Deferred | Lands in |
|---|---|
| `proxy.ts` gating `/admin/*` | Phase 4, alongside the admin pages it protects |
| Order history on `/account` | Phase 5, when orders exist |
| Saved addresses | Phase 5, when checkout needs them |
| Password reset by email | Post-v1; needs Resend templates and a token table |
| Rate limiting on login | Phase 7 hardening |
