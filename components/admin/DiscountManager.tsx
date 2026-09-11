'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { archiveDiscountAction, saveDiscountAction } from '@/app/actions/admin/discounts';
import { EmptyState } from '@/components/admin/EmptyState';
import { formatCents } from '@/lib/money';
import type { DiscountDTO } from '@/types/dto';

const BLANK = {
  id: undefined as string | undefined,
  code: '',
  description: '',
  type: 'percentage' as 'percentage' | 'fixed',
  /** Percent for a percentage discount, dollars for a fixed one. Converted to
   *  basis points or cents on the way out — the server only sees integers. */
  amount: '10',
  active: true,
  startsAt: '',
  endsAt: '',
  usageLimit: '',
  perCustomerLimit: '',
  minOrder: '',
  categorySlugs: [] as string[],
};

type Draft = typeof BLANK;

function draftFrom(discount: DiscountDTO): Draft {
  return {
    id: discount.id,
    code: discount.code,
    description: discount.description,
    type: discount.type,
    amount: String(discount.value / 100),
    active: discount.active,
    startsAt: discount.startsAt ? discount.startsAt.slice(0, 10) : '',
    endsAt: discount.endsAt ? discount.endsAt.slice(0, 10) : '',
    usageLimit: discount.usageLimit === null ? '' : String(discount.usageLimit),
    perCustomerLimit:
      discount.perCustomerLimit === null ? '' : String(discount.perCustomerLimit),
    minOrder: discount.minOrderCents ? String(discount.minOrderCents / 100) : '',
    categorySlugs: discount.categorySlugs,
  };
}

function worth(discount: DiscountDTO): string {
  return discount.type === 'percentage'
    ? discount.value / 100 + '% off'
    : formatCents(discount.value) + ' off';
}

function window(discount: DiscountDTO): string {
  const from = discount.startsAt ? discount.startsAt.slice(0, 10) : 'now';
  const to = discount.endsAt ? discount.endsAt.slice(0, 10) : 'no end date';

  return from + ' to ' + to;
}

/**
 * Codes as a list, the editor beside it.
 *
 * A discount is mostly its rules, and the rules are what an admin needs to
 * compare across codes — so each row states what the code is worth, when it
 * runs, and how much of it is left, and nothing else.
 */
