'use client';

import { useState, useTransition } from 'react';
import type { AuthResult } from '@/app/actions/auth';

type Props = {
  action: (formData: FormData) => Promise<AuthResult>;
  submitLabel: string;
  includeName?: boolean;
};

/**
 * One form, one pass.
 *
 * Registering and signing in both finish in a single round trip: a successful
 * action redirects, so anything that comes back here is a failure with a
 * message to show.
 */
export function AuthForm({ action, submitLabel, includeName = false }: Props) {
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError('');

    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) setError(result.error);
    });
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
