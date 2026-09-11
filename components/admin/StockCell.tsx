'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { adjustStockAction } from '@/app/actions/admin/inventory';
import { MAX_STOCK } from '@/lib/inventory/limits';

const REASONS = [
  { value: 'restock', label: 'Restock' },
  { value: 'correction', label: 'Correction' },
  { value: 'damage', label: 'Damage' },
  { value: 'return', label: 'Return' },
  { value: 'manual', label: 'Other' },
] as const;

/**
 * A stock movement, inline in the list.
 *
 * Deliberately a *delta*, not a new total: "we took delivery of twelve" is the
 * thing that actually happened, and typing an absolute figure over a number
 * that another sale may have moved is how counts drift. An absolute set exists
 * for stock takes — it lives on the variant page, where it belongs.
 */
export function StockCell({
  variantId,
  stock,
  sku,
}: {
  variantId: string;
  stock: number;
  sku: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState<(typeof REASONS)[number]['value']>('restock');
  const [error, setError] = useState('');

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    const value = Number(delta);
    if (!Number.isInteger(value) || value === 0) {
      setError('Use a whole number, positive or negative.');
      return;
    }

    startTransition(async () => {
      const result = await adjustStockAction({ variantId, delta: value, reason, note: '' });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setDelta('');
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <span className="stockcell">
        <span className="stockcell__value">{stock}</span>
        <button
          type="button"
          className="abtn abtn--quiet abtn--sm"
          onClick={() => setOpen(true)}
        >
          Adjust
        </button>
      </span>
    );
  }

  return (
    <form onSubmit={submit} className="stockcell">
      <label>
        <span className="visually-hidden">Adjustment for {sku}</span>
        <input
          type="number"
          min={-MAX_STOCK}
          max={MAX_STOCK}
          step={1}
          value={delta}
          onChange={(event) => setDelta(event.target.value)}
          placeholder="+/-"
          autoFocus
        />
      </label>

      <label>
        <span className="visually-hidden">Reason</span>
        <select
          value={reason}
          onChange={(event) => setReason(event.target.value as typeof reason)}
        >
          {REASONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>

      <button type="submit" className="abtn abtn--sm" disabled={pending}>
        {pending ? 'Saving' : 'Save'}
      </button>
      <button
        type="button"
        className="abtn abtn--quiet abtn--sm"
        onClick={() => setOpen(false)}
        disabled={pending}
      >
        Cancel
      </button>

      {error ? <span role="alert" className="rowactions__error">{error}</span> : null}
    </form>
  );
}
