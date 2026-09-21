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
    <form action={handleSubmit} className="sh-form">
      {includeName && (
        <label className="sh-field">
          <span className="sh-field__label">Name</span>
          <input type="text" name="name" autoComplete="name" className="sh-input" />
        </label>
      )}

      <label className="sh-field">
        <span className="sh-field__label">Email</span>
        <input type="email" name="email" required autoComplete="email" className="sh-input" />
      </label>

      <label className="sh-field">
        <span className="sh-field__label">Password</span>
        <input
          type="password"
          name="password"
          required
          className="sh-input"
          autoComplete={includeName ? 'new-password' : 'current-password'}
        />
      </label>

      <button type="submit" className="sh-btn sh-btn--block" disabled={pending}>
        {pending ? 'Working…' : submitLabel}
      </button>

      {error ? <p role="alert" className="sh-notice sh-notice--error">{error}</p> : null}
    </form>
  );
}
