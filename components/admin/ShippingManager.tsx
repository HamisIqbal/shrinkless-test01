'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  archiveShippingMethodAction,
  saveShippingMethodAction,
} from '@/app/actions/admin/shipping';
import { EmptyState } from '@/components/admin/EmptyState';
import { formatCents } from '@/lib/money';
import type { ShippingMethodDTO } from '@/types/dto';

const BLANK = {
  id: undefined as string | undefined,
  name: '',
  code: '',
  description: '',
  /** Dollars in the form, cents on the wire. */
  rate: '0',
  freeOver: '',
  countries: '',
  states: '',
  estimate: '',
  active: true,
  sortOrder: '0',
};

type Draft = typeof BLANK;

function draftFrom(method: ShippingMethodDTO): Draft {
  return {
    id: method.id,
    name: method.name,
    code: method.code,
    description: method.description,
    rate: (method.rateCents / 100).toFixed(2),
    freeOver: method.freeOverCents === null ? '' : (method.freeOverCents / 100).toFixed(2),
    countries: method.countries.join(', '),
    states: method.states.join(', '),
    estimate: method.estimate,
    active: method.active,
    sortOrder: String(method.sortOrder),
  };
}

function codeList(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
}

function servesLabel(method: ShippingMethodDTO): string {
  const scope = [...method.countries, ...method.states];
  return scope.length ? scope.join(', ') : 'Everywhere';
}

export function ShippingManager({ methods }: { methods: ShippingMethodDTO[] }) {
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

    const rate = Number(draft.rate);
    if (!Number.isFinite(rate) || rate < 0) {
      setError('A rate has to be zero or more.');
      return;
    }

    run(
      () =>
        saveShippingMethodAction({
          ...(draft.id ? { id: draft.id } : {}),
          name: draft.name,
          code: draft.code,
          description: draft.description,
          rateCents: Math.round(rate * 100),
          freeOverCents:
            draft.freeOver === '' ? null : Math.round(Number(draft.freeOver) * 100),
          countries: codeList(draft.countries),
          states: codeList(draft.states),
          estimate: draft.estimate,
          active: draft.active,
          sortOrder: Number(draft.sortOrder) || 0,
        }),
      draft.id ? 'Method updated.' : 'Method created.',
    );

    if (!draft.id) setDraft(BLANK);
  }

  return (
    <div className="manager">
      <div>
        {methods.length ? (
          <div className="tablewrap">
            <table className="atable">
              <thead>
                <tr>
                  <th scope="col">Method</th>
                  <th scope="col">Applies to</th>
                  <th scope="col">State</th>
                  <th scope="col" className="atable__num">Rate</th>
                  <th scope="col" className="atable__actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {methods.map((method) => (
                  <tr key={method.id}>
                    <td>
                      <span className="prow__title">{method.name}</span>
                      <span className="prow__meta">
                        {method.code}
                        {method.estimate ? ' · ' + method.estimate : ''}
                      </span>
                    </td>
                    <td>{servesLabel(method)}</td>
                    <td>
                      <span
                        className={
                          'pill pill--' +
                          (method.archived || !method.active ? 'off' : 'on')
                        }
                      >
                        {method.archived
                          ? 'Archived'
                          : method.active
                            ? 'Active'
                            : 'Inactive'}
                      </span>
                    </td>
                    <td className="atable__num">
                      {formatCents(method.rateCents)}
                      {method.freeOverCents !== null ? (
                        <span className="prow__meta">
                          free over {formatCents(method.freeOverCents)}
                        </span>
                      ) : null}
                    </td>
                    <td className="atable__actions">
                      <span className="rowactions">
                        <button
                          type="button"
                          className="abtn abtn--ghost abtn--sm"
                          onClick={() => setDraft(draftFrom(method))}
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
                                archiveShippingMethodAction({
                                  id: method.id,
                                  archived: !method.archived,
                                }),
                              method.archived ? 'Restored.' : 'Archived.',
                            )
                          }
                        >
                          {method.archived ? 'Restore' : 'Archive'}
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
            title="No methods configured"
            body="Until one exists the store quotes from the legacy zone table in Settings. A method with no countries and no states applies everywhere; anything listed narrows it."
          />
        )}
      </div>

      <form onSubmit={save} className="manager__form">
        <h2 className="manager__formtitle">
          {draft.id ? 'Edit ' + draft.code : 'New method'}
        </h2>

        <div className="fieldrow">
          <label className="adfield">
            Name
            <input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              required
            />
          </label>

          <label className="adfield">
            Code
            <input
              value={draft.code}
              onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })}
              required
            />
          </label>
        </div>

        <div className="fieldrow">
          <label className="adfield">
            Rate, in dollars
            <input
              type="number"
              step="0.01"
              min="0"
              value={draft.rate}
              onChange={(event) => setDraft({ ...draft, rate: event.target.value })}
              required
            />
          </label>

          <label className="adfield">
            Free over
            <input
              type="number"
              step="0.01"
              min="0"
              value={draft.freeOver}
              onChange={(event) => setDraft({ ...draft, freeOver: event.target.value })}
              placeholder="Never"
            />
          </label>
        </div>

        <div className="fieldrow">
          <label className="adfield">
            Countries
            <input
              value={draft.countries}
              onChange={(event) => setDraft({ ...draft, countries: event.target.value })}
              placeholder="US, CA"
            />
          </label>

          <label className="adfield">
            States
            <input
              value={draft.states}
              onChange={(event) => setDraft({ ...draft, states: event.target.value })}
              placeholder="TX, CA"
            />
          </label>
        </div>

        <p className="adfield__hint" style={{ marginBottom: 'var(--ad-s-3)' }}>
          Two-letter codes, comma separated. Leave both blank to apply everywhere.
        </p>

        <label className="adfield">
          Delivery estimate
          <input
            value={draft.estimate}
            onChange={(event) => setDraft({ ...draft, estimate: event.target.value })}
            placeholder="3 to 5 business days"
          />
        </label>

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
            {draft.id ? 'Save method' : 'Create method'}
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
