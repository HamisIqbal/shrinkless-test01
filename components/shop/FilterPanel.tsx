'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toggleValue, type FilterChange } from '@/lib/shop/filters';
import { formatCents } from '@/lib/money';
import { CheckIcon, CloseIcon, SearchIcon } from '@/components/site/icons';
import type { ProductFilter } from '@/lib/validation/catalogue';

type Props = {
  filter: ProductFilter;
  sizes: string[];
  colors: string[];
  /** Whole dollars, from the catalogue's actual price range. */
  priceFloor: number;
  priceCeiling: number;
  /** The header's search lands here and expects the field ready to type in. */
  focusSearch?: boolean;
  /** Only set where a listing mixes categories in one grid (wholesale). */
  genders?: { value: 'men' | 'women'; label: string }[];
  /** Applies a change to the URL. Owned by ShopBrowser, which also knows
   *  whether a change is still on its way. */
  apply: (change: Partial<FilterChange>) => void;
};

/**
 * The questions inside the filter drawer: search, then gender where a listing
 * mixes both, size, colour and price — each one open, headed, and saying how
 * many of its answers are chosen.
 *
 * Nothing folds. The groups folded when they lived in a sidebar that shared
 * the screen with the grid; the drawer has the height to itself, and a closed
 * group is one more tap between a shopper and the size they came for.
 *
 * What is already chosen is also stated outside the drawer, as chips in the
 * results bar, so it can be taken off without opening this at all.
 */
