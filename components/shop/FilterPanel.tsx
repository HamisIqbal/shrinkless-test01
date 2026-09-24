'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { buildFilterQuery, toggleValue } from '@/lib/shop/filters';
import { formatCents } from '@/lib/money';
import { SearchIcon } from '@/components/site/icons';
import type { ProductFilter } from '@/lib/validation/catalogue';
import './shop.css';

type Props = {
  filter: ProductFilter;
  sizes: string[];
  colors: string[];
  /** Whole dollars, from the catalogue's actual price range. */
  priceFloor: number;
  priceCeiling: number;
  basePath: string;
  /** The header's search lands here and expects the field ready to type in. */
  focusSearch?: boolean;
  /** Only set where a listing mixes categories in one grid (wholesale). */
  genders?: { value: 'men' | 'women'; label: string }[];
};

/** One chosen filter, as the tray draws it: a label, and the way off. */
type Applied = { key: string; label: string; clear: Parameters<typeof buildFilterQuery>[1] };

/**
 * The collection's filters: a search field, a tray of what is already chosen,
 * and a stack of groups that fold.
 *
 * **Folding is the change.** This was six open fieldsets in a column — search,
 * gender, every size, every colour, a price slider, a sort menu and a count —
 * roughly two screens deep on a laptop, so the colour somebody wanted was
 * below the fold of the sidebar and the only way to know it was there was to
 * scroll a form.
 *
 * Folding a question is only safe if its answer stays visible, which is what
 * the tray is for: whatever is chosen inside a closed group is still at the
 * top of the panel with its own way off. A group opens by itself when it is
 * holding something, so nothing is ever hidden behind a closed head.
 *
 * Sort has left. It was the last control in a form about filtering and it is
 * not a filter — it reorders what the filters already chose — so it sits in
 * the results bar beside the count, where the result it changes is.
 *
 * `ShopBrowser` owns whether this column is on screen and renders the toggle,
 * which is why there is none here.
 */
