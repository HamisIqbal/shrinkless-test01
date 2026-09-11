import type { Mail } from '@/lib/email/send';

/**
 * Where an admin sign-in code goes.
 *
 * `ADMIN_2FA_EMAIL` wins so the second factor can live in a different mailbox
 * from the one on the account — the point of a second factor is that it is
 * somewhere else. With it unset, the account's own address is used.
 */
export function adminCodeRecipient(
  accountEmail: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.ADMIN_2FA_EMAIL?.trim().toLowerCase() || accountEmail;
}

/** `h••••••7@gmail.com` — enough to recognise your own mailbox, not enough to
 *  tell a stranger who holds the second factor. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return email;

  const name = email.slice(0, at);
  const domain = email.slice(at);

  if (name.length <= 2) return `${name[0]}${'•'.repeat(3)}${domain}`;

  return `${name[0]}${'•'.repeat(Math.min(name.length - 2, 6))}${name.at(-1)}${domain}`;
}

export function adminCodeMail(to: string, code: string, minutes: number): Mail {
  const subject = `${code} is your Shrinkless admin code`;

  const text = [
    `Your Shrinkless admin sign-in code is ${code}.`,
    ``,
    `It expires in ${minutes} minutes and can be used once.`,
    `If you did not just try to sign in, your admin password is known to`,
    `someone else — change it now.`,
  ].join('\n');

  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:32rem;margin:0 auto;padding:32px 24px;color:#111">
      <p style="margin:0 0 24px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#666">Shrinkless — admin sign-in</p>
      <p style="margin:0 0 8px;font-size:15px;line-height:1.5">Your sign-in code:</p>
      <p style="margin:0 0 24px;font-size:34px;font-weight:600;letter-spacing:.28em;font-variant-numeric:tabular-nums">${code}</p>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#444">It expires in ${minutes} minutes and can be used once.</p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#444">If you did not just try to sign in, your admin password is known to someone else — change it now.</p>
    </div>
  `.trim();

  return { to, subject, text, html };
}
