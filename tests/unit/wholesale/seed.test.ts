import { describe, expect, it } from 'vitest';
import { Product } from '@/lib/db/models/product';
import { Variant } from '@/lib/db/models/variant';
import {
  WHOLESALE_CATALOGUE,
  WHOLESALE_COLORS,
  WHOLESALE_COPY_SOURCES,
  WHOLESALE_SIZES,
  WHOLESALE_TAG,
} from '@/lib/wholesale/catalogue';
import { NoCopySourceError, NoPriceBasisError, seedWholesale, skuFor } from '@/lib/wholesale/seed';
import { withTestDatabase } from '@/tests/setup/db';

withTestDatabase();

/**
 * The shape of the real store, not the shape of the repo's placeholder seed.
 *
 * The men's line is one oversized tee in four colourways, every one of them
 * $89.00 and carrying the same fabric paragraph word for word. The first
 * version of this seed was written against three invented slugs that exist
 * nowhere but `scripts/seed-shrinkless.ts`, and it would have refused to run
 * against the live catalogue. These tests are what would have caught that.
 */
const SHARED_COPY =
  'Made of 100% USA cotton 18/1 6.5 oz , this textile is durable, comfortable, ' +
  'and virtually shrink-free thanks to the garment dye process.';

async function seedMensColourway(
  slug: string,
  { priceCents = 8900, enabled = true }: { priceCents?: number; enabled?: boolean } = {},
) {
  const product = await Product.create({
    title: 'Mens Oversized Tshirt',
    slug,
    description: SHARED_COPY,
    category: 'men',
    status: 'published',
    images: [{ publicId: 'https://example.test/mens.jpg', width: 1600, height: 2400 }],
    optionSets: { sizes: ['s', 'm'], colors: ['mocha'] },
  });

  await Variant.create({
    productId: product._id,
    size: 's',
    color: 'mocha',
    sku: `${slug}-S`.toUpperCase(),
    priceCents,
    stock: 4,
    enabled,
  });

  return product;
}

