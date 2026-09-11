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
    <form action={handleSubmit} className="authform">
      <input type="hidden" name="token" value={token} />

      <label className="field">
        New password
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="input"
        />
        <small className="checkoutform__hint">At least 8 characters.</small>
      </label>

      <label className="field">
        Confirm new password
        <input
          type="password"
          name="confirm"
          required
          minLength={8}
          autoComplete="new-password"
          className="input"
        />
      </label>

      <button type="submit" className="btn btn--block authform__submit" disabled={pending || dead}>
        {pending ? 'Saving…' : 'Set new password'}
      </button>

      {error ? <p role="alert" className="notice notice--error">{error}</p> : null}

      {dead ? (
        <p className="authswap">
          <Link href="/forgot-password" className="ulink">Ask for a new link</Link>
        </p>
      ) : null}
    </form>
  );
}
