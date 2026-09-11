import { connectToDatabase } from '@/lib/db/connection';
import { Product } from '@/lib/db/models/product';
import { Variant } from '@/lib/db/models/variant';
import {
  WHOLESALE_CATALOGUE,
  WHOLESALE_COLORS,
  WHOLESALE_COPY_SOURCES,
  WHOLESALE_SIZES,
  WHOLESALE_TAG,
} from '@/lib/wholesale/catalogue';

/**
 * Creating the wholesale line sheet, as a function rather than as a script.
 *
 * It lives here so it can be tested. The first version of this was a script
 * only, written against the placeholder catalogue in the repo's seed file, and
 * it would have refused to run against the real store — whose men's line is
 * four colourways of one oversized tee, not the three styles the repo
 * invents. Nothing caught that, because nothing could: a script's assumptions
 * about the shape of the data are only checked when someone runs it against
 * the real thing.
 */

export class NoCopySourceError extends Error {
  constructor(readonly tried: readonly string[]) {
    super(
      `None of the men's styles this copy is borrowed from are in the database ` +
        `(${tried.join(', ')}). Seed the retail catalogue first, or update ` +
        `WHOLESALE_COPY_SOURCES in lib/wholesale/catalogue.ts.`,
    );
    this.name = 'NoCopySourceError';
  }
}

export class NoPriceBasisError extends Error {
  constructor(readonly slug: string) {
    super(
      `${slug} has no sellable variants, so there is no retail price to strike ` +
        `the wholesale ladder from.`,
    );
    this.name = 'NoPriceBasisError';
  }
}

export type SeedReport = {
  /** The style the description and price basis were read from. */
  sourceSlug: string;
  priceCents: number;
  created: string[];
  skipped: string[];
  variantCount: number;
};

export function skuFor(slug: string, color: string, size: string): string {
  return `SL-WS-${slug.replace(/^wholesale-/, '')}-${color}-${size}`.toUpperCase();
}

/**
 * Inserts any wholesale style that is not already there.
 *
 * INSERT-ONLY, and that is the contract rather than an implementation detail:
 * the genders are a placeholder split meant to be corrected in the admin, and
 * photography is added there too, so re-running this must never rewrite a
 * style that already exists.
 */
export async function seedWholesale(): Promise<SeedReport> {
  await connectToDatabase();

  // The men's colourways carry the same copy, so the first that resolves is
  // as good as any. Walking the list rather than naming one slug means
  // archiving a colourway does not break the seed.
  const source = await Product.findOne({ slug: { $in: WHOLESALE_COPY_SOURCES } }).lean();

  if (!source) throw new NoCopySourceError(WHOLESALE_COPY_SOURCES);

  const sourceVariants = await Variant.find({ productId: source._id }).lean();
  const sellable = sourceVariants.filter((variant) => variant.enabled);

  if (!sellable.length) throw new NoPriceBasisError(source.slug);

  // What a retail shopper would have been shown: the cheapest sellable
  // variant, not whichever one the query happened to return first.
  const priceCents = Math.min(...sellable.map((variant) => variant.priceCents));

  const report: SeedReport = {
    sourceSlug: source.slug,
    priceCents,
    created: [],
    skipped: [],
    variantCount: 0,
  };

  for (const entry of WHOLESALE_CATALOGUE) {
    if (await Product.exists({ slug: entry.slug })) {
      report.skipped.push(entry.slug);
      continue;
    }

    const product = await Product.create({
      title: entry.title,
      slug: entry.slug,
      description: source.description,
      category: entry.category,
      status: 'published',
      // Load-bearing: this is what keeps these off the retail storefront.
      // See `lib/services/products.ts`.
      tags: [WHOLESALE_TAG],
      // Deliberately empty. Wholesale photography is added in the admin, and
      // a seeded stand-in would have to be a retail men's tee — the wrong
      // picture on eight of these ten styles.
      images: [],
      optionSets: { sizes: WHOLESALE_SIZES, colors: WHOLESALE_COLORS },
      seo: {
        title: `${entry.title} — Wholesale`,
        description: `Trade pricing for the ${entry.title}, from 150 units.`,
      },
    });

    for (const color of WHOLESALE_COLORS) {
      for (const size of WHOLESALE_SIZES) {
        await Variant.create({
          productId: product._id,
          size,
          color,
          sku: skuFor(entry.slug, color, size),
          priceCents,
          // Made to order: there is no shelf to draw down, and nothing on the
          // wholesale page consults stock.
          stock: 0,
        });
        report.variantCount += 1;
      }
    }

    report.created.push(entry.slug);
  }

  return report;
}
