import { createHmac, timingSafeEqual } from 'node:crypto';
import { absoluteUrl } from '@/lib/site';

/**
 * Unsubscribe links that cannot be forged.
 *
 * The link carries the address and an HMAC of it under AUTH_SECRET, so the
 * page can act without a login and nobody can unsubscribe an address they
 * were not sent mail at. Every marketing email must carry `unsubscribeUrl()`
 * in its body, and the `List-Unsubscribe` headers from
 * `unsubscribeHeaders()` — CAN-SPAM requires a working opt-out, and Gmail and
 * Yahoo reject bulk mail without the one-click header.
 */

function secret(env: NodeJS.ProcessEnv): string {
  const value = env.AUTH_SECRET?.trim();
  if (!value) throw new Error('AUTH_SECRET is required to sign unsubscribe links.');
  return value;
}

export function unsubscribeToken(email: string, env: NodeJS.ProcessEnv = process.env): string {
  return createHmac('sha256', secret(env))
    .update(`unsubscribe:${email.trim().toLowerCase()}`)
    .digest('base64url');
}

export function verifyUnsubscribeToken(
  email: string,
  token: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!email || !token) return false;

  const expected = Buffer.from(unsubscribeToken(email, env));
  const given = Buffer.from(token);

  return expected.length === given.length && timingSafeEqual(expected, given);
}

function query(email: string, env: NodeJS.ProcessEnv): string {
  const e = encodeURIComponent(email.trim().toLowerCase());
  return `e=${e}&t=${unsubscribeToken(email, env)}`;
}

/** The link a person clicks. Opens a page with a confirm button, so a mail
 *  scanner following links cannot unsubscribe anyone by accident. */
export function unsubscribeUrl(email: string, env: NodeJS.ProcessEnv = process.env): string {
  return absoluteUrl(`/unsubscribe?${query(email, env)}`, env);
}

/** RFC 8058 one-click headers, for the mail provider's API. */
export function unsubscribeHeaders(
  email: string,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  return {
    'List-Unsubscribe': `<${absoluteUrl(`/api/unsubscribe?${query(email, env)}`, env)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
