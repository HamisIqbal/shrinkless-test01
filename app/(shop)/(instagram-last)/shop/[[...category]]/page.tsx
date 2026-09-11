import { notFound } from 'next/navigation';
import { listPublishedProducts } from '@/lib/services/products';
import { productFilterSchema } from '@/lib/validation/catalogue';
import { shoppableCategories } from '@/lib/shop/menu.server';
import { getSiteContent } from '@/lib/services/site-content';
import { ShopBrowser } from '@/components/shop/ShopBrowser';

export const metadata = { title: 'Shop' };

/** Men and Women get a bare title and nothing else; every other category
 *  (currently just the unfiltered "All Products" grid) keeps the full intro.
 *  Both titles are editable on the Content tab, so what is named here is the
 *  key and the wording comes from the registry. */
const MINIMAL_TITLE_KEYS: Record<string, string> = {
  men: 'shop.men.title',
  women: 'shop.women.title',
};

const FALLBACK = {
  title: 'All Products',
  copy: 'Every Shrinkless style, in every colour we currently make it.',
};

export default async function ShopPage(props: PageProps<'/shop/[[...category]]'>) {
  const [{ category }, rawSearch] = await Promise.all([props.params, props.searchParams]);

  const categorySlug = category?.[0];

  // One segment or none. A catch-all takes whatever is after /shop, so
  // /shop/men/anything/at/all rendered the men's collection at a URL that
  // says something else — a page that lies to a shopper, and a duplicate of a
  // real one to anything crawling the store.
  if (category && category.length > 1) notFound();

  // An unknown category used to return an empty grid, which reads as "we sold
  // out" rather than "that page does not exist". The set of real categories is
  // now a database question, so a new one is navigable the moment it is
  // created rather than the next time this file is edited.
  if (categorySlug) {
    const categories = await shoppableCategories();
    if (!categories.some((entry) => entry.slug === categorySlug)) notFound();
  }

  const filter = productFilterSchema.parse(rawSearch);
  const copy = await getSiteContent();
  const products = await listPublishedProducts(filter, categorySlug);

  // The filter options describe the category, not the current result set —
  // otherwise filtering to XXL removes every other size from the list and the
  // shopper cannot get back without editing the URL.
  const all = await listPublishedProducts(
    { sizes: [], colors: [], sort: 'newest', q: '', minPrice: null, maxPrice: null, gender: null },
    categorySlug,
  );

  const sizes = [...new Set(all.flatMap((product) => product.sizes))];
  const colors = [...new Set(all.flatMap((product) => product.colors))];
  const prices = all.map((product) => product.minPriceCents / 100);
  const priceFloor = prices.length ? Math.floor(Math.min(...prices)) : 0;
  const priceCeiling = prices.length ? Math.ceil(Math.max(...prices)) : 0;

  const basePath = categorySlug ? `/shop/${categorySlug}` : '/shop';
  const minimalKey = categorySlug ? MINIMAL_TITLE_KEYS[categorySlug] : undefined;
  const minimalTitle = minimalKey ? copy[minimalKey] : undefined;

  return (
    <div className="band band--tight shoppage">
      <div className="wrap">
        <header className="shoppage__head">
          {minimalTitle ? (
            <h1 className="display shoppage__title">{minimalTitle}</h1>
          ) : (
            <>
              <p className="eyebrow">Collection</p>
              <h1 className="display shoppage__title">{FALLBACK.title}</h1>
              <p className="lede shoppage__intro">{FALLBACK.copy}</p>
            </>
          )}
        </header>

        <ShopBrowser
          products={products}
          filter={filter}
          sizes={sizes}
          colors={colors}
          priceFloor={priceFloor}
          priceCeiling={priceCeiling}
          basePath={basePath}
          focusSearch={rawSearch?.focus === 'search'}
        />
      </div>
    </div>
  );
}
