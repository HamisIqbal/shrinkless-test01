import { notFound } from 'next/navigation';
import { listPublishedProducts } from '@/lib/services/products';
import { productFilterSchema } from '@/lib/validation/catalogue';
import { shoppableCategories } from '@/lib/shop/menu.server';
import { getSiteContent } from '@/lib/services/site-content';
import { ShopBrowser } from '@/components/shop/ShopBrowser';
import { categoryImage, getSiteMedia } from '@/lib/services/site-media';
import { CatalogueHead } from '@/components/pages/CatalogueHead';
import { HomeGateway } from '@/components/home/HomeGateway';
import { SHOPPABLE } from '@/lib/shop/navigation';
import { homeFonts } from '@/components/home/fonts';
import { HomeScrollSync } from '@/components/home/HomeScene';
import '@/components/shop/shop.css';

export const metadata = { title: 'Shop' };

/** Men and Women get a bare title and nothing else; every other category
 *  (currently just the unfiltered "All Products" grid) keeps the full intro.
 *  Both titles are editable on the Content tab, so what is named here is the
 *  key and the wording comes from the registry. */
const MINIMAL_TITLE_KEYS: Record<string, string> = {
  men: 'shop.men.title',
  women: 'shop.women.title',
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
  const categories = categorySlug ? await shoppableCategories() : [];
  if (categorySlug && !categories.some((entry) => entry.slug === categorySlug)) notFound();

  const filter = productFilterSchema.parse(rawSearch);
  const copy = await getSiteContent();
  const media = await getSiteMedia();

  // The category itself, once it has passed the check above — read off the
  // same list rather than queried again, so a category the admin has created
  // (anything past Men and Women) still has a name to put over its grid.
  const activeCategory = categorySlug
    ? categories.find((entry) => entry.slug === categorySlug)
    : undefined;

  // Men and Women open on their own photograph; the unfiltered grid has no art
  // of its own, and a stand-in would be a lie about the page. Both facts are
  // read off one value, so the type narrows without an assertion.
  const minimalKey = categorySlug ? MINIMAL_TITLE_KEYS[categorySlug] : undefined;
  const lit = categorySlug && minimalKey
    ? { title: copy[minimalKey], image: categoryImage(media, categorySlug) }
    : null;

  // The door to the other collection, so Men and Women cross-link the way the
  // homepage's two doors do.
  const others = SHOPPABLE.filter(({ slug }) => slug !== categorySlug);

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

  return (
    <>
      {lit ? (
        <CatalogueHead title={lit.title} count={all.length} image={lit.image} />
      ) : activeCategory ? (
        // A category with no minimal-title key of its own — anything the
        // admin has added beyond Men and Women — still gets its own name
        // rather than the unfiltered grid's, with no eyebrow, lede or
        // photograph it does not have.
        <CatalogueHead title={activeCategory.label} count={all.length} />
      ) : (
        <CatalogueHead
          eyebrow={copy['shop.all.eyebrow']}
          title={copy['shop.all.title']}
          lede={copy['shop.all.lede']}
          count={all.length}
        />
      )}

      <div className={`sh-shop ${homeFonts}`}>
        <div className="sh-wrap">
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

      {/* One door on a category page, both on the unfiltered grid. */}
      <HomeGateway
        gateways={others.map(({ slug, label }) => ({
          slug,
          label,
          count: 0,
          image: categoryImage(media, slug),
        }))}
      />

      <HomeScrollSync />
    </>
  );
}