describe('skuFor', () => {
  it('drops the wholesale- prefix and shouts the rest', () => {
    expect(skuFor('wholesale-razor-tank', 'mocha', 'xxl')).toBe('SL-WS-RAZOR-TANK-MOCHA-XXL');
  });

  it('gives every colour and size of a style its own code', () => {
    const codes = WHOLESALE_COLORS.flatMap((color) =>
      WHOLESALE_SIZES.map((size) => skuFor('wholesale-crop-tee', color, size)),
    );

    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('seedWholesale', () => {
  it('refuses to invent a catalogue when the retail line is not there', async () => {
    await expect(seedWholesale()).rejects.toThrow(NoCopySourceError);
    expect(await Product.countDocuments({ tags: WHOLESALE_TAG })).toBe(0);
  });

  it('refuses when the source style has nothing sellable to price from', async () => {
    await seedMensColourway(WHOLESALE_COPY_SOURCES[0], { enabled: false });

    await expect(seedWholesale()).rejects.toThrow(NoPriceBasisError);
    expect(await Product.countDocuments({ tags: WHOLESALE_TAG })).toBe(0);
  });

  it('reads copy and price basis from whichever colourway survives', async () => {
    // Deliberately not the first in the preference order: archiving one
    // colourway must not break the seed.
    await seedMensColourway(WHOLESALE_COPY_SOURCES[2]);

    const report = await seedWholesale();

    expect(report.sourceSlug).toBe(WHOLESALE_COPY_SOURCES[2]);
    expect(report.priceCents).toBe(8900);
  });

  it('strikes the ladder from the cheapest sellable variant, not the first one', async () => {
    const product = await seedMensColourway(WHOLESALE_COPY_SOURCES[0], { priceCents: 9900 });
    await Variant.create({
      productId: product._id,
      size: 'm',
      color: 'mocha',
      sku: 'CHEAPER-M',
      priceCents: 8400,
      stock: 2,
    });
    // Disabled, and cheaper still: no shopper could have bought at this price,
    // so it is not a retail basis.
    await Variant.create({
      productId: product._id,
      size: 'l',
      color: 'mocha',
      sku: 'DISABLED-L',
      priceCents: 1000,
      stock: 0,
      enabled: false,
    });

    const report = await seedWholesale();

    expect(report.priceCents).toBe(8400);
  });

  it('creates all ten styles, borrowed copy and all, with no photography', async () => {
    await seedMensColourway(WHOLESALE_COPY_SOURCES[0]);

    const report = await seedWholesale();

    expect(report.created).toEqual(WHOLESALE_CATALOGUE.map((entry) => entry.slug));
    expect(report.skipped).toEqual([]);

    const styles = await Product.find({ tags: WHOLESALE_TAG }).lean();
    expect(styles).toHaveLength(10);

    for (const style of styles) {
      expect(style.description).toBe(SHARED_COPY);
      expect(style.status).toBe('published');
      expect(style.tags).toEqual([WHOLESALE_TAG]);
      // The store owner adds these in the admin. A seeded stand-in would be a
      // retail men's tee, which is the wrong picture on eight of the ten.
      expect(style.images).toEqual([]);
      expect(style.optionSets?.sizes).toEqual(WHOLESALE_SIZES);
      expect(style.optionSets?.colors).toEqual(WHOLESALE_COLORS);
    }

    expect(styles.map((style) => style.title).sort()).toEqual(
      WHOLESALE_CATALOGUE.map((entry) => entry.title).sort(),
    );
  });

  it('splits the placeholder genders five and five', async () => {
    await seedMensColourway(WHOLESALE_COPY_SOURCES[0]);
    await seedWholesale();

    expect(await Product.countDocuments({ tags: WHOLESALE_TAG, category: 'men' })).toBe(5);
    expect(await Product.countDocuments({ tags: WHOLESALE_TAG, category: 'women' })).toBe(5);
  });

  it('gives every style the full size run in every colour, at the retail basis', async () => {
    await seedMensColourway(WHOLESALE_COPY_SOURCES[0]);

    const report = await seedWholesale();

    expect(report.variantCount).toBe(10 * WHOLESALE_COLORS.length * WHOLESALE_SIZES.length);

    const style = await Product.findOne({ slug: 'wholesale-long-dress' }).lean();
    const variants = await Variant.find({ productId: style!._id }).lean();

    expect(variants).toHaveLength(20);
    expect(variants.every((variant) => variant.priceCents === 8900)).toBe(true);
    // Made to order: there is no shelf to draw down, and nothing on the
    // wholesale page consults stock.
    expect(variants.every((variant) => variant.stock === 0)).toBe(true);
    expect(new Set(variants.map((variant) => variant.sku)).size).toBe(20);
  });

  it('leaves work done in the admin alone when it runs again', async () => {
    await seedMensColourway(WHOLESALE_COPY_SOURCES[0]);
    await seedWholesale();

    // What the store owner is expected to do after the first run: correct a
    // placeholder gender, retitle, add photography.
    await Product.updateOne(
      { slug: 'wholesale-long-dress' },
      {
        category: 'women',
        title: 'Long Dress (SS26)',
        images: [{ publicId: 'https://example.test/dress.jpg', width: 1600, height: 2400 }],
      },
    );

    const again = await seedWholesale();

    expect(again.created).toEqual([]);
    expect(again.skipped).toEqual(WHOLESALE_CATALOGUE.map((entry) => entry.slug));
    expect(again.variantCount).toBe(0);

    const edited = await Product.findOne({ slug: 'wholesale-long-dress' }).lean();
    expect(edited!.title).toBe('Long Dress (SS26)');
    expect(edited!.images).toHaveLength(1);

    // And no second set of variants underneath it.
    expect(await Variant.countDocuments({ productId: edited!._id })).toBe(20);
    expect(await Product.countDocuments({ tags: WHOLESALE_TAG })).toBe(10);
  });

  it('fills a gap without touching what is already there', async () => {
    await seedMensColourway(WHOLESALE_COPY_SOURCES[0]);
    await seedWholesale();
    await Product.deleteOne({ slug: 'wholesale-v-neck-tee' });
    await Variant.deleteMany({ sku: /^SL-WS-V-NECK-TEE-/ });

    const report = await seedWholesale();

    expect(report.created).toEqual(['wholesale-v-neck-tee']);
    expect(report.skipped).toHaveLength(9);
    expect(await Product.countDocuments({ tags: WHOLESALE_TAG })).toBe(10);
  });
});
