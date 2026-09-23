'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { AuthError } from 'next-auth';
import { googleEnabled, signIn, signOut } from '@/auth';
import { EmailTakenError, createUser } from '@/lib/services/users';
import { loginSchema, registerSchema } from '@/lib/validation/auth';
import {
  MAX_RESETS_PER_DAY,
  RESET_TTL_MS,
  requestPasswordReset,
  resetPassword,
} from '@/lib/services/password-reset';
import { passwordResetMail } from '@/lib/email/password-reset';
import { absoluteUrl } from '@/lib/site';
import { forgotPasswordSchema, resetPasswordSchema } from '@/lib/validation/auth';
import { sendMail } from '@/lib/email/send';
import { landingFor, mergeCartForCurrentUser } from '@/lib/auth/after-sign-in';
import { LIMITS, consume, reset, retryAfterMinutes } from '@/lib/security/rate-limit';
import { headers } from 'next/headers';

export type AuthResult = { ok: true } | { ok: false; error: string };

const GENERIC_LOGIN_ERROR = 'That email and password combination is not correct.';
const THROTTLED_ERROR = (minutes: number) =>
  `Too many attempts. Try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`;

/**
 * Best-effort client address, for the per-address limit.
 *
 * A forwarded header can be spoofed, which is exactly why it is only ever the
 * *second* limit — the per-email one does the real work and cannot be dodged
 * by lying about where you are, because the account being attacked is the
 * account named in the form.
 */
async function clientAddress(): Promise<string> {
  const store = await headers();
  const forwarded = store.get('x-forwarded-for') ?? '';

  return forwarded.split(',')[0]?.trim() || 'unknown';
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

  let signedIn = true;
  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch {
    // The account exists; let them sign in manually rather than failing hard.
    signedIn = false;
  }

  if (!signedIn) redirect('/login');

  const role = await mergeCartForCurrentUser();
  revalidatePath('/', 'layout');
  redirect(landingFor(role));
}

/**
 * One pass for everyone. An email and a password that match an account mint
 * the session; an admin lands in the panel rather than the account page.
 */
export async function loginAction(formData: FormData): Promise<AuthResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }

  // Two budgets: one for the account under attack, one for the source. Both
  // are consumed before any password is verified, so a throttled attacker
  // cannot even measure whether an email exists.
  const byEmail = await consume(
    `login:${parsed.data.email}`,
    LIMITS.login.limit,
    LIMITS.login.windowMs,
  );

  const byIp = await consume(
    `login-ip:${await clientAddress()}`,
    LIMITS.loginByIp.limit,
    LIMITS.loginByIp.windowMs,
  );

  if (!byEmail.allowed || !byIp.allowed) {
    const worst = byEmail.allowed ? byIp : byEmail;
    return { ok: false, error: THROTTLED_ERROR(retryAfterMinutes(worst)) };
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // The same answer for a wrong password and an address with no account
      // behind it, so the form cannot be used to enumerate accounts.
      return { ok: false, error: GENERIC_LOGIN_ERROR };
    }
    throw error;
  }

  // A completed sign-in hands the budget back, so a shared address does not
  // accumulate a debt from its own successful logins.
  await reset(`login:${parsed.data.email}`);

  const role = await mergeCartForCurrentUser();
  revalidatePath('/', 'layout');
  redirect(landingFor(role));
}

/**
 * Off to Google. The same button signs in and signs up: the first visit makes
 * the account. Comes back through /auth/continue for the cart and the landing.
 */
export async function googleSignInAction(): Promise<void> {
  if (!googleEnabled) redirect('/login');
  await signIn('google', { redirectTo: '/auth/continue' });
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirect: false });
  revalidatePath('/', 'layout');
  redirect('/');
}

/* --------------------------------------------------------------------------
   Forgotten passwords

   Customers only. An admin password is set out of band with
   `npm run seed:admin`, so a mailbox is never a path into the back office.
   -------------------------------------------------------------------------- */

export type ForgotResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/** The same answer for a customer, an admin, and an address with no account
 *  behind it. Anything else turns this form into a membership check. */
const RESET_SENT_MESSAGE =
  'If that email has a Shrinkless account, a reset link is on its way. It expires in an hour.';

export async function requestPasswordResetAction(
  formData: FormData,
): Promise<ForgotResult> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') });

  if (!parsed.success) {
    return { ok: false, error: 'Enter the email address on your account.' };
  }

  let request;
  try {
    request = await requestPasswordReset(parsed.data.email);
  } catch (error) {
    console.error('password reset request failed', error);
    return { ok: false, error: 'Could not start a reset just now. Try again.' };
  }

  if (request.status === 'throttled') {
    const hours = Math.max(1, Math.ceil(request.retryAfterMs / 3_600_000));

    // The one case that does not get the generic answer. Told plainly because
    // a person who has clicked five times needs to know why the sixth mail
    // never arrives — and because the budget is spent on the address typed in
    // rather than on an account, this still confirms nothing about who has
    // one.
    return {
      ok: false,
      error: `That is ${MAX_RESETS_PER_DAY} reset links for this email in 24 hours, which is the limit. Check your inbox and spam folder, then try again in ${hours} ${
        hours === 1 ? 'hour' : 'hours'
      }.`,
    };
  }

  if (request.status === 'sent') {
    try {
      await sendMail(
        passwordResetMail(
          request.sentTo,
          absoluteUrl(`/reset-password?token=${encodeURIComponent(request.token)}`),
          RESET_TTL_MS / 60_000,
        ),
      );
    } catch (error) {
      // Said out loud rather than swallowed: a shopper waiting for a mail that
      // was never sent will wait forever otherwise.
      console.error('password reset mail failed', error);
      return {
        ok: false,
        error: 'We could not send the email just now. Please try again shortly.',
      };
    }
  }

  return { ok: true, message: RESET_SENT_MESSAGE };
}

export type ResetResult =
  | { ok: true }
  | { ok: false; error: string; expired?: boolean };

const DEAD_LINK_ERROR =
  'That reset link has expired or has already been used. Ask for a new one.';

/**
 * Sets the new password and signs the customer in.
 *
 * Signing them in is safe here and nowhere else: the token proved control of
 * the mailbox, and the password they just chose is the one being used. It also
 * removes the last chance to fumble — typing the new password wrong on a login
 * screen thirty seconds after choosing it.
 */
export async function resetPasswordAction(formData: FormData): Promise<ResetResult> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check your details.' };
  }

  let outcome;
  try {
    outcome = await resetPassword(parsed.data.token, parsed.data.password);
  } catch (error) {
    console.error('password reset failed', error);
    return { ok: false, error: 'Could not set that password. Try again.' };
  }

  if (!outcome.ok) return { ok: false, error: DEAD_LINK_ERROR, expired: true };

  try {
    await signIn('credentials', {
      email: outcome.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch {
    // The password is changed either way; falling back to the sign-in form is
    // an inconvenience, not a failure.
    redirect('/login');
  }

  const role = await mergeCartForCurrentUser();
  revalidatePath('/', 'layout');
  redirect(landingFor(role));
}
