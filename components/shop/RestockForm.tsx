'use client';

import { useActionState, useEffect } from 'react';
import { notifyRestockAction, type NewsletterState } from '@/app/actions/newsletter';
import { useToast } from '@/components/ui/Toast';

const INITIAL: NewsletterState = { status: 'idle' };

type Props = {
  slug: string;
  color: string;
};

/**
 * What a sold-out product has instead of a buy button.
 *
 * The size chips, the quantity and both purchase actions come off the page
 * entirely when a colourway is out — every one of them was a control that
 * could not be used, and a row of struck-through sizes above a disabled button
 * asks a shopper to work out for themselves that there is nothing here. This
 * says it once, in the largest type on the page, and then asks for the one
 * thing still worth collecting.
 *
 * The colourway is part of the record: "tell me when the olive is back" is a
 * different request from "tell me when the bone is back", and a shop that
 * emails the wrong one has wasted the only message it was given permission to
 * send.
 */
export function RestockForm({ slug, color }: Props) {
  const [state, formAction, pending] = useActionState(notifyRestockAction, INITIAL);
  const toast = useToast();

  useEffect(() => {
    if (state.status === 'idle') return;
    toast(state.message, state.status === 'error' ? 'error' : 'ok');
  }, [state, toast]);

  const done = state.status === 'ok';

  return (
    <div className="restock">
      <p className="restock__mark" aria-label={`${color} is sold out`}>
        Sold out
      </p>

      {done ? (
        <p className="restock__done">
          You&rsquo;re on the list for {color}. We&rsquo;ll email you the moment it is back.
        </p>
      ) : (
        <>
          <p className="restock__lede">
            The {color} is out for now. Leave your email and we&rsquo;ll tell you the
            moment it is back — no newsletter, just this one message.
          </p>

          <form action={formAction} className="signup restock__form">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="color" value={color} />

            <label htmlFor="restock-email" className="visually-hidden">
              Email address
            </label>

            <input
              id="restock-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="Email address"
              className="signup__input restock__input"
            />

            <button type="submit" className="btn btn--accent restock__submit" disabled={pending}>
              {pending ? 'Saving' : 'Notify me'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
