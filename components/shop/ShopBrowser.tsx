'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'motion/react';
import { FilterPanel } from '@/components/shop/FilterPanel';
import { ProductCard } from '@/components/shop/ProductCard';
import { QuickView } from '@/components/shop/QuickView';
import { buildFilterQuery } from '@/lib/shop/filters';
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
  /** Result count for the bar and the filter panel. Defaults to `products.length`. */
  count?: number;
  /** Overrides the default grid. */
  grid?: ReactNode;
  emptyMessage?: string;
};

/** Where the column layout takes over from the sheet. Matches shop.css. */
const DESKTOP = '(min-width: 62rem)';

const SORT_LABELS: Record<ProductSort, string> = {
  newest: 'Newest',
  'price-asc': 'Price, low to high',
  'price-desc': 'Price, high to low',
};

/**
 * The collection view: a results bar, a filter column and a grid.
 *
 * Two different things depending on the width, and deliberately so. On a
 * desktop it is a filter column on the left and products on the right, with a
 * toggle that collapses the column to nothing and hands the grid the pixels —
 * three cards a row become four. The toggle sits in the product column rather
 * than inside the panel: kept inside, the collapsed panel still had to be wide
 * enough to hold its own button, so "hiding" the filters actually widened the
 * sidebar.
 *
 * On a phone it is a sheet that comes up from the foot of the screen, because
 * stacked in the flow the controls put a search box, five size chips, a colour
 * list and a price slider between the shopper and the first photograph.
 *
 * The bar is new, and it is where the page's state is stated plainly: the way
 * into the filters on the left, how many styles that leaves and how they are
 * ordered on the right. Sort was at the foot of the filter form; it is not a
 * filter, and it belongs beside the result it reorders.
 *
 * Which of the two a tap on the toggle means is read at the moment of the tap
 * rather than stored, because the server has no idea how wide the window is
 * and guessing wrong would render the phone's sheet already open on first
 * paint.
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

  const total = count ?? products?.length ?? 0;
  const [column, setColumn] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [quick, setQuick] = useState<ProductDTO | null>(null);

  // Only for the toggle's label and `aria-expanded`, which have to describe
  // whichever control the tap will actually operate. Starts false so the
  // server and the first client render agree; a desktop corrects itself before
  // paint.
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP);

    const sync = () => {
      setDesktop(query.matches);

      // A sheet left open behind a rotate into the desktop layout would sit
      // there as an invisible full-screen overlay over a column that is
      // already showing the same controls.
      if (query.matches) setSheet(false);
    };

    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!sheet) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setSheet(false);
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [sheet]);

  const toggle = useCallback(() => {
    if (window.matchMedia(DESKTOP).matches) setColumn((value) => !value);
    else setSheet((value) => !value);
  }, []);

  const open = desktop ? column : sheet;

  const active =
    filter.sizes.length > 0 ||
    filter.colors.length > 0 ||
    filter.q !== '' ||
    filter.minPrice !== null ||
    filter.maxPrice !== null ||
    Boolean(filter.gender);

  return (
    <div
      className={`sh-shop__layout${column ? '' : ' sh-shop__layout--shut'}${
        sheet ? ' sh-shop__layout--sheet' : ''
      }`}
    >
      {/* Tapping the dimmed page is the fastest way out of a sheet, and the
          fastest way out is the one people reach for first. Inert on desktop,
          where there is no scrim to tap. */}
      <button
        type="button"
        className="sh-shop__scrim"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => setSheet(false)}
      />

      <div className="sh-shop__aside" inert={!open}>
        <div className="sh-shop__sheetbar">
          <p className="sh-label">Filters</p>
          <button type="button" className="sh-link" onClick={() => setSheet(false)}>
            Close
          </button>
        </div>

        <div className="sh-shop__asidescroll">
          <FilterPanel
            filter={filter}
            sizes={sizes}
            colors={colors}
            genders={genders}
            priceFloor={priceFloor}
            priceCeiling={priceCeiling}
            basePath={basePath}
            focusSearch={focusSearch}
          />
        </div>

        {/* The sheet stays up while filters are stacked, so it needs a way to
            say "done" that is not the same word as "cancel". */}
        <div className="sh-shop__sheetfoot">
          <button
            type="button"
            className="sh-btn sh-btn--block"
            onClick={() => setSheet(false)}
          >
            Show {total} {total === 1 ? 'style' : 'styles'}
          </button>
        </div>
      </div>

      <div className="sh-shop__main">
        <div className="sh-shop__bar">
          <button
            type="button"
            className="sh-shop__toggle"
            aria-expanded={open}
            aria-controls="shop-filters"
            onClick={toggle}
          >
            <span className="sh-shop__togglemark" aria-hidden="true" />
            {/* Both labels are rendered and CSS picks one. Choosing in JS would
                mean the server guessing the viewport, and a desktop would read
                "Filters" for the frame before hydration corrected it. */}
            <span className="sh-shop__wide">{column ? 'Hide filters' : 'Filters'}</span>
            <span className="sh-shop__narrow">Filters</span>
            {active && !open ? <span className="sh-shop__dot" aria-hidden="true" /> : null}
          </button>

          <p className="sh-shop__count tnum">
            {total} {total === 1 ? 'style' : 'styles'}
          </p>

          <label className="sh-shop__sort">
            <span className="sh-label">Sort</span>
            <select
              className="sh-shop__select"
              value={filter.sort}
              onChange={(event) => {
                const query = buildFilterQuery(filter, {
                  sort: event.target.value as ProductSort,
                });
                router.push(query ? `${basePath}?${query}` : basePath);
              }}
            >
              {PRODUCT_SORTS.map((sort) => (
                <option key={sort} value={sort}>{SORT_LABELS[sort] ?? sort}</option>
              ))}
            </select>
          </label>
        </div>

        {total === 0 ? (
          <p className="sh-shop__empty">{emptyMessage}</p>
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
      </div>

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
