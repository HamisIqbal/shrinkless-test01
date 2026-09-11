'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import {
  AddressElement,
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { startCheckoutAction } from '@/app/actions/checkout';

/**
 * Two steps, one page.
 *
 * Details first, then payment. The alternative — mounting the payment form
 * before an address exists — means the wallet sheet opens without knowing
 * where the parcel goes, and the shopper has to answer the same questions
 * twice.
 *
 * `loadStripe` is memoised outside the render path because calling it again
 * per render would refetch Stripe.js on every keystroke.
 */
const APPEARANCE = {
  // Matched to the storefront rather than left on Stripe's default blue, so
  // the payment step does not look like somebody else's page.
  variables: {
    colorPrimary: '#171919',
    colorText: '#171919',
    colorDanger: '#171919',
    fontFamily: 'inherit',
    fontSizeBase: '15px',
    borderRadius: '10px',
    spacingUnit: '4px',
  },
} as const;

type Step = 'details' | 'payment';

export function CheckoutFlow({
  publishableKey,
  totalCents,
}: {
  publishableKey: string;
  totalCents: number;
}) {
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);

  const [step, setStep] = useState<Step>('details');
  const [clientSecret, setClientSecret] = useState('');

  if (step === 'payment' && clientSecret) {
    return (
      <Elements
        stripe={stripePromise}
        options={{ clientSecret, appearance: APPEARANCE }}
      >
        <PaymentStep
          clientSecret={clientSecret}
          totalCents={totalCents}
          onBack={() => setStep('details')}
        />
      </Elements>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        // Deferred mode: the Address Element needs an Elements context, and
        // there is no intent yet because the address is what creates it.
        mode: 'payment',
        amount: totalCents,
        currency: 'usd',
        appearance: APPEARANCE,
      }}
    >
      <DetailsStep
        onReady={(secret) => {
          setClientSecret(secret);
          setStep('payment');
        }}
      />
    </Elements>
  );
}

/** Said when Stripe.js is not there to talk to — an ad blocker, an offline
 *  moment, a corporate proxy. It is the shopper's only clue, so it says what
 *  to try rather than only that something is wrong. */
const NO_STRIPE =
  'The payment form could not load. Check your connection or any blocker on ' +
  'stripe.com, then reload the page.';

function DetailsStep({ onReady }: { onReady: (clientSecret: string) => void }) {
  const elements = useElements();

  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    // Both of these mean Stripe.js never arrived. Returning quietly, as this
    // did, leaves a shopper pressing a button that does nothing at all and no
    // reason on the page for why.
    if (!elements) {
      setError(NO_STRIPE);
      return;
    }

    const addressElement = elements.getElement(AddressElement);
    if (!addressElement) {
      setError(NO_STRIPE);
      return;
    }

    const { complete, value } = await addressElement.getValue();
    if (!complete) {
      setError('Please finish the shipping address.');
      return;
    }

    setPending(true);

    const result = await startCheckoutAction({
      email,
      shippingAddress: {
        name: value.name,
        line1: value.address.line1,
        line2: value.address.line2 ?? '',
        city: value.address.city,
        state: value.address.state,
        postalCode: value.address.postal_code,
        country: value.address.country,
        phone: value.phone ?? '',
      },
    });

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onReady(result.data.clientSecret);
  }

  return (
    <form onSubmit={submit} className="checkoutform">
      <section className="checkoutform__section">
        <h2 className="meta checkoutform__legend">Contact</h2>

        <label className="field">
          Email
          <input
            type="email"
            className="input"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
          <small className="checkoutform__hint">
            For your receipt and shipping updates. No account needed.
          </small>
        </label>
      </section>

      <section className="checkoutform__section">
        <h2 className="meta checkoutform__legend">Ship to</h2>

        <AddressElement
          options={{
            mode: 'shipping',
            // The store ships within the United States only, so the country
            // is not a question worth asking.
            allowedCountries: ['US'],
            fields: { phone: 'always' },
            validation: { phone: { required: 'never' } },
          }}
        />
      </section>

      <button type="submit" className="btn btn--lg btn--block" disabled={pending}>
        {pending ? 'One moment…' : 'Continue to payment'}
      </button>

      {error ? <p role="alert" className="notice notice--error">{error}</p> : null}
    </form>
  );
}

function PaymentStep({
  clientSecret,
  totalCents,
  onBack,
}: {
  clientSecret: string;
  totalCents: number;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();

  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (!stripe || !elements) return;

    setPending(true);
    setError('');

    const { error: failure, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/complete`,
      },
      // Cards resolve here without leaving the page; wallets and bank
      // redirects still hand off and come back to `return_url`.
      redirect: 'if_required',
    });

    if (failure) {
      setPending(false);
      setError(failure.message ?? 'That payment could not be completed.');
      return;
    }

    if (paymentIntent) {
      // The order is not marked paid here — the webhook does that from
      // Stripe's signed event. This only moves the shopper along.
      //
      // The client secret travels with the intent id because the confirmation
      // page shows an address and an email, and an intent id alone is a
      // guessable-shaped string that should not be enough to read either.
      // Stripe's own `return_url` redirect appends the same pair.
      const query = new URLSearchParams({
        payment_intent: paymentIntent.id,
        payment_intent_client_secret: clientSecret,
      });

      router.push(`/checkout/complete?${query.toString()}`);
      return;
    }

    // Neither an error nor an intent. Stripe normally navigates away instead
    // of resolving like this, so reaching here means the hand-off did not
    // happen — and the button must not be left saying "Paying…" for ever over
    // a payment that is not running.
    setPending(false);
    setError('The payment did not start. Try again.');
  }

  return (
    <form onSubmit={submit} className="checkoutform">
      <section className="checkoutform__section">
        <h2 className="meta checkoutform__legend">Payment</h2>
        <PaymentElement options={{ layout: 'tabs' }} />
      </section>

      <button type="submit" className="btn btn--lg btn--block" disabled={pending || !stripe}>
        {pending ? 'Paying…' : `Pay ${(totalCents / 100).toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
        })}`}
      </button>

      <button type="button" className="ulink checkoutform__back" onClick={onBack}>
        Edit contact or address
      </button>

      {error ? <p role="alert" className="notice notice--error">{error}</p> : null}
    </form>
  );
}
