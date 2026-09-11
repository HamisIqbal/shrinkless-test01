'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { FilterPanel } from '@/components/shop/FilterPanel';
import { ProductGrid } from '@/components/shop/ProductGrid';
import type { ProductFilter } from '@/lib/validation/catalogue';
import type { ProductDTO } from '@/types/dto';

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
  /** Overrides the default `ProductGrid`. */
  grid?: ReactNode;
  emptyMessage?: string;
};

/** Where the column layout takes over from the sheet. Matches storefront.css. */
const DESKTOP = '(min-width: 62rem)';

/**
 * The collection view. Two different things depending on the width, and
 * deliberately so.
 *
 * On a desktop it is a filter column on the left and products on the right,
 * with a toggle that collapses the column to nothing and hands the grid every
 * pixel of it. The toggle sits in the product column rather than inside the
 * panel: kept inside, the collapsed panel still had to be wide enough to hold
 * its own button, so "hiding" the filters actually widened the sidebar.
 *
 * On a phone it is a sheet. Stacked in the flow, the column put a search box,
 * five size chips, a colour list and a price slider between the shopper and
 * the first photograph — you landed on a collection and saw a form. So the
 * controls come out of the flow entirely and the only thing left above the
 * grid is the word "Filters".
 *
 * Which of the two a tap means is read at the moment of the tap rather than
 * stored, because the server has no idea how wide the window is and guessing
 * wrong would render the phone's sheet already open on first paint.
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
  const total = count ?? products?.length ?? 0;
  const [column, setColumn] = useState(true);
  const [sheet, setSheet] = useState(false);

  // Only for the button's label and `aria-expanded`, which have to describe
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
      className={`shoplayout${column ? '' : ' shoplayout--shut'}${
        sheet ? ' shoplayout--sheet' : ''
      }`}
    >
      {/* Tapping the dimmed page is the fastest way out of a sheet, and the
          fastest way out is the one people reach for first. Inert on desktop,
          where there is no scrim to tap. */}
      <button
        type="button"
        className="shoplayout__scrim"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => setSheet(false)}
      />

      <div className="shoplayout__aside" inert={!open}>
        <div className="shoplayout__sheetbar">
          <p className="meta">Filters</p>
          <button type="button" className="ulink" onClick={() => setSheet(false)}>
            Close
          </button>
        </div>

        <div className="shoplayout__asidescroll">
          <FilterPanel
            filter={filter}
            sizes={sizes}
            colors={colors}
            genders={genders}
            priceFloor={priceFloor}
            priceCeiling={priceCeiling}
            basePath={basePath}
            count={total}
            focusSearch={focusSearch}
          />
        </div>

        {/* The sheet stays up while filters are stacked, so it needs a way to
            say "done" that is not the same word as "cancel". */}
        <div className="shoplayout__sheetfoot">
          <button type="button" className="btn btn--block" onClick={() => setSheet(false)}>
            Show {total} {total === 1 ? 'style' : 'styles'}
          </button>
        </div>
      </div>

      <div className="shoplayout__main">
        <div className="shoplayout__bar">
          <button
            type="button"
            className="filters__toggle"
            aria-expanded={open}
            aria-controls="shop-filters"
            onClick={toggle}
          >
            <span className="filters__togglemark" aria-hidden="true" />
            {/* Both labels are rendered and CSS picks one. Choosing in JS
                would mean the server guessing the viewport, and a desktop
                would read "Filters" for the frame before hydration corrected
                it to "Hide filters". */}
            <span className="filters__wide">{column ? 'Hide filters' : 'Filters'}</span>
            <span className="filters__narrow">Filters</span>
            {active && !open ? <span className="filters__dot" aria-hidden="true" /> : null}
          </button>

          <p className="meta tnum">
            {total} {total === 1 ? 'style' : 'styles'}
          </p>
        </div>

        {total === 0 ? (
          <p className="lede shoppage__empty">{emptyMessage}</p>
        ) : (
          grid ?? <ProductGrid products={products ?? []} columns={3} />
        )}
      </div>
    </div>
  );
}
