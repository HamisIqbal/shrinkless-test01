/**
 * The wholesale line sheet: which styles trade sells.
 *
 * Nothing here holds copy or a price. Every wholesale style BORROWS its
 * description from a men's retail product that already exists in the store,
 * and the seed reads it off that product rather than restating it. A second
 * copy of the fabric paragraph would drift from the first the day anyone
 * edited one of them.
 *
 * `category` is a placeholder split, five and five, so the two shoppable
 * genders each have a full line. It is expected to be corrected in the admin
 * product editor; nothing here depends on a particular assignment, and
 * `seed:wholesale` never overwrites a style that already exists, so a
 * correction made there survives the next run.
 */

/**
 * The tag that keeps these off the retail storefront.
 *
 * A wholesale style is a real, published product — it has to be, or it could
 * not be edited in the admin — so "published" alone cannot mean "on the shop
 * grid". `lib/services/products.ts` excludes anything carrying this tag from
 * every customer-facing query, which is the one place that decision is made.
 */
export const WHOLESALE_TAG = 'wholesale';

/**
 * Where the shared description comes from, in order of preference.
 *
 * The four men's styles are one garment in four colourways and carry the same
 * copy word for word, so which one is read is immaterial — but naming a single
 * slug would break the seed the day that colourway was archived. The seed
 * walks this list and uses the first that resolves.
 */
export const WHOLESALE_COPY_SOURCES = [
  'mens-oversized-tshirt-mocha',
  'mens-oversized-tshirt-white',
  'mens-oversized-tshirt-charcoal',
  'mens-oversized-tshirt-grey',
];

/**
 * The size run every wholesale style is offered in.
 *
 * Stated here rather than copied from the source product because the men's
 * colourways do not agree with each other — three run s–xxl and one runs
 * xs–xl — and a line sheet quotes one run. The ratio inside it is broken to
 * the buyer's spec, which is what the page says under "Sizing".
 */
export const WHOLESALE_SIZES = ['s', 'm', 'l', 'xl', 'xxl'];

/** The four colourways the men's line is dyed in, offered across the sheet. */
export const WHOLESALE_COLORS = ['mocha', 'white', 'charcoal', 'grey'];

export type WholesaleSeed = {
  slug: string;
  title: string;
  category: 'men' | 'women';
};

/** Ten styles, split five and five. */
export const WHOLESALE_CATALOGUE: WholesaleSeed[] = [
  { slug: 'wholesale-razor-tank', title: 'Razor Tank', category: 'men' },
  { slug: 'wholesale-notch-tank', title: 'Notch Tank', category: 'women' },
  { slug: 'wholesale-sg-muscle', title: 'SG Muscle', category: 'men' },
  { slug: 'wholesale-crop-tee', title: 'Crop Tee', category: 'women' },
  { slug: 'wholesale-basic-tee', title: 'Basic Tee', category: 'men' },
  { slug: 'wholesale-boy-tee', title: 'Boy Tee', category: 'women' },
  { slug: 'wholesale-boy-tee-extended', title: 'Boy Tee Extended', category: 'men' },
  { slug: 'wholesale-long-dress', title: 'Long Dress', category: 'women' },
  { slug: 'wholesale-sporty-muscle', title: 'Sporty Muscle', category: 'men' },
  { slug: 'wholesale-v-neck-tee', title: 'V Neck Tee', category: 'women' },
];
