/**
 * The bounds a stock figure has to sit inside.
 *
 * Here rather than in `lib/services/inventory.ts` because the forms that
 * collect these numbers are client components, and importing the service to
 * reach a constant drags Mongoose into the browser bundle — which is not a
 * subtle failure: several admin pages stop rendering.
 */

/**
 * The most units one variant may hold.
 *
 * A ceiling exists at all because `Number.isInteger(1e21)` is true, and a
 * stock level past 2^53 stops being a number the system can do arithmetic on:
 * the correction that should put it back computes a delta that rounds to the
 * whole figure, so asking to set the variant to 18 sets it to 0 and it cannot
 * be recovered through the panel at all. A mistyped adjustment is the only way
 * to get there, and it is one keystroke away from a legitimate one.
 *
 * A million units is far past anything this store will hold and far short of
 * where doubles start losing whole numbers, which is the whole job.
 */
export const MAX_STOCK = 1_000_000;

export const STOCK_RANGE_ERROR =
  `A stock figure has to be a whole number of units, no more than ${MAX_STOCK.toLocaleString('en-US')}.`;
