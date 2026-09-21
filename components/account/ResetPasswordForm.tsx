'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { resetPasswordAction } from '@/app/actions/auth';

/**
 * The second half of a reset.
 *
 * The token rides in a hidden field rather than being read from the URL by
 * this component, because the page has already checked it server-side — the
 * form is only ever rendered when there is something worth typing into.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const [error, setError] = useState('');
  const [dead, setDead] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError('');

    startTransition(async () => {
      const result = await resetPasswordAction(formData);

      // Success redirects, so reaching here means it failed.
      if (!result.ok) {
        setError(result.error);
        setDead(Boolean(result.expired));
      }
    });
  }

  return (
    <form action={handleSubmit} className="sh-form">
      <input type="hidden" name="token" value={token} />

      <label className="sh-field">
        <span className="sh-field__label">New password</span>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="sh-input"
        />
        <small className="sh-field__hint">At least 8 characters.</small>
      </label>

      <label className="sh-field">
        <span className="sh-field__label">Confirm new password</span>
        <input
          type="password"
          name="confirm"
          required
          minLength={8}
          autoComplete="new-password"
          className="sh-input"
        />
      </label>

      <button type="submit" className="sh-btn sh-btn--block" disabled={pending || dead}>
        {pending ? 'Saving…' : 'Set new password'}
      </button>

      {error ? <p role="alert" className="sh-notice sh-notice--error">{error}</p> : null}

      {dead ? (
        <p className="sh-swap">
          <Link href="/forgot-password" className="sh-link">Ask for a new link</Link>
        </p>
      ) : null}
    </form>
  );
}
