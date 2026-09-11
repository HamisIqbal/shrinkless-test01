'use client';

import { useState, useTransition } from 'react';
import type { AuthResult } from '@/app/actions/auth';

type Props = {
  action: (formData: FormData) => Promise<AuthResult>;
  submitLabel: string;
  includeName?: boolean;
};

type Challenge = { sentTo: string; email: string; password: string };

/**
 * One form, two possible steps.
 *
 * Registering and a customer sign-in finish in one pass. An admin sign-in
 * comes back asking for a mailed code, and the form swaps to a code field
 * while carrying the credentials it already has in hidden inputs — the second
 * pass has to prove the password again, because the server never trusts a
 * "this password was fine a moment ago" flag from the browser.
 */
export function AuthForm({ action, submitLabel, includeName = false }: Props) {
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [pending, startTransition] = useTransition();

  function run(formData: FormData, credentials: { email: string; password: string }) {
    setError('');

    startTransition(async () => {
      const result = await action(formData);

      if ('step' in result) {
        setChallenge({ ...credentials, sentTo: result.sentTo });
        setError(result.error ?? '');
        setNotice(result.error ? '' : `Code sent to ${result.sentTo}.`);
        return;
      }

      // A successful action redirects, so reaching here means it failed.
      if (!result.ok) setError(result.error);
    });
  }

  function handleSubmit(formData: FormData) {
    run(formData, {
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
    });
  }

  function handleCode(formData: FormData) {
    if (!challenge) return;
    formData.set('email', challenge.email);
    formData.set('password', challenge.password);
    run(formData, challenge);
  }

  function resend() {
    if (!challenge) return;

    const formData = new FormData();
    formData.set('email', challenge.email);
    formData.set('password', challenge.password);
    setNotice('');
    run(formData, challenge);
  }

  function startOver() {
    setChallenge(null);
    setError('');
    setNotice('');
  }

  if (challenge) {
    return (
      <form action={handleCode} className="authform">
        <p className="lede authform__step">
          This account is an admin, so it takes a second factor. We emailed a
          six-digit code to <strong>{challenge.sentTo}</strong>.
        </p>

        <label className="field">
          Six-digit code
          <input
            type="text"
            name="code"
            required
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            className="input codeinput tnum"
            placeholder="000000"
          />
        </label>

        <button type="submit" className="btn btn--block authform__submit" disabled={pending}>
          {pending ? 'Checking…' : 'Verify and sign in'}
        </button>

        <div className="authform__aside">
          <button type="button" className="ulink" onClick={resend} disabled={pending}>
            Send a new code
          </button>
          <button type="button" className="ulink" onClick={startOver} disabled={pending}>
            Start over
          </button>
        </div>

        {error ? <p role="alert" className="notice notice--error">{error}</p> : null}
        {!error && notice ? <p className="notice notice--ok">{notice}</p> : null}
      </form>
    );
  }

  return (
    <form action={handleSubmit} className="authform">
      {includeName && (
        <label className="field">
          Name
          <input type="text" name="name" autoComplete="name" className="input" />
        </label>
      )}

      <label className="field">
        Email
        <input type="email" name="email" required autoComplete="email" className="input" />
      </label>

      <label className="field">
        Password
        <input
          type="password"
          name="password"
          required
          className="input"
          autoComplete={includeName ? 'new-password' : 'current-password'}
        />
      </label>

      <button type="submit" className="btn btn--block authform__submit" disabled={pending}>
        {pending ? 'Working…' : submitLabel}
      </button>

      {error ? <p role="alert" className="notice notice--error">{error}</p> : null}
    </form>
  );
}
