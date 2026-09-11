/**
 * Outbound mail, over Resend's HTTP API.
 *
 * A direct `fetch` rather than the SDK: one POST, no retries worth
 * inheriting, and nothing here that a dependency would do better. The API key
 * comes from the Vercel Resend integration (`RESEND_API_KEY`).
 */

export type Mail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export class EmailNotConfiguredError extends Error {
  constructor() {
    super('No RESEND_API_KEY is set, so no mail can be sent.');
    this.name = 'EmailNotConfiguredError';
  }
}

export class EmailSendError extends Error {
  constructor(detail: string) {
    super(`The mail provider rejected the send: ${detail}`);
    this.name = 'EmailSendError';
  }
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/** Resend's shared sender. Works with no domain set up; replace it with
 *  `Shrinkless <hello@yourdomain>` once a domain is verified there. */
const DEFAULT_FROM = 'Shrinkless <onboarding@resend.dev>';

export function mailFrom(env: NodeJS.ProcessEnv = process.env): string {
  return env.EMAIL_FROM?.trim() || DEFAULT_FROM;
}

export async function sendMail(
  mail: Mail,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new EmailNotConfiguredError();

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: mailFrom(env),
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
      ...(mail.html ? { html: mail.html } : {}),
    }),
  });

  if (!response.ok) {
    // The body carries Resend's own reason; it is far more useful than the
    // status alone when a domain or recipient is the problem.
    throw new EmailSendError(`${response.status} ${await response.text()}`);
  }
}
