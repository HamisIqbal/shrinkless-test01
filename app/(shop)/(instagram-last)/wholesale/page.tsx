import { listWholesaleProducts } from '@/lib/services/wholesale';
import { getContentLayer, getSiteContent } from '@/lib/services/site-content';
import { ContentLayer } from '@/components/site/ContentLayer';
import { productFilterSchema } from '@/lib/validation/catalogue';
import { ShopBrowser } from '@/components/shop/ShopBrowser';
import { WholesaleGrid } from '@/components/shop/WholesaleGrid';
import type { WholesaleProductDTO } from '@/types/dto';

export const metadata = {
  title: 'Wholesale',
  description:
    'Shrinkless trade terms: ten styles, made to order, from 150 units. Request a quote.',
};

const GENDER_OPTIONS: { value: 'men' | 'women'; label: string }[] = [
  { value: 'men', label: 'Men' },
  { value: 'women', label: 'Women' },
];

/** The figure a buyer actually reads off the card: the opening tier's
 *  per-unit price, not the retail basis it was struck from. */
function openingPriceCents(style: WholesaleProductDTO): number {
  return style.tiers[0]?.unitPriceCents ?? style.retailCents;
}

/**
 * The trade line sheet.
 *
 * Filtered the same way the shop's Men and Women pages are — same panel,
 * same size/colour/price/search mechanics, reused as-is — with a gender
 * facet added since one grid here mixes both categories. Nothing here can be
 * bought: at 150 units a price is the opening of a conversation, not a
 * checkout, so the sheet collects an enquiry and the store replies with real
 * terms. That enquiry flow and the per-style spec live on the style's own
 * page, untouched by this listing.
 */
export default async function WholesalePage(props: PageProps<'/wholesale'>) {
  const rawSearch = await props.searchParams;
  const filter = productFilterSchema.parse(rawSearch);

  const [all, copy] = await Promise.all([listWholesaleProducts(), getSiteContent()]);

  // Filter options describe the whole line sheet, not the current result
  // set — otherwise filtering to Women removes Men from the gender chips and
  // a buyer cannot get back without editing the URL.
  const sizes = [...new Set(all.flatMap((style) => style.sizes))];
  const colors = [...new Set(all.flatMap((style) => style.colors))];
  const present = new Set(all.map((style) => style.category));
  const genders = GENDER_OPTIONS.filter((option) => present.has(option.value));

  const prices = all.map((style) => openingPriceCents(style) / 100);
  const priceFloor = prices.length ? Math.floor(Math.min(...prices)) : 0;
  const priceCeiling = prices.length ? Math.ceil(Math.max(...prices)) : 0;

  const needle = filter.q.toLowerCase();

  const styles = all.filter((style) => {
    const genderOk = !filter.gender || style.category === filter.gender;
    const sizeOk =
      !filter.sizes.length || style.sizes.some((size) => filter.sizes.includes(size.toLowerCase()));
    const colorOk =
      !filter.colors.length ||
      style.colors.some((color) => filter.colors.includes(color.toLowerCase()));
    const textOk =
      !needle ||
      style.title.toLowerCase().includes(needle) ||
      style.description.toLowerCase().includes(needle) ||
      style.colors.some((color) => color.toLowerCase().includes(needle));
    const price = openingPriceCents(style);
    const priceOk =
      (filter.minPrice === null || price >= filter.minPrice * 100) &&
      (filter.maxPrice === null || price <= filter.maxPrice * 100);

    return genderOk && sizeOk && colorOk && textOk && priceOk;
  });

  // "Newest" leaves the line sheet in the order it was seeded — a document,
  // not a feed — so only the two price sorts reorder it.
  if (filter.sort === 'price-asc') {
    styles.sort((a, b) => openingPriceCents(a) - openingPriceCents(b));
  } else if (filter.sort === 'price-desc') {
    styles.sort((a, b) => openingPriceCents(b) - openingPriceCents(a));
  }

  return (
    <div className="band band--ink tradesheet">
      <div className="wrap">
        <header className="tradesheet__head">
          <h1 className="display tradesheet__title">{copy['wholesale.title']}</h1>
        </header>

        <ContentLayer {...(await getContentLayer('wholesale'))} />

        <ShopBrowser
          filter={filter}
          sizes={sizes}
          colors={colors}
          genders={genders}
          priceFloor={priceFloor}
          priceCeiling={priceCeiling}
          basePath="/wholesale"
          count={styles.length}
          grid={<WholesaleGrid styles={styles} />}
          emptyMessage="Nothing matches that. Clear a filter and try again."
        />
      </div>
    </div>
  );
}
