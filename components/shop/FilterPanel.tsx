'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildFilterQuery, toggleValue } from '@/lib/shop/filters';
import { formatCents } from '@/lib/money';
import { PRODUCT_SORTS, type ProductFilter, type ProductSort } from '@/lib/validation/catalogue';

type Props = {
  filter: ProductFilter;
  sizes: string[];
  colors: string[];
  /** Whole dollars, from the catalogue's actual price range. */
  priceFloor: number;
  priceCeiling: number;
  basePath: string;
  count: number;
  /** The header's search lands here and expects the field ready to type in. */
  focusSearch?: boolean;
  /** Only set where a listing mixes categories in one grid (wholesale). */
  genders?: { value: 'men' | 'women'; label: string }[];
};

const SORT_LABELS: Record<ProductSort, string> = {
  newest: 'Newest',
  'price-asc': 'Price, low to high',
  'price-desc': 'Price, high to low',
};

/**
 * The collection's filters, as a column beside the grid rather than a bar
 * above it.
 *
 * A horizontal bar pushed the first row of products most of the way down the
 * page — on a laptop you landed on a collection and saw filters, not clothes.
 * In a column the products start at the top of the page and the controls stay
 * within reach.
 *
 * `ShopBrowser` owns whether this column is open and renders the toggle, which
 * is why there is none here.
 */
export function FilterPanel({
  filter,
  sizes,
  colors,
  priceFloor,
  priceCeiling,
  basePath,
  count,
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

  const active =
    filter.sizes.length > 0 ||
    filter.colors.length > 0 ||
    filter.q !== '' ||
    filter.minPrice !== null ||
    filter.maxPrice !== null ||
    Boolean(filter.gender);

  return (
      <form
        id="shop-filters"
        aria-label="Filter and search"
        className="filters"
        onSubmit={(event) => {
          event.preventDefault();
          apply({ q: term.trim() });
        }}
      >
        <div className="filters__inner">
          {genders ? (
            <fieldset className="filters__group">
              <legend className="meta filters__legend">Gender</legend>
              <div className="chiprow">
                {genders.map((gender) => (
                  <label
                    key={gender.value}
                    className={`chip${filter.gender === gender.value ? ' chip--on' : ''}`}
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
            </fieldset>
          ) : null}

          <div className="filters__group">
            <label htmlFor="shop-search" className="meta filters__legend">Search</label>
            <div className="filters__search">
              <input
                id="shop-search"
                ref={searchRef}
                type="search"
                value={term}
                placeholder="Tees, colours, fits"
                className="filters__input"
                onChange={(event) => setTerm(event.target.value)}
              />
              <button type="submit" className="ulink filters__go">Go</button>
            </div>
          </div>

          <fieldset className="filters__group">
            <legend className="meta filters__legend">Size</legend>
            <div className="chiprow">
              {sizes.map((size) => (
                <label
                  key={size}
                  className={`chip${filter.sizes.includes(size) ? ' chip--on' : ''}`}
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
          </fieldset>

          <fieldset className="filters__group">
            <legend className="meta filters__legend">Colour</legend>
            <ul className="filters__colors">
              {colors.map((color) => (
                <li key={color}>
                  <label
                    className={`filters__color${
                      filter.colors.includes(color) ? ' filters__color--on' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="visually-hidden"
                      checked={filter.colors.includes(color)}
                      onChange={() => apply({ colors: toggleValue(filter.colors, color) })}
                    />
                    <span className={`swatchdot dot--${color}`} aria-hidden="true" />
                    {color}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <div className="filters__group">
            <label htmlFor="shop-price" className="meta filters__legend">Price</label>
            <p className="filters__price tnum">
              {formatCents(priceFloor * 100)} &ndash; {formatCents(ceiling * 100)}
            </p>
            {/* Committing on release rather than on every input keeps one
                navigation per drag instead of one per pixel. */}
            <input
              id="shop-price"
              type="range"
              className="filters__range"
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
            <p className="filters__hint">Showing everything up to this price.</p>
          </div>

          <label className="filters__group">
            <span className="meta filters__legend">Sort</span>
            <select
              className="filters__select"
              value={filter.sort}
              onChange={(event) => apply({ sort: event.target.value as ProductSort })}
            >
              {PRODUCT_SORTS.map((sort) => (
                <option key={sort} value={sort}>{SORT_LABELS[sort] ?? sort}</option>
              ))}
            </select>
          </label>

          <div className="filters__foot">
            <p className="meta tnum">{count} {count === 1 ? 'style' : 'styles'}</p>
            {active ? (
              <button
                type="button"
                className="ulink"
                onClick={() => {
                  setTerm('');
                  setCeiling(priceCeiling);
                  apply({ sizes: [], colors: [], q: '', minPrice: null, maxPrice: null, gender: null });
                }}
              >
                Clear all
              </button>
            ) : null}
          </div>
        </div>
      </form>
  );
}
