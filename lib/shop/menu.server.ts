import { listProductsInCategory } from '@/lib/services/products';
import { listVisibleCategories } from '@/lib/services/categories';
import { categoryImage, getSiteMedia } from '@/lib/services/site-media';
import { SHOPPABLE, type NavColumn, type NavFeature, type ShopMenu } from '@/lib/shop/navigation';

export type ShoppableCategory = { slug: string; label: string };

/**
 * The categories the storefront will offer, from the database.
 *
 * These used to be a hard-coded array, which meant adding a category was a
 * deploy. They now come from the `Category` collection — with the old array as
 * a fallback, because a store whose categories have not been imported yet must
 * still have a navigable shop rather than an empty menu.
 */
export async function shoppableCategories(): Promise<ShoppableCategory[]> {
  const categories = await listVisibleCategories();

  if (!categories.length) return SHOPPABLE.map(({ slug, label }) => ({ slug, label }));

  return categories.map((category) => ({ slug: category.slug, label: category.name }));
}

/**
 * The desktop mega menu, assembled from the catalogue rather than hard-coded.
 *
 * A hand-written menu drifts the moment a product is added or unpublished, and
 * the drift is invisible until a customer hits a dead link. Reading the real
 * categories means the menu can only ever offer what the store actually sells.
 */
export async function buildShopMenu(): Promise<ShopMenu> {
  const categories = await shoppableCategories();

  // The tiles are the admin's to change, so the menu reads them rather than a
  // constant. Categories with no art of their own still get the stand-in —
  // an empty tile reads as a broken page.
  const [media, products] = await Promise.all([
    getSiteMedia(),
    Promise.all(categories.map((category) => listProductsInCategory(category.slug))),
  ]);

  const columns: NavColumn[] = [
    {
      title: 'Shop',
      href: '/shop',
      links: [
        { href: '/shop', label: 'All Products' },
        { href: '/shop?sort=newest', label: 'New Arrivals' },
        { href: '/shop?sort=price-asc', label: 'Price, Low to High' },
      ],
    },
    ...categories.map((category, index) => ({
      title: category.label,
      href: `/shop/${category.slug}`,
      links: [
        { href: `/shop/${category.slug}`, label: `All ${category.label}’s` },
        ...products[index].map((product) => ({
          href: `/product/${product.slug}`,
          label: product.title,
        })),
      ],
    })),
  ];

  const features: NavFeature[] = categories.map((category, index) => ({
    href: `/shop/${category.slug}`,
    label: category.label,
    caption: `${products[index].length} ${products[index].length === 1 ? 'style' : 'styles'}`,
    image: categoryImage(media, category.slug),
  }));

  return { columns, features };
}
