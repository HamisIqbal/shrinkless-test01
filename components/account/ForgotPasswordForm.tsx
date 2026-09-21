'use client';

import { useState, useTransition } from 'react';
import { requestPasswordResetAction } from '@/app/actions/auth';

/**
 * One field, one answer.
 *
 * The success message is the same whether or not an account exists, so the
 * form stays a way back into an account rather than a way to find out who has
 * one. The field is cleared and the button retired on success: the useful next
 * step is the inbox, not this page.
 */
export function ForgotPasswordForm() {
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError('');

    startTransition(async () => {
      const result = await requestPasswordResetAction(formData);

      if (result.ok) {
        setSent(result.message);
        return;
      }

      setSent('');
      setError(result.error);
    });
  }

  if (sent) {
    return (
      <div className="sh-form">
        <p className="sh-notice">{sent}</p>
        <p className="sh-body">
          Nothing arrived? Check the spam folder before asking again — every
          request retires the previous link.
        </p>
        <button type="button" className="sh-link" onClick={() => setSent('')}>
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="sh-form">
      <label className="sh-field">
        <span className="sh-field__label">Email</span>
        <input type="email" name="email" required autoComplete="email" className="sh-input" />
      </label>

      <button type="submit" className="sh-btn sh-btn--block" disabled={pending}>
        {pending ? 'Sending…' : 'Email me a reset link'}
      </button>

      {error ? <p role="alert" className="sh-notice sh-notice--error">{error}</p> : null}
    </form>
  );
}
