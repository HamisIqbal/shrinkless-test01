'use client';

import { useActionState, useEffect, useRef } from 'react';
import {
  submitWholesaleEnquiryAction,
  type WholesaleEnquiryState,
} from '@/app/actions/wholesale';
import { useToast } from '@/components/ui/Toast';
import type { WholesaleTier } from '@/lib/wholesale/pricing';

/** What a chosen quantity contributes to the enquiry. */
export type ChosenLine = {
  slug: string;
  title: string;
  tier: WholesaleTier;
  unitPriceCents: number;
  totalCents: number;
};

type Props = {
  lines: ChosenLine[];
  /** Clears the chosen tiers once the enquiry is away. */
  onSent: () => void;
};

const INITIAL: WholesaleEnquiryState = { status: 'idle' };

/**
 * Who to send the quote to.
 *
 * The styles travel as repeated hidden `line` fields holding `slug:tier` — no
 * price, no title, no total. The action re-reads all three from the database,
 * so the worst a doctored submission can do is ask about a style at a
 * quantity, which is what the form is for.
 *
 * The button is disabled until something is chosen, and says why. A trade form
 * that accepts an empty enquiry produces an email nobody can answer.
 */
export function WholesaleEnquiryForm({ lines, onSent }: Props) {
  const [state, formAction, pending] = useActionState(
    submitWholesaleEnquiryAction,
    INITIAL,
  );

  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  // The action is the external system; this reflects whatever came back. A
  // successful send empties both halves of the page — the contact fields here
  // and the chosen tiers on the sheet — because leaving a sent enquiry sitting
  // on screen invites a buyer to press the button again.
  useEffect(() => {
    if (state.status === 'idle') return;

    if (state.status === 'error') {
      toast(state.message, 'error');
      return;
    }

    toast(`${state.message} Reference ${state.reference}.`, 'ok');
    formRef.current?.reset();
    onSent();
  }, [state, toast, onSent]);

  const empty = lines.length === 0;

  return (
    <form action={formAction} ref={formRef} className="tradeform">
      {lines.map((line) => (
        <input
          key={line.slug}
          type="hidden"
          name="line"
          value={`${line.slug}:${line.tier}`}
        />
      ))}

      <div className="tradeform__field">
        <label htmlFor="wholesale-company">Company</label>
        <input
          id="wholesale-company"
          name="company"
          required
          maxLength={120}
          autoComplete="organization"
        />
      </div>

      <div className="tradeform__field">
        <label htmlFor="wholesale-name">Your name</label>
        <input
          id="wholesale-name"
          name="contactName"
          required
          maxLength={120}
          autoComplete="name"
        />
      </div>

      <div className="tradeform__pair">
        <div className="tradeform__field">
          <label htmlFor="wholesale-email">Email</label>
          <input
            id="wholesale-email"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
        </div>

        <div className="tradeform__field">
          <label htmlFor="wholesale-phone">
            Phone <span className="tradeform__hint">optional</span>
          </label>
          <input
            id="wholesale-phone"
            name="phone"
            type="tel"
            maxLength={40}
            autoComplete="tel"
          />
        </div>
      </div>

      <div className="tradeform__field">
        <label htmlFor="wholesale-country">Shipping to</label>
        <input
          id="wholesale-country"
          name="country"
          required
          maxLength={80}
          autoComplete="country-name"
        />
      </div>

      <div className="tradeform__field">
        <label htmlFor="wholesale-message">
          Anything else <span className="tradeform__hint">optional</span>
        </label>
        <textarea
          id="wholesale-message"
          name="message"
          rows={3}
          maxLength={2000}
          placeholder="Colourways, size ratio, the date you need it by."
        />
      </div>

      <button
        type="submit"
        className="btn btn--block tradeform__send"
        disabled={pending || empty}
      >
        {pending ? 'Sending' : 'Request a quote'}
      </button>

      <p className="tradeform__note" aria-live="polite">
        {empty
          ? 'Choose a quantity above.'
          : 'We reply to trade enquiries within one business day.'}
      </p>
    </form>
  );
}
