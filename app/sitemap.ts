import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site';
import { connectToDatabase } from '@/lib/db/connection';
import { Product } from '@/lib/db/models/product';
import { listVisibleCategories } from '@/lib/services/categories';
import { isWholesaleProduct } from '@/lib/services/wholesale';
import { LEGAL_PAGES } from '@/lib/legal/pages';

/** Rebuilt hourly rather than per request: a crawler does not need a product
 *  the minute it is published. */
export const revalidate = 3600;

const STATIC_PATHS = ['/', '/shop', '/our-story', '/why-shrinkless', '/faq', '/wholesale'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    ...STATIC_PATHS,
    ...LEGAL_PAGES.map((page) => page.href),
  ].map((path) => ({ url: absoluteUrl(path) }));

  // A database hiccup must cost the dynamic half of the sitemap, not all of it.
  try {
    await connectToDatabase();

    const [products, categories] = await Promise.all([
      Product.find({ status: 'published', archivedAt: null })
        .select('slug tags updatedAt')
        .lean(),
      listVisibleCategories(),
    ]);

    for (const category of categories) {
      entries.push({ url: absoluteUrl(`/shop/${category.slug}`) });
    }

    for (const product of products) {
      const base = isWholesaleProduct(product.tags) ? '/wholesale' : '/product';
      entries.push({
        url: absoluteUrl(`${base}/${product.slug}`),
        lastModified: product.updatedAt,
      });
    }
  } catch (error) {
    console.error('sitemap: could not list products', error);
  }

  return entries;
}