export function DiscountManager({
  discounts,
  categorySlugs,
}: {
  discounts: DiscountDTO[];
  categorySlugs: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function run(work: () => Promise<{ ok: boolean; error?: string }>, done?: string) {
    setError('');
    setMessage('');

    startTransition(async () => {
      const result = await work();

      if (!result.ok) {
        setError(result.error ?? 'That did not work.');
        return;
      }

      if (done) setMessage(done);
      router.refresh();
    });
  }

  function save(event: React.FormEvent) {
    event.preventDefault();

    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('The discount needs a positive amount.');
      return;
    }

    // Percent to basis points, dollars to cents. Both land as integers so no
    // float ever reaches the money path.
    const value = Math.round(amount * 100);

    run(
      () =>
        saveDiscountAction({
          ...(draft.id ? { id: draft.id } : {}),
          code: draft.code,
          description: draft.description,
          type: draft.type,
          value,
          active: draft.active,
          startsAt: draft.startsAt || null,
          endsAt: draft.endsAt || null,
          usageLimit: draft.usageLimit === '' ? null : Number(draft.usageLimit),
          perCustomerLimit:
            draft.perCustomerLimit === '' ? null : Number(draft.perCustomerLimit),
          minOrderCents: draft.minOrder === '' ? 0 : Math.round(Number(draft.minOrder) * 100),
          productIds: [],
          categorySlugs: draft.categorySlugs,
        }),
      draft.id ? 'Discount updated.' : 'Discount created.',
    );

    if (!draft.id) setDraft(BLANK);
  }

  return (
    <div className="manager">
      <div>
        {discounts.length ? (
          <div className="tablewrap">
            <table className="atable">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Runs</th>
                  <th scope="col">State</th>
                  <th scope="col" className="atable__num">Used</th>
                  <th scope="col" className="atable__actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {discounts.map((discount) => (
                  <tr key={discount.id}>
                    <td>
                      <span className="prow__title">{discount.code}</span>
                      <span className="prow__meta">
                        {worth(discount)}
                        {discount.minOrderCents
                          ? ' · over ' + formatCents(discount.minOrderCents)
                          : ''}
                      </span>
                    </td>
                    <td>{window(discount)}</td>
                    <td>
                      <span
                        className={'pill pill--' + (discount.redeemable ? 'on' : 'off')}
                      >
                        {discount.archived
                          ? 'Archived'
                          : discount.redeemable
                            ? 'Redeemable'
                            : 'Not live'}
                      </span>
                    </td>
                    <td className="atable__num">
                      {discount.usedCount}
                      {discount.usageLimit === null ? '' : ' / ' + discount.usageLimit}
                    </td>
                    <td className="atable__actions">
                      <span className="rowactions">
                        <button
                          type="button"
                          className="abtn abtn--ghost abtn--sm"
                          onClick={() => setDraft(draftFrom(discount))}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="abtn abtn--quiet abtn--sm"
                          disabled={pending}
                          onClick={() =>
                            run(
                              () =>
                                archiveDiscountAction({
                                  id: discount.id,
                                  archived: !discount.archived,
                                }),
                              discount.archived ? 'Restored.' : 'Archived.',
                            )
                          }
                        >
                          {discount.archived ? 'Restore' : 'Archive'}
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No codes yet"
            body="A code can take a percentage or a fixed amount off, run between two dates, cap its own use, and apply only to certain collections. The server decides what it is worth — the browser only ever sends the code."
          />
        )}
      </div>

      <form onSubmit={save} className="manager__form">
        <h2 className="manager__formtitle">
          {draft.id ? 'Edit ' + draft.code : 'New discount'}
        </h2>

        <label className="adfield">
          Code
          <input
            value={draft.code}
            onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })}
            required
          />
        </label>

        <label className="adfield">
          Description
          <input
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />
        </label>

        <div className="fieldrow">
          <label className="adfield">
            Type
            <select
              value={draft.type}
              onChange={(event) =>
                setDraft({ ...draft, type: event.target.value as 'percentage' | 'fixed' })
              }
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed amount</option>
            </select>
          </label>

          <label className="adfield">
            {draft.type === 'percentage' ? 'Percent off' : 'Dollars off'}
            <input
              type="number"
              step="0.01"
              min="0"
              value={draft.amount}
              onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
              required
            />
          </label>
        </div>

        <label className="adfield">
          Minimum order, in dollars
          <input
            type="number"
            step="0.01"
            min="0"
            value={draft.minOrder}
            onChange={(event) => setDraft({ ...draft, minOrder: event.target.value })}
          />
        </label>

        <div className="fieldrow">
          <label className="adfield">
            Starts
            <input
              type="date"
              value={draft.startsAt}
              onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })}
            />
          </label>

          <label className="adfield">
            Ends
            <input
              type="date"
              value={draft.endsAt}
              onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })}
            />
          </label>
        </div>

        <div className="fieldrow">
          <label className="adfield">
            Total uses
            <input
              type="number"
              min="1"
              value={draft.usageLimit}
              onChange={(event) => setDraft({ ...draft, usageLimit: event.target.value })}
              placeholder="Unlimited"
            />
          </label>

          <label className="adfield">
            Per customer
            <input
              type="number"
              min="1"
              value={draft.perCustomerLimit}
              onChange={(event) => setDraft({ ...draft, perCustomerLimit: event.target.value })}
              placeholder="Unlimited"
            />
          </label>
        </div>

        {categorySlugs.length ? (
          <fieldset>
            <legend>Limit to collections</legend>

            {categorySlugs.map((slug) => (
              <label key={slug} className="checkline">
                <input
                  type="checkbox"
                  checked={draft.categorySlugs.includes(slug)}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      categorySlugs: event.target.checked
                        ? [...draft.categorySlugs, slug]
                        : draft.categorySlugs.filter((value) => value !== slug),
                    })
                  }
                />
                {slug}
              </label>
            ))}

            <p className="adfield__hint">None selected means the code applies to everything.</p>
          </fieldset>
        ) : null}

        <label className="checkline">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
          />
          Active
        </label>

        <div className="manager__actions">
          <button type="submit" className="abtn" disabled={pending}>
            {draft.id ? 'Save discount' : 'Create discount'}
          </button>

          {draft.id ? (
            <button
              type="button"
              className="abtn abtn--ghost"
              onClick={() => setDraft(BLANK)}
              disabled={pending}
            >
              Cancel
            </button>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="anotice anotice--error" style={{ marginTop: 'var(--ad-s-3)' }}>
            {error}
          </p>
        ) : null}
        {!error && message ? (
          <p className="anotice" style={{ marginTop: 'var(--ad-s-3)' }}>{message}</p>
        ) : null}
      </form>
    </div>
  );
}
