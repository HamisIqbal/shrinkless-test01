'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { refundOrderAction } from '@/app/actions/admin/orders';
import { formatCents } from '@/lib/money';
import type { OrderStatus } from '@/types/dto';

/**
 * Records a refund against an order.
 *
 * The copy is blunt on purpose: this store has no live payment provider, so
 * nothing here moves money. An admin who believes otherwise would tell a
 * customer they had been paid when they had not, which is a far worse failure
 * than an honest label.
 */
export function RefundPanel({
  orderId,
  refundableCents,
  status,
}: {
  orderId: string;
  refundableCents: number;
  status: OrderStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const payable = status !== 'pending' && status !== 'payment_failed';

  if (!payable) {
    return (
      <section className="panel" aria-labelledby="refund-heading">
        <p className="alabel" id="refund-heading">Refunds</p>
        <p className="aquiet">This order was never paid, so there is nothing to refund.</p>
      </section>
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }

    startTransition(async () => {
      const result = await refundOrderAction({
        id: orderId,
        amountCents: Math.round(value * 100),
        note,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setAmount('');
      setNote('');
      router.refresh();
    });
  }

  return (
    <section className="panel" aria-labelledby="refund-heading">
      <p className="alabel" id="refund-heading">Refunds</p>
      <p className="aquiet" style={{ marginBottom: 'var(--ad-s-3)' }}>
        {formatCents(refundableCents)} still refundable. This records the refund
        in the order&rsquo;s history — it does not move money, because no payment
        provider is connected yet.
      </p>

      <form onSubmit={submit}>
        <label className="adfield">
          Amount (dollars)
          <input
            type="number"
            step="0.01"
            min="0"
            max={(refundableCents / 100).toFixed(2)}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </label>

        <label className="adfield">
          Reason
          <input value={note} onChange={(event) => setNote(event.target.value)} />
        </label>

        <button
          type="submit"
          className="abtn abtn--ghost abtn--block"
          disabled={pending || refundableCents <= 0}
        >
          {pending ? 'Recording…' : 'Record refund'}
        </button>
      </form>

      {error ? (
        <p role="alert" className="anotice anotice--error" style={{ marginTop: 'var(--ad-s-3)' }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
