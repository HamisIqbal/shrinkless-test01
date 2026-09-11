import { PRODUCT_COPY } from './product-copy';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/db/connection';
import { Product } from '@/lib/db/models/product';
import { Variant } from '@/lib/db/models/variant';
import { PRODUCT_IMAGES, type BrandImage, type ProductSlug } from '@/lib/brand/images';

/**
 * The Shrinkless catalogue: six tees across two shoppable categories.
 *
 * PRICES ARE ASSUMPTIONS. So are the fabric weights in the copy, and so are
 * the RATINGS — there is no review collection yet, and every number below was
 * invented to make the storefront demonstrable. All three need replacing with
 * real figures before launch. A rating of 0 draws no badge at all, which is
 * the honest setting for anything unreviewed.
 *
 * Colours are listed in the same order as the product's frames in
 * `PRODUCT_IMAGES`, because `lib/shop/colorways.ts` matches the two up
 * positionally. Reorder one without the other and the black tee gets the
 * white photograph.
 *
 * Product images are stored as absolute URLs rather than Cloudinary public
 * IDs; `lib/images.ts` passes those through untouched, so real uploads replace
 * them without a code change.
 */

const MENS_SIZES = ['s', 'm', 'l', 'xl', 'xxl'];
const WOMENS_SIZES = ['xs', 's', 'm', 'l', 'xl'];

type Seed = {
  slug: ProductSlug;
  title: string;
  category: 'men' | 'women';
  priceCents: number;
  /** Positional against PRODUCT_IMAGES[slug]. */
  colors: string[];
  sizes: string[];
  featured: boolean;
  /** Editorial flag drawn on the card. Sold out is worked out from stock. */
  badge?: 'new';
  /** Out of 5, drawn top left on the card. Omit for no badge. */
  rating?: number;
  description: string;
  /** `${color}:${size}` pairs that should read as sold out. */
  soldOut?: string[];
};

/** Every pair, for a style that is out across the board. */
function everyPair(colors: string[], sizes: string[]): string[] {
  return colors.flatMap((color) => sizes.map((size) => `${color}:${size}`));
}

const CATALOGUE: Seed[] = [
  {
    slug: 'mens-organic-tee',
    title: 'Organic Tee',
    category: 'men',
    priceCents: 4800,
    colors: ['white', 'black', 'bone'],
    sizes: MENS_SIZES,
    featured: true,
    rating: 4.9,
    description: PRODUCT_COPY['mens-organic-tee'],
    soldOut: ['bone:xxl'],
  },
  {
    slug: 'mens-heavyweight-tee',
    title: 'Heavyweight Tee',
    category: 'men',
    priceCents: 6200,
    colors: ['black', 'charcoal'],
    sizes: MENS_SIZES,
    featured: true,
    rating: 4.8,
    description: PRODUCT_COPY['mens-heavyweight-tee'],
    soldOut: ['charcoal:s'],
  },
  {
    slug: 'mens-long-sleeve-tee',
    title: 'Long Sleeve Tee',
    category: 'men',
    priceCents: 5800,
    colors: ['teal', 'white'],
    sizes: MENS_SIZES,
    featured: false,
    rating: 5,
    badge: 'new',
    description: PRODUCT_COPY['mens-long-sleeve-tee'],
  },
  {
    slug: 'womens-organic-tee',
    title: 'Organic Tee',
    category: 'women',
    priceCents: 4600,
    colors: ['white', 'heather'],
    sizes: WOMENS_SIZES,
    featured: true,
    rating: 4.9,
    description: PRODUCT_COPY['womens-organic-tee'],
    soldOut: ['heather:xs'],
  },
  {
    slug: 'womens-boxy-tee',
    title: 'Boxy Tee',
    category: 'women',
    priceCents: 5200,
    colors: ['olive', 'bone'],
    sizes: WOMENS_SIZES,
    featured: false,
    rating: 4.7,
    description: PRODUCT_COPY['womens-boxy-tee'],
    // Out in every colour and every size, so the catalogue has one style that
    // exercises the sold-out treatment on the card rather than only the
    // struck-through size chip on the product page.
    soldOut: everyPair(['olive', 'bone'], WOMENS_SIZES),
  },
  {
    slug: 'womens-everyday-tee',
    title: 'Everyday Tee',
    category: 'women',
    priceCents: 4400,
    colors: ['black', 'charcoal'],
    sizes: WOMENS_SIZES,
    featured: false,
    rating: 4.8,
    description: PRODUCT_COPY['womens-everyday-tee'],
    soldOut: ['charcoal:l'],
  },
];

/** Frames are stored with pixel dimensions; the manifest states a ratio. */
const ASPECT_SIZES: Record<BrandImage['aspect'], { width: number; height: number }> = {
  '3:2': { width: 1600, height: 1067 },
  '4:5': { width: 1600, height: 2000 },
  '2:3': { width: 1600, height: 2400 },
  '1:1': { width: 1600, height: 1600 },
};

function skuFor(slug: string, color: string, size: string): string {
  const stem = slug.replace(/^(mens|womens)-/, (m) => (m === 'mens-' ? 'M-' : 'W-'));
  return `SL-${stem}-${color}-${size}`.toUpperCase();
}

async function main() {
  await connectToDatabase();

  await Variant.deleteMany({});
  await Product.deleteMany({});

  let variantCount = 0;

  for (const seed of CATALOGUE) {
    const frames = PRODUCT_IMAGES[seed.slug];

    const product = await Product.create({
      title: seed.title,
      slug: seed.slug,
      description: seed.description,
      category: seed.category,
      status: 'published',
      featured: seed.featured,
      badge: seed.badge ?? 'none',
      rating: seed.rating ?? 0,
      images: frames.map((frame) => ({
        publicId: frame.url,
        ...ASPECT_SIZES[frame.aspect],
        alt: frame.alt,
      })),
      optionSets: { sizes: seed.sizes, colors: seed.colors },
    });

    const soldOut = new Set(seed.soldOut ?? []);

    for (const color of seed.colors) {
      for (const size of seed.sizes) {
        await Variant.create({
          productId: product._id,
          size,
          color,
          sku: skuFor(seed.slug, color, size),
          priceCents: seed.priceCents,
          stock: soldOut.has(`${color}:${size}`) ? 0 : 18,
        });
        variantCount += 1;
      }
    }

    console.log(
      `  ${seed.category.padEnd(5)} ${seed.slug.padEnd(24)} ` +
        `${seed.colors.length}x${seed.sizes.length} @ $${(seed.priceCents / 100).toFixed(2)}` +
        `${seed.featured ? '  [featured]' : ''}`,
    );
  }

  console.log(`\nseeded ${CATALOGUE.length} products, ${variantCount} variants`);

  await disconnectFromDatabase();
}

main().catch(async (error) => {
  console.error(error);
  await disconnectFromDatabase();
  process.exit(1);
});
