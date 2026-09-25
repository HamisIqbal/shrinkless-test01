'use client';

import { useCallback, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'motion/react';
import { FilterDrawer } from '@/components/shop/FilterDrawer';
import { FilterPanel } from '@/components/shop/FilterPanel';
import { ProductCard } from '@/components/shop/ProductCard';
import { QuickView } from '@/components/shop/QuickView';
import { CloseIcon, FilterIcon } from '@/components/site/icons';
import {
  CLEAR_FILTERS,
  appliedFilters,
  buildFilterQuery,
  type FilterChange,
} from '@/lib/shop/filters';
import { PRODUCT_SORTS, type ProductFilter, type ProductSort } from '@/lib/validation/catalogue';
import type { ProductDTO } from '@/types/dto';
import './shop.css';

type Props = {
  /** Rendered by the default grid. Omit when passing `grid` and `count` instead
   *  (the wholesale line sheet, whose rows are not `ProductDTO`s). */
  products?: ProductDTO[];
  filter: ProductFilter;
  sizes: string[];
  colors: string[];
  genders?: { value: 'men' | 'women'; label: string }[];
  priceFloor: number;
  priceCeiling: number;
  basePath: string;
  focusSearch?: boolean;
  /** Result count for the bar and the filter drawer. Defaults to `products.length`. */
  count?: number;
  /** Overrides the default grid. */
  grid?: ReactNode;
  emptyMessage?: string;
};

const SORT_LABELS: Record<ProductSort, string> = {
  newest: 'Newest',
  'price-asc': 'Price, low to high',
  'price-desc': 'Price, high to low',
};

const DRAWER_ID = 'shop-filters';

/**
 * The collection view: a results bar over a full-width grid, with the filters
 * in a drawer from the left.
 *
 * The bar says what the page is showing. On the left, the way into the
 * filters — with a count when some are on — and a chip for each one that is,
 * so a filter can come off without opening anything. On the right, how many
 * styles that leaves and how they are ordered.
 *
 * The filters used to be a column that took a quarter of the width on a
 * desktop and a different control, a bottom sheet, on a phone. They are one
 * drawer now, at every width, opened the same way the cart is — so the grid
 * always has the whole row, and a shopper learns one way of filtering.
 *
 * Every change is a navigation to the same page with a new query. It runs in a
 * transition without scrolling, so the grid dims rather than jumping to the
 * top, and the drawer — which lives in this component's state — stays open
 * while filters are stacked.
 */
export function ShopBrowser({
  products,
  filter,
  sizes,
  colors,
  genders,
  priceFloor,
  priceCeiling,
  basePath,
  focusSearch = false,
  count,
  grid,
  emptyMessage = 'Nothing matches that. Clear a filter and try again.',
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const total = count ?? products?.length ?? 0;

  // The header's search lands here with the field expected to be ready.
  const [open, setOpen] = useState(focusSearch);
  const [quick, setQuick] = useState<ProductDTO | null>(null);

  const applied = appliedFilters(filter);

  const apply = useCallback(
    (change: Partial<FilterChange>) => {
      const query = buildFilterQuery(filter, change);
      startTransition(() => {
        router.push(query ? `${basePath}?${query}` : basePath, { scroll: false });
      });
    },
    [filter, basePath, router],
  );

  const close = useCallback(() => setOpen(false), []);

  return (
    <div className="sh-shop__layout">
      <div className="sh-shop__bar">
        <div className="sh-shop__filters">
          <button
            type="button"
            className="sh-shop__toggle"
            aria-expanded={open}
            aria-controls={DRAWER_ID}
            onClick={() => setOpen(true)}
          >
            <FilterIcon className="sh-shop__toggleicon" />
            <span>Filters</span>
            {applied.length ? (
              <span className="sh-shop__togglecount tnum">
                {applied.length}
                <span className="visually-hidden"> applied</span>
              </span>
            ) : null}
          </button>

          {applied.length ? (
            <ul className="sh-shop__applied" aria-label="Applied filters">
              {applied.map((entry) => (
                <li key={entry.key}>
                  <button
                    type="button"
                    className="sh-shop__chip"
                    disabled={pending}
                    onClick={() => apply(entry.clear)}
                  >
                    {entry.label}
                    <CloseIcon className="sh-shop__chipx" />
                    <span className="visually-hidden">, remove this filter</span>
                  </button>
                </li>
              ))}
              {applied.length > 1 ? (
                <li>
                  <button
                    type="button"
                    className="sh-link sh-shop__clear"
                    disabled={pending}
                    onClick={() => apply(CLEAR_FILTERS)}
                  >
                    Clear all
                  </button>
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>

        <div className="sh-shop__order">
          <p className="sh-shop__count tnum" aria-live="polite">
            {total} {total === 1 ? 'style' : 'styles'}
          </p>

          <label className="sh-shop__sort">
            <span className="visually-hidden">Sort by</span>
            <select
              className="sh-shop__select"
              value={filter.sort}
              onChange={(event) => apply({ sort: event.target.value as ProductSort })}
            >
              {PRODUCT_SORTS.map((sort) => (
                <option key={sort} value={sort}>{SORT_LABELS[sort] ?? sort}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className={`sh-shop__main${pending ? ' sh-shop__main--pending' : ''}`} aria-busy={pending}>
        {total === 0 ? (
          <div className="sh-shop__empty">
            <p>{emptyMessage}</p>
            {applied.length ? (
              <button type="button" className="sh-btn sh-btn--ghost" onClick={() => apply(CLEAR_FILTERS)}>
                Clear all filters
              </button>
            ) : null}
          </div>
        ) : (
          grid ?? (
            <ul className="sh-shop__grid">
              {(products ?? []).map((product, index) => (
                <li key={product.id}>
                  <ProductCard product={product} index={index} onQuickView={setQuick} />
                </li>
              ))}
            </ul>
          )
        )}

        {/* The whole collection is on the page at once, so without this the
            grid simply stopped and a shopper was left scrolling into the
            footer wondering whether more would load. */}
        {total > 0 ? (
          <p className="sh-shop__end tnum">
            <span>
              {total === 1 ? "That's the only style" : `That's all ${total} styles`}
              {applied.length ? ' matching your filters' : ''}
            </span>
          </p>
        ) : null}
      </div>

      <FilterDrawer
        id={DRAWER_ID}
        open={open}
        onClose={close}
        total={total}
        applied={applied.length}
        onClear={() => apply(CLEAR_FILTERS)}
        pending={pending}
      >
        <FilterPanel
          filter={filter}
          sizes={sizes}
          colors={colors}
          genders={genders}
          priceFloor={priceFloor}
          priceCeiling={priceCeiling}
          focusSearch={focusSearch}
          apply={apply}
        />
      </FilterDrawer>

      {/* One dialog for the whole grid rather than one per card. Keyed by
          product, so opening a different card mounts a fresh dialog rather
          than inheriting the last one's chosen size. */}
      <AnimatePresence>
        {quick ? (
          <QuickView key={quick.id} product={quick} onClose={() => setQuick(null)} />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