export function FilterPanel({
  filter,
  sizes,
  colors,
  priceFloor,
  priceCeiling,
  focusSearch = false,
  genders,
  apply,
}: Props) {
  const searchRef = useRef<HTMLInputElement>(null);

  const [term, setTerm] = useState(filter.q);
  const [ceiling, setCeiling] = useState(filter.maxPrice ?? priceCeiling);

  // A chip in the results bar, or Clear all, can change the URL under these
  // two local drafts; follow it rather than keep showing the old value.
  const [seen, setSeen] = useState({ q: filter.q, max: filter.maxPrice });
  if (seen.q !== filter.q || seen.max !== filter.maxPrice) {
    setSeen({ q: filter.q, max: filter.maxPrice });
    setTerm(filter.q);
    setCeiling(filter.maxPrice ?? priceCeiling);
  }

  useEffect(() => {
    if (focusSearch) searchRef.current?.focus();
  }, [focusSearch]);

  function commitPrice() {
    const next = ceiling >= priceCeiling ? null : ceiling;
    if (next !== filter.maxPrice) apply({ maxPrice: next });
  }

  return (
    <form
      aria-label="Filter and search"
      className="sh-fp"
      onSubmit={(event) => {
        event.preventDefault();
        apply({ q: term.trim() });
      }}
    >
      <div className="sh-fp__search">
        <SearchIcon className="sh-fp__glass" />
        <label htmlFor="shop-search" className="visually-hidden">
          Search this collection
        </label>
        <input
          id="shop-search"
          ref={searchRef}
          type="search"
          enterKeyHint="search"
          value={term}
          placeholder="Search tees, colours, fits"
          className="sh-fp__input"
          onChange={(event) => setTerm(event.target.value)}
        />
        {term ? (
          <button
            type="button"
            className="sh-fp__clearq"
            onClick={() => {
              setTerm('');
              if (filter.q) apply({ q: '' });
              searchRef.current?.focus();
            }}
          >
            <CloseIcon />
            <span className="visually-hidden">Clear search</span>
          </button>
        ) : null}
      </div>

      {genders?.length ? (
        <Group title="Gender" note={filter.gender ? '1 selected' : null}>
          <div className="sh-fp__segment" role="radiogroup" aria-label="Gender">
            {[{ value: null, label: 'All' }, ...genders].map((gender) => (
              <label
                key={gender.value ?? 'all'}
                className={`sh-fp__seg${filter.gender === gender.value ? ' sh-fp__seg--on' : ''}`}
              >
                <input
                  type="radio"
                  name="gender"
                  className="visually-hidden"
                  checked={filter.gender === gender.value}
                  onChange={() => apply({ gender: gender.value })}
                />
                {gender.label}
              </label>
            ))}
          </div>
        </Group>
      ) : null}

      {sizes.length ? (
        <Group
          title="Size"
          note={filter.sizes.length ? `${filter.sizes.length} selected` : null}
          onClear={filter.sizes.length ? () => apply({ sizes: [] }) : undefined}
        >
          <div className="sh-fp__sizes">
            {sizes.map((size) => {
              const on = filter.sizes.includes(size);

              return (
                <label key={size} className={`sh-fp__size${on ? ' sh-fp__size--on' : ''}`}>
                  <input
                    type="checkbox"
                    className="visually-hidden"
                    checked={on}
                    onChange={() => apply({ sizes: toggleValue(filter.sizes, size) })}
                  />
                  {size.toUpperCase()}
                </label>
              );
            })}
          </div>
        </Group>
      ) : null}

      {colors.length ? (
        <Group
          title="Colour"
          note={filter.colors.length ? `${filter.colors.length} selected` : null}
          onClear={filter.colors.length ? () => apply({ colors: [] }) : undefined}
        >
          {/* Names beside swatches, not a row of dots. A dot on its own is a
              colour somebody has to hover to identify, and the palette has two
              greys in it. */}
          <ul className="sh-fp__colors">
            {colors.map((color) => {
              const on = filter.colors.includes(color);

              return (
                <li key={color}>
                  <label className={`sh-fp__color${on ? ' sh-fp__color--on' : ''}`}>
                    <input
                      type="checkbox"
                      className="visually-hidden"
                      checked={on}
                      onChange={() => apply({ colors: toggleValue(filter.colors, color) })}
                    />
                    <span className={`swatchdot dot--${color}`} aria-hidden="true" />
                    <span className="sh-fp__colorname">{color}</span>
                    <CheckIcon className="sh-fp__tick" />
                  </label>
                </li>
              );
            })}
          </ul>
        </Group>
      ) : null}

      {priceCeiling > priceFloor ? (
        <Group
          title="Price"
          note={filter.maxPrice === null ? null : `Up to ${formatCents(filter.maxPrice * 100)}`}
          onClear={filter.maxPrice === null ? undefined : () => apply({ maxPrice: null })}
        >
          <p className="sh-fp__pricehead tnum" aria-hidden="true">
            <span>{formatCents(priceFloor * 100)}</span>
            <strong>{ceiling >= priceCeiling ? 'Any price' : `Up to ${formatCents(ceiling * 100)}`}</strong>
            <span>{formatCents(priceCeiling * 100)}</span>
          </p>

          {/* Committed when the thumb is let go rather than on every step, so
              a drag is one navigation rather than one per dollar. */}
          <label className="sh-fp__rangewrap">
            <span className="visually-hidden">Highest price</span>
            <input
              type="range"
              className="sh-fp__range"
              min={priceFloor}
              max={priceCeiling}
              step={1}
              value={ceiling}
              aria-valuetext={ceiling >= priceCeiling ? 'Any price' : `Up to ${formatCents(ceiling * 100)}`}
              style={{
                ['--fill' as string]: `${((ceiling - priceFloor) / (priceCeiling - priceFloor)) * 100}%`,
              }}
              onChange={(event) => setCeiling(Number(event.target.value))}
              onPointerUp={commitPrice}
              onKeyUp={(event) => {
                if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End') {
                  commitPrice();
                }
              }}
            />
          </label>
        </Group>
      ) : null}
    </form>
  );
}

/** One question: a heading, how much of it is answered, and a way to undo it. */
function Group({
  title,
  note,
  onClear,
  children,
}: {
  title: string;
  note: string | null;
  onClear?: () => void;
  children: ReactNode;
}) {
  const headingId = `filter-${title.toLowerCase()}`;

  return (
    <section className="sh-fp__group" aria-labelledby={headingId}>
      <div className="sh-fp__head">
        <h3 id={headingId} className="sh-fp__title">
          {title}
          {note ? <span className="sh-fp__note"> · {note}</span> : null}
        </h3>

        {onClear ? (
          <button type="button" className="sh-link" onClick={onClear}>
            Clear<span className="visually-hidden"> {title.toLowerCase()}</span>
          </button>
        ) : null}
      </div>

      {children}
    </section>
  );
}
