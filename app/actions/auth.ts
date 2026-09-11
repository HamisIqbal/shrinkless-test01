'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { AuthError } from 'next-auth';
import { auth, signIn, signOut } from '@/auth';
import { EmailTakenError, createUser, verifyCredentials } from '@/lib/services/users';
import { loginSchema, registerSchema } from '@/lib/validation/auth';
import {
  CODE_TTL_MS,
  adminLockState,
  issueAdminChallenge,
} from '@/lib/services/two-factor';
import {
  MAX_RESETS_PER_DAY,
  RESET_TTL_MS,
  requestPasswordReset,
  resetPassword,
} from '@/lib/services/password-reset';
import { passwordResetMail } from '@/lib/email/password-reset';
import { absoluteUrl } from '@/lib/site';
import { forgotPasswordSchema, resetPasswordSchema } from '@/lib/validation/auth';
import { adminCodeMail, adminCodeRecipient, maskEmail } from '@/lib/email/admin-code';
import { sendMail } from '@/lib/email/send';
import { mergeGuestCartIntoUserCart } from '@/lib/services/cart';
import { persistCartId, readCartId } from '@/lib/cart-session';
import { LIMITS, consume, reset, retryAfterMinutes } from '@/lib/security/rate-limit';
import { headers } from 'next/headers';

export type AuthResult =
  | { ok: true }
  | { ok: false; error: string }
  /** The password was right and the account is an admin: a code is in the
   *  mailbox and the form has a second step to render. */
  | { step: 'code'; sentTo: string; error?: string };

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
const BAD_CODE_ERROR = 'That code is not right, or it has expired. Send a new one.';
const LOCKED_ERROR = (minutes: number) =>
  `Too many incorrect codes. Admin sign-in is locked for ${minutes} ${
    minutes === 1 ? 'minute' : 'minutes'
  }.`;
const MAIL_FAILED_ERROR =
  'Your password was right, but the code could not be emailed. Check the mail settings and try again.';

/** Whole minutes, rounded up, for a message a person reads. */
function minutesFrom(ms: number): number {
  return Math.max(1, Math.ceil(ms / 60_000));
}

/**
 * Where a sign-in lands.
 *
 * An admin signs in to work, so the panel is the destination rather than a
 * customer account page they have no use for. `/account` is still there, and
 * the rail's "View store" link is how they leave.
 */
function landingFor(role: string | undefined): string {
  return role === 'admin' ? '/admin' : '/account';
}

/**
 * After a successful sign-in, fold any guest cart into the account cart so a
 * shopper who filled a basket before logging in does not lose it.
 */
async function mergeCartForCurrentUser(): Promise<string | undefined> {
  const session = await auth();
  const userId = session?.user?.id;
  const guestCartId = await readCartId();

  // Returned rather than fetched again by the caller: the session was already
  // read here, and it is the only authority on what the browser now holds.
  const role = session?.user?.role;

  if (!userId || !guestCartId) return role;

  try {
    const mergedId = await mergeGuestCartIntoUserCart(guestCartId, userId);
    await persistCartId(mergedId);
  } catch {
    // A missing or already-merged cart must never block signing in.
  }

  return role;
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
 * Issues a second factor and mails it. Returns the step the form should show.
 *
 * A cooldown-suppressed resend is deliberately indistinguishable from a fresh
 * send in the copy: the live code is still the right one to type.
 */
async function startAdminChallenge(
  userId: string,
  accountEmail: string,
): Promise<AuthResult> {
  const recipient = adminCodeRecipient(accountEmail);
  const masked = maskEmail(recipient);

  let issued;
  try {
    issued = await issueAdminChallenge(userId, recipient);
  } catch {
    return { ok: false, error: 'Could not start the sign-in. Try again.' };
  }

  if (issued.code) {
    try {
      await sendMail(adminCodeMail(recipient, issued.code, CODE_TTL_MS / 60_000));
    } catch (error) {
      // Never strand an admin with a code they cannot read: drop the challenge
      // so the next attempt starts clean, and say what went wrong.
      console.error('admin 2FA mail failed', error);
      return { ok: false, error: MAIL_FAILED_ERROR };
    }
  }

  return { step: 'code', sentTo: masked };
}

/**
 * Two passes for an admin, one for everyone else.
 *
 * Pass one carries the password and gets a code in the mail. Pass two carries
 * the password *and* the code, and only then does signIn() run — so a session
 * is never minted anywhere except behind both factors.
 */
export async function loginAction(formData: FormData): Promise<AuthResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }

  const rawCode = formData.get('code');
  const code = typeof rawCode === 'string' ? rawCode.trim() : '';

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

  if (!code) {
    // Check the password here so a non-admin never pays for a second round
    // trip, and so an admin's code is only ever mailed on a *correct*
    // password — the mailbox is not an oracle for password guessing.
    const user = await verifyCredentials(parsed.data.email, parsed.data.password);
    if (!user) return { ok: false, error: GENERIC_LOGIN_ERROR };

    if (user.role === 'admin') {
      // Five wrong codes closes admin sign-in for an hour. Checked before a
      // new code is issued as well as when one is verified, so a locked-out
      // attacker cannot keep a fresh code arriving in the real admin's inbox.
      const lock = await adminLockState(user.id);
      if (lock.locked) {
        return { ok: false, error: LOCKED_ERROR(minutesFrom(lock.retryAfterMs)) };
      }

      // Mailing a code costs money and fills an inbox, so it gets its own
      // budget on top of the password one.
      const sends = await consume(
        `2fa:${user.id}`,
        LIMITS.twoFactorSend.limit,
        LIMITS.twoFactorSend.windowMs,
      );

      if (!sends.allowed) {
        return { ok: false, error: THROTTLED_ERROR(retryAfterMinutes(sends)) };
      }

      return startAdminChallenge(user.id, user.email);
    }
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      code,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // With a code in hand the password was already proven, so the only new
      // way to fail is the code itself. Keep the form on step two — unless
      // that guess was the one that closed the lock, in which case there is
      // nothing left to type and the form should say so plainly.
      if (code) {
        const user = await verifyCredentials(parsed.data.email, parsed.data.password);
        const lock = user ? await adminLockState(user.id) : null;

        if (lock?.locked) {
          return { ok: false, error: LOCKED_ERROR(minutesFrom(lock.retryAfterMs)) };
        }

        const recipient = adminCodeRecipient(parsed.data.email);
        return { step: 'code', sentTo: maskEmail(recipient), error: BAD_CODE_ERROR };
      }
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

export async function logoutAction(): Promise<void> {
  await signOut({ redirect: false });
  revalidatePath('/', 'layout');
  redirect('/');
}

/* --------------------------------------------------------------------------
   Forgotten passwords

   Customers only. An admin who cannot sign in has a second factor and a
   mailbox; handing that same mailbox the power to replace the password would
   collapse two factors back into one.
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
