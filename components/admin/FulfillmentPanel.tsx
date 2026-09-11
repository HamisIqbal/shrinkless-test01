'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { transitionOrderAction } from '@/app/actions/admin/orders';
import type { OrderStatus } from '@/types/dto';

type Props = {
  orderId: string;
  status: OrderStatus;
  trackingNumber: string;
  /** Where this order may legally go next, as the server sees it. */
  allowed: OrderStatus[];
};

const LABELS: Record<OrderStatus, string> = {
  pending: 'Back to pending',
  paid: 'Mark as paid',
  shipped: 'Mark as shipped',
  delivered: 'Mark as delivered',
  cancelled: 'Cancel order',
  payment_failed: 'Mark payment failed',
};

/**
 * The buttons are built from the transitions the *server* says are legal,
 * rather than from a copy of the rules kept here. One state machine, in
 * `lib/services/orders.ts`; this only renders it.
 *
 * Cancelling and marking paid both move stock, so both ask first — marking
 * paid can fail outright if the units are no longer there, and that refusal is
 * shown rather than swallowed.
 */
export function FulfillmentPanel({ orderId, status, trackingNumber, allowed }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tracking, setTracking] = useState(trackingNumber);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  function run(to: OrderStatus) {
    if (to === 'cancelled' && !window.confirm('Cancel this order and return its stock?')) {
      return;
    }

    setError('');
    startTransition(async () => {
      const result = await transitionOrderAction({
        id: orderId,
        to,
        trackingNumber: tracking,
        note,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setNote('');
      router.refresh();
    });
  }

  return (
    <section className="panel panel--outline" aria-labelledby="fulfillment-heading">
      <p className="alabel" id="fulfillment-heading">Fulfilment</p>

      {allowed.includes('shipped') ? (
        <label className="adfield">
          Tracking number
          <input value={tracking} onChange={(event) => setTracking(event.target.value)} />
        </label>
      ) : null}

      {allowed.length ? (
        <label className="adfield">
          Note
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Recorded against the status change"
          />
        </label>
      ) : null}

      {allowed.map((to) => (
        <button
          key={to}
          type="button"
          className={`abtn abtn--block${to === 'cancelled' ? ' abtn--ghost' : ''}`}
          disabled={pending}
          onClick={() => run(to)}
          style={{ marginTop: 'var(--ad-s-2)' }}
        >
          {LABELS[to]}
        </button>
      ))}

      {!allowed.length ? (
        <p className="aquiet">This order is closed. No further status changes.</p>
      ) : null}

      {status === 'paid' ? (
        <p className="aquiet" style={{ marginTop: 'var(--ad-s-3)' }}>
          Stock for this order has been taken from inventory.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="anotice anotice--error" style={{ marginTop: 'var(--ad-s-3)' }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
