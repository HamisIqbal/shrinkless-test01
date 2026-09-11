/**
 * Navigation shape and the fixed parts of the menu.
 *
 * Deliberately free of anything that touches the database: `Header` is a
 * client component and imports `PRIMARY_NAV` from here, so a service import in
 * this file drags mongoose into the browser bundle. The query that fills the
 * menu in lives in `menu.server.ts`.
 */
import type { BrandImage, CategorySlug } from '@/lib/brand/images';

export type NavLink = {
  href: string;
  label: string;
  /**
   * Draws this entry apart from the rest of the bar rather than beside it.
   *
   * Reserved for a destination that is not another way into the same shop —
   * wholesale sells by the mill run, to a different buyer, at a price a
   * retail shopper cannot have. A plain link would file it under "more
   * categories", which is the one thing it is not.
   */
  highlight?: boolean;
};

export type NavColumn = {
  /** Column heading. Links to the category landing page where there is one. */
  title: string;
  href?: string;
  links: NavLink[];
};

export type NavFeature = {
  href: string;
  label: string;
  caption: string;
  image: BrandImage;
};

export type ShopMenu = {
  columns: NavColumn[];
  features: NavFeature[];
};

/** The categories that have their own landing page and gateway frame. */
export const SHOPPABLE: { slug: CategorySlug; label: string }[] = [
  { slug: 'men', label: 'Men' },
  { slug: 'women', label: 'Women' },
];

/** Top-level bar. Everything here resolves to a route that exists. */
export const PRIMARY_NAV: NavLink[] = [
  { href: '/shop', label: 'Shop' },
  { href: '/shop/men', label: 'Men' },
  { href: '/shop/women', label: 'Women' },
  // Flagged, and ahead of the story. Trade closes the run of shopping
  // destinations rather than trailing the bar, because a buyer who came for
  // the line sheet should meet it before the brand's own history does.
  { href: '/wholesale', label: 'Wholesale', highlight: true },
  { href: '/our-story', label: 'About Us' },
];
