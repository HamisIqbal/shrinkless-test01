import { z } from 'zod';

const csvToArray = z
  .string()
  .optional()
  .transform((value) =>
    value
      ? value.split(',').map((part) => part.trim().toLowerCase()).filter(Boolean)
      : [],
  );

/** A bound is absent, or a non-negative number of dollars. Anything else is
 *  treated as absent rather than rejected: a hand-edited URL should degrade to
 *  the unfiltered catalogue, not to an error page. */
const priceBound = z
  .string()
  .optional()
  .transform((value) => {
    if (value === undefined || value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
  });

export const PRODUCT_SORTS = ['newest', 'price-asc', 'price-desc'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const productFilterSchema = z
  .object({
    size: csvToArray,
    color: csvToArray,
    sort: z
      .string()
      .optional()
      .transform((value): ProductSort =>
        PRODUCT_SORTS.includes(value as ProductSort) ? (value as ProductSort) : 'newest',
      ),
    // Free-text search, from the header. Trimmed here so a query of spaces is
    // indistinguishable from no query at all.
    q: z
      .string()
      .optional()
      .transform((value) => (value ?? '').trim()),
    // Price bounds, in whole dollars on the URL because that is what a shopper
    // reads on the slider. `null` means "no bound", which is not the same as
    // zero — a max of 0 would hide the whole catalogue.
    min: priceBound,
    max: priceBound,
    // Only meaningful where a listing mixes both categories in one grid (the
    // wholesale line sheet). Retail pages already split by category via the
    // URL path, so they parse this and never look at it.
    gender: z
      .string()
      .optional()
      .transform((value): 'men' | 'women' | null =>
        value === 'men' || value === 'women' ? value : null,
      ),
  })
  .transform(({ size, color, sort, q, min, max, gender }) => ({
    sizes: size,
    colors: color,
    sort,
    q,
    minPrice: min,
    maxPrice: max,
    gender,
  }));

export type ProductFilter = z.infer<typeof productFilterSchema>;
