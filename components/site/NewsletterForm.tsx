'use client';

import { useActionState, useEffect } from 'react';
import { subscribeAction, type NewsletterState } from '@/app/actions/newsletter';
import { useToast } from '@/components/ui/Toast';
import { ArrowIcon } from '@/components/site/icons';

const INITIAL: NewsletterState = { status: 'idle' };

export function NewsletterForm() {
  const [state, formAction, pending] = useActionState(subscribeAction, INITIAL);
  const toast = useToast();

  // The form action is the external system here; this reflects whatever it
  // came back with. `state` is a fresh object per submission, so resubmitting
  // the same address toasts again rather than going quiet.
  useEffect(() => {
    if (state.status === 'idle') return;
    toast(state.message, state.status === 'error' ? 'error' : 'ok');
  }, [state, toast]);

  return (
    <form action={formAction} className="hm-news">
      <label htmlFor="newsletter-email" className="visually-hidden">
        Email address
      </label>

      <input
        id="newsletter-email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="Email address"
        className="hm-news__input"
      />

      <button type="submit" className="hm-news__submit" disabled={pending}>
        {pending ? 'Joining' : 'Join'}
        <ArrowIcon className="hm-news__arrow" />
      </button>
    </form>
  );
}