export function FilterPanel({
  filter,
  sizes,
  colors,
  priceFloor,
  priceCeiling,
  basePath,
  focusSearch = false,
  genders,
}: Props) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  const [term, setTerm] = useState(filter.q);
  const [ceiling, setCeiling] = useState(filter.maxPrice ?? priceCeiling);

  useEffect(() => {
    if (focusSearch) searchRef.current?.focus();
  }, [focusSearch]);

  function apply(change: Parameters<typeof buildFilterQuery>[1]) {
    const query = buildFilterQuery(filter, change);
    router.push(query ? `${basePath}?${query}` : basePath);
  }

  /* Everything currently narrowing the grid, in the order the panel asks for
     it. The tray is built from this and so is each group's tally, so the two
     can never disagree about what is on. */
  const applied: Applied[] = [
    ...(filter.gender
      ? [{ key: 'gender', label: filter.gender, clear: { gender: null } }]
      : []),
    ...filter.sizes.map((size) => ({
      key: `size-${size}`,
      label: size.toUpperCase(),
      clear: { sizes: filter.sizes.filter((value) => value !== size) },
    })),
    ...filter.colors.map((color) => ({
      key: `color-${color}`,
      label: color,
      clear: { colors: filter.colors.filter((value) => value !== color) },
    })),
    ...(filter.maxPrice !== null
      ? [
          {
            key: 'price',
            label: `Up to ${formatCents(filter.maxPrice * 100)}`,
            clear: { maxPrice: null },
          },
        ]
      : []),
    ...(filter.q
      ? [{ key: 'q', label: `“${filter.q}”`, clear: { q: '' } }]
      : []),
  ];

  return (
    <form
      id="shop-filters"
      aria-label="Filter and search"
      className="sh-filters"
      onSubmit={(event) => {
        event.preventDefault();
        apply({ q: term.trim() });
      }}
    >
      <div className="sh-filters__search">
        <label htmlFor="shop-search" className="visually-hidden">
          Search this collection
        </label>
        <input
          id="shop-search"
          ref={searchRef}
          type="search"
          value={term}
          placeholder="Search tees, colours, fits"
          className="sh-filters__input"
          onChange={(event) => setTerm(event.target.value)}
        />
        {/* A loose "Go" floated at the end of the rule and read as a stray
            label; the field is a search, and a search submits on a glass. */}
        <button type="submit" className="sh-filters__submit">
          <SearchIcon className="sh-filters__glass" />
          <span className="visually-hidden">Search</span>
        </button>
      </div>

      {applied.length ? (
        <div className="sh-filters__active">
          <div className="sh-filters__activehead">
            <p className="sh-label">Applied</p>
            <button
              type="button"
              className="sh-link"
              onClick={() => {
                setTerm('');
                setCeiling(priceCeiling);
                apply({ sizes: [], colors: [], q: '', minPrice: null, maxPrice: null, gender: null });
              }}
            >
              Clear all
            </button>
          </div>

          <ul className="sh-filters__tray">
            {applied.map((entry) => (
              <li key={entry.key}>
                <button
                  type="button"
                  className="sh-filters__pill"
                  onClick={() => apply(entry.clear)}
                >
                  {entry.label}
                  <span className="sh-filters__pillx" aria-hidden="true">&times;</span>
                  <span className="visually-hidden">Remove this filter</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {genders ? (
        <Group title="Gender" chosen={filter.gender ? 1 : 0}>
          <div className="sh-filters__chips">
            {genders.map((gender) => (
              <label
                key={gender.value}
                className={`sh-chip${filter.gender === gender.value ? ' sh-chip--on' : ''}`}
              >
                <input
                  type="checkbox"
                  className="visually-hidden"
                  checked={filter.gender === gender.value}
                  onChange={() =>
                    apply({ gender: filter.gender === gender.value ? null : gender.value })
                  }
                />
                {gender.label}
              </label>
            ))}
          </div>
        </Group>
      ) : null}

      {sizes.length ? (
        <Group title="Size" chosen={filter.sizes.length}>
          <div className="sh-filters__chips">
            {sizes.map((size) => (
              <label
                key={size}
                className={`sh-chip${filter.sizes.includes(size) ? ' sh-chip--on' : ''}`}
              >
                <input
                  type="checkbox"
                  className="visually-hidden"
                  checked={filter.sizes.includes(size)}
                  onChange={() => apply({ sizes: toggleValue(filter.sizes, size) })}
                />
                {size.toUpperCase()}
              </label>
            ))}
          </div>
        </Group>
      ) : null}

      {colors.length ? (
        <Group title="Colour" chosen={filter.colors.length}>
          {/* Names beside swatches, not a row of dots. A dot on its own is a
              colour somebody has to hover to identify, and the swatch palette
              has two greys in it. */}
          <ul className="sh-filters__colors">
            {colors.map((color) => (
              <li key={color}>
                <label
                  className={`sh-filters__color${
                    filter.colors.includes(color) ? ' sh-filters__color--on' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    className="visually-hidden"
                    checked={filter.colors.includes(color)}
                    onChange={() => apply({ colors: toggleValue(filter.colors, color) })}
                  />
                  <span
                    className={`swatchdot dot--${color}${
                      filter.colors.includes(color) ? ' swatchdot--on' : ''
                    }`}
                    aria-hidden="true"
                  />
                  {color}
                </label>
              </li>
            ))}
          </ul>
        </Group>
      ) : null}

      {priceCeiling > priceFloor ? (
        <Group title="Price" chosen={filter.maxPrice === null ? 0 : 1}>
          <p className="sh-filters__price tnum">
            <span>{formatCents(priceFloor * 100)}</span>
            <span>{formatCents(ceiling * 100)}</span>
          </p>

          {/* Committing on release rather than on every input keeps one
              navigation per drag instead of one per pixel. */}
          <label>
            <span className="visually-hidden">Highest price</span>
            <input
              type="range"
              className="sh-filters__range"
              min={priceFloor}
              max={priceCeiling}
              step={1}
              value={ceiling}
              onChange={(event) => setCeiling(Number(event.target.value))}
              onMouseUp={() => apply({ maxPrice: ceiling >= priceCeiling ? null : ceiling })}
              onTouchEnd={() => apply({ maxPrice: ceiling >= priceCeiling ? null : ceiling })}
              onKeyUp={(event) => {
                if (event.key.startsWith('Arrow')) {
                  apply({ maxPrice: ceiling >= priceCeiling ? null : ceiling });
                }
              }}
            />
          </label>

          <p className="sh-filters__hint">Everything up to this price</p>
        </Group>
      ) : null}
    </form>
  );
}

/**
 * One folding question.
 *
 * It opens by itself the moment it is holding an answer, so a filter arriving
 * from a URL — a link, a back button, a shared collection — is never folded
 * away behind a closed head. After that the shopper's own toggling wins, which
 * is what `touched` records.
 */
function Group({
  title,
  chosen,
  children,
}: {
  title: string;
  chosen: number;
  children: ReactNode;
}) {
  const [touched, setTouched] = useState(false);
  const [wanted, setWanted] = useState(false);

  const open = touched ? wanted : chosen > 0;
  const panelId = `filter-${title.toLowerCase()}`;

  return (
    <div className="sh-filters__group">
      <button
        type="button"
        className="sh-filters__legend"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setTouched(true);
          setWanted(!open);
        }}
      >
        <span>
          {title}
          {chosen > 0 ? <span className="sh-filters__tally"> · {chosen}</span> : null}
        </span>
        <span className="sh-filters__mark" aria-hidden="true" />
      </button>

      {open ? (
        <div id={panelId} className="sh-filters__body">
          {children}
        </div>
      ) : null}
    </div>
  );
}
