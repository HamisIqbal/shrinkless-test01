'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setStockForListedAction } from '@/app/actions/admin/inventory';
import { MAX_STOCK } from '@/lib/inventory/limits';

type Props = {
  /** Which list this sits on. Decides how the server resolves the scope. */
  scope: 'products' | 'wholesale';
  /** How many products the list is showing, every page of it. */
  count: number;
  /** The list's own search and filters, echoed back so a bulk set lands on
   *  exactly the rows on screen. The wholesale list has neither. */
  q?: string;
  filters?: Record<string, string>;
};

/**
 * One count, typed once, applied to every variant of every product the list
 * is showing.
 *
 * Folded away until it is asked for. A field that sets the stock of the whole
 * catalogue should not sit open above the table where a stray keystroke can
 * reach it — opening it is the first of two deliberate acts, and confirming
 * the figure against the number of products it will touch is the second.
 *
 * The scope is described in words before it is applied, because "all the
 * listed products" means something different with a filter on, and the only
 * honest way to say so is to name the filter that is on.
 */
export function BulkStockPanel({ scope, count, q = '', filters = {} }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const noun = scope === 'wholesale' ? 'style' : 'product';
  const plural = count === 1 ? noun : `${noun}s`;
  const narrowed = Boolean(q) || Object.keys(filters).length > 0;

  function apply(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');

    const stock = Number(value);

    if (value.trim() === '' || !Number.isInteger(stock) || stock < 0) {
      setError('A stock figure has to be a whole number, zero or more.');
      return;
    }
    if (stock > MAX_STOCK) {
      setError(`That is more than ${MAX_STOCK.toLocaleString('en-US')} units.`);
      return;
    }
    if (!count) {
      setError('There is nothing in this list to set.');
      return;
    }

    const confirmed = window.confirm(
      `Set every variant of all ${count} ${plural} to ${stock} units? ` +
        'This replaces the counts they hold now.',
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await setStockForListedAction({ scope, stock, q, filters, note: '' });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const { variants, changed, failed } = result.data;

      setMessage(
        `${changed} of ${variants} ${variants === 1 ? 'variant' : 'variants'} set to ${stock}.` +
          (failed ? ` ${failed} could not be changed.` : ''),
      );
      setValue('');
      router.refresh();
    });
  }

  return (
    <div className="bulkstock">
      <div className="bulkstock__bar">
        <button
          type="button"
          className="abtn abtn--ghost abtn--sm"
          aria-expanded={open}
          aria-controls={`bulkstock-${scope}`}
          onClick={() => {
            setOpen((was) => !was);
            setError('');
            setMessage('');
          }}
        >
          {open ? 'Close bulk stock' : 'Set stock for all'}
        </button>

        <p className="bulkstock__scope">
          {count} {plural}
          {narrowed ? ' matching the filters above' : ` in the ${scope === 'wholesale' ? 'line sheet' : 'catalogue'}`}
        </p>
      </div>

      {open ? (
        <form id={`bulkstock-${scope}`} className="bulkstock__form" onSubmit={apply}>
          <label className="adfield bulkstock__field">
            Units per variant
            <input
              type="number"
              min={0}
              max={MAX_STOCK}
              step={1}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="e.g. 100"
            />
          </label>

          <button type="submit" className="abtn" disabled={pending || !count}>
            {pending ? 'Setting…' : `Apply to ${count} ${plural}`}
          </button>

          <p className="bulkstock__note">
            Every variant of every {noun} listed is counted to this figure, and each
            movement is written to that variant&rsquo;s stock history.
          </p>
        </form>
      ) : null}

      {error ? <p role="alert" className="anotice anotice--error">{error}</p> : null}
      {!error && message ? <p className="anotice">{message}</p> : null}
    </div>
  );
}
