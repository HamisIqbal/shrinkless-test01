'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setLowStockThresholdAction, setStockAction } from '@/app/actions/admin/inventory';
import { MAX_STOCK } from '@/lib/inventory/limits';

/**
 * The absolute-set half of inventory: a stock take, and the low-stock
 * threshold for this variant.
 *
 * Setting a count is deliberately separated from adjusting one. An adjustment
 * says what happened; a stock take says what is true. Both are recorded, both
 * name the person, and the service refuses either if it would leave stock
 * negative.
 */
export function StockTakePanel({
  variantId,
  stock,
  threshold,
}: {
  variantId: string;
  stock: number;
  threshold: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [count, setCount] = useState(String(stock));
  const [note, setNote] = useState('');
  const [override, setOverride] = useState(threshold === null ? '' : String(threshold));
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function submitCount(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');

    const value = Number(count);
    if (!Number.isInteger(value) || value < 0) {
      setError('A count has to be a whole number, zero or more.');
      return;
    }

    startTransition(async () => {
      const result = await setStockAction({ variantId, stock: value, note });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setNote('');
      setMessage(`Counted ${result.data.stock}.`);
      router.refresh();
    });
  }

  function submitThreshold(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');

    const value = override.trim() === '' ? null : Number(override);
    if (value !== null && (!Number.isInteger(value) || value < 0)) {
      setError('A threshold has to be a whole number, zero or more.');
      return;
    }

    startTransition(async () => {
      const result = await setLowStockThresholdAction({ variantId, threshold: value });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessage(value === null ? 'Using the store default.' : `Low at ${value}.`);
      router.refresh();
    });
  }

  return (
    <div className="adsplit">
      <form onSubmit={submitCount} className="panel">
        <p className="alabel">Stock take</p>

        <label className="adfield">
          Counted
          <input
            type="number"
            min={0}
            max={MAX_STOCK}
            step={1}
            value={count}
            onChange={(event) => setCount(event.target.value)}
          />
        </label>

        <label className="adfield">
          Note
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Why the count changed"
          />
        </label>

        <button type="submit" className="abtn" disabled={pending}>
          Record count
        </button>
      </form>

      <form onSubmit={submitThreshold} className="panel">
        <p className="alabel">Low-stock threshold</p>

        <label className="adfield">
          Low at
          <input
            type="number"
            min={0}
            max={MAX_STOCK}
            step={1}
            value={override}
            onChange={(event) => setOverride(event.target.value)}
            placeholder="Store default"
          />
        </label>

        <button type="submit" className="abtn abtn--ghost" disabled={pending}>
          Save threshold
        </button>
      </form>

      {error ? <p role="alert" className="anotice anotice--error">{error}</p> : null}
      {!error && message ? <p className="anotice">{message}</p> : null}
    </div>
  );
}
