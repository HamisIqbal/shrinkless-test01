import type { Mail } from '@/lib/email/send';

/**
 * The "set a new password" mail.
 *
 * The link is printed as well as linked. A mail client that strips the anchor,
 * or a shopper reading on a device that is not the one they want to reset on,
 * still has something to work with.
 */
export function passwordResetMail(to: string, url: string, minutes: number): Mail {
  const subject = 'Reset your Shrinkless password';

  const text = [
    `Someone asked to reset the password for this Shrinkless account.`,
    ``,
    `Set a new one here — the link works once and expires in ${minutes} minutes:`,
    url,
    ``,
    `If that was not you, nothing has changed and you can ignore this email.`,
  ].join('\n');

  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:32rem;margin:0 auto;padding:32px 24px;color:#111">
      <p style="margin:0 0 24px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#666">Shrinkless — password reset</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6">Someone asked to reset the password for this account. Set a new one here:</p>
      <p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;padding:12px 20px;background:#171919;color:#fff;text-decoration:none;font-size:14px;letter-spacing:.08em;text-transform:uppercase">Set a new password</a></p>
      <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#444">The link works once and expires in ${minutes} minutes.<br><span style="word-break:break-all;color:#666">${url}</span></p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#444">If that was not you, nothing has changed and you can ignore this email.</p>
    </div>
  `.trim();

  return { to, subject, text, html };
}
