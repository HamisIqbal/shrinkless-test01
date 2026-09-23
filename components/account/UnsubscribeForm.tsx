'use client';

import { useActionState } from 'react';
import { unsubscribeAction, type UnsubscribeState } from '@/app/actions/unsubscribe';

const INITIAL: UnsubscribeState = { status: 'idle', message: '' };

export function UnsubscribeForm({ email, token }: { email: string; token: string }) {
  const [state, formAction, pending] = useActionState(unsubscribeAction, INITIAL);

  if (state.status === 'done') {
    return <p role="status" className="sh-notice">{state.message}</p>;
  }

  return (
    <form action={formAction} className="sh-form">
      <input type="hidden" name="e" value={email} />
      <input type="hidden" name="t" value={token} />

      <p className="sh-body">
        Stop all marketing email to <strong>{email}</strong>?
      </p>

      <button type="submit" className="sh-btn sh-btn--block" disabled={pending}>
        {pending ? 'Working…' : 'Unsubscribe'}
      </button>

      {state.status === 'error' ? (
        <p role="alert" className="sh-notice sh-notice--error">{state.message}</p>
      ) : null}
    </form>
  );
}
