import { describe, expect, it } from 'vitest';
import { Product } from '@/lib/db/models/product';
import { Variant } from '@/lib/db/models/variant';
import { WholesaleEnquiry } from '@/lib/db/models/wholesale-enquiry';
import { listPublishedProducts, getPublishedProductBySlug } from '@/lib/services/products';
import {
  UnknownWholesaleStyleError,
  createWholesaleEnquiry,
  listWholesaleProducts,
} from '@/lib/services/wholesale';
import { WHOLESALE_TAG } from '@/lib/wholesale/catalogue';
import { withTestDatabase } from '@/tests/setup/db';

withTestDatabase();

const NO_FILTER = {
  sizes: [], colors: [], sort: 'newest' as const, q: '', minPrice: null, maxPrice: null, gender: null,
};

async function seedStyle(
  slug: string,
  title: string,
  priceCents: number,
  tags: string[] = [WHOLESALE_TAG],
) {
  const product = await Product.create({
    title,
    slug,
    description: 'Borrowed copy.',
    category: 'men',
    status: 'published',
    tags,
    images: [{ publicId: 'https://example.test/frame.jpg', width: 1600, height: 2400, alt: 'A tee.' }],
    optionSets: { sizes: ['s', 'm'], colors: ['black'] },
  });

  await Variant.create({
    productId: product._id, size: 's', color: 'black', sku: `${slug}-S`, priceCents, stock: 0,
  });
  await Variant.create({
    productId: product._id, size: 'm', color: 'black', sku: `${slug}-M`, priceCents, stock: 0,
  });

  return product;
}

describe('listWholesaleProducts', () => {
  it('returns the tagged styles with a full price ladder off retail', async () => {
    await seedStyle('wholesale-razor-tank', 'Razor Tank', 4800);

    const [style] = await listWholesaleProducts();

    expect(style).toMatchObject({
      slug: 'wholesale-razor-tank',
      title: 'Razor Tank',
      retailCents: 4800,
      colors: ['black'],
      sizes: ['s', 'm'],
    });
    expect(style.image?.publicId).toBe('https://example.test/frame.jpg');
    expect(style.tiers.map((t) => t.tier)).toEqual([150, 300, 450, 600, 1200]);
    expect(style.tiers[0]).toMatchObject({ unitPriceCents: 2880, totalCents: 432_000 });
  });

  it('ignores an untagged retail product', async () => {
    await seedStyle('mens-organic-tee', 'Organic Tee', 4800, []);
    expect(await listWholesaleProducts()).toHaveLength(0);
  });

  it('ignores a draft or archived wholesale style', async () => {
    await seedStyle('wholesale-crop-tee', 'Crop Tee', 4600);
    await Product.updateOne({ slug: 'wholesale-crop-tee' }, { status: 'draft' });

    await seedStyle('wholesale-boy-tee', 'Boy Tee', 4600);
    await Product.updateOne({ slug: 'wholesale-boy-tee' }, { archivedAt: new Date() });

    expect(await listWholesaleProducts()).toHaveLength(0);
  });
});

describe('the retail storefront', () => {
  it('never lists a wholesale style', async () => {
    await seedStyle('wholesale-razor-tank', 'Razor Tank', 4800);
    await seedStyle('mens-organic-tee', 'Organic Tee', 4800, []);

    const listed = await listPublishedProducts(NO_FILTER);

    expect(listed.map((p) => p.slug)).toEqual(['mens-organic-tee']);
  });

  it('has no product page for a wholesale style', async () => {
    await seedStyle('wholesale-razor-tank', 'Razor Tank', 4800);

    expect(await getPublishedProductBySlug('wholesale-razor-tank')).toBeNull();
  });
});

describe('createWholesaleEnquiry', () => {
  const CONTACT = {
    company: 'Northwood Supply Co',
    contactName: 'Alex Reyes',
    email: 'buyer@northwood.com',
    phone: '',
    country: 'United States',
    message: '',
  };

  it('prices every line from the database and rolls the enquiry up', async () => {
    await seedStyle('wholesale-razor-tank', 'Razor Tank', 4800);
    await seedStyle('wholesale-crop-tee', 'Crop Tee', 4600);

    const enquiry = await createWholesaleEnquiry({
      ...CONTACT,
      lines: [
        { slug: 'wholesale-razor-tank', tier: 150 },
        { slug: 'wholesale-crop-tee', tier: 1200 },
      ],
    });

    expect(enquiry.lines).toEqual([
      { slug: 'wholesale-razor-tank', title: 'Razor Tank', tier: 150, unitPriceCents: 2880, totalCents: 432_000 },
      { slug: 'wholesale-crop-tee', title: 'Crop Tee', tier: 1200, unitPriceCents: 1840, totalCents: 2_208_000 },
    ]);
    expect(enquiry).toMatchObject({ units: 1350, totalCents: 2_640_000, status: 'new' });

    expect(await WholesaleEnquiry.countDocuments({})).toBe(1);
  });

  it('stores what was quoted, so a later price change cannot rewrite it', async () => {
    await seedStyle('wholesale-razor-tank', 'Razor Tank', 4800);

    const enquiry = await createWholesaleEnquiry({
      ...CONTACT,
      lines: [{ slug: 'wholesale-razor-tank', tier: 150 }],
    });

    await Variant.updateMany({}, { priceCents: 9999 });

    const saved = await WholesaleEnquiry.findById(enquiry.id).lean();
    expect(saved?.lines[0]?.unitPriceCents).toBe(2880);
  });

  it('refuses a style that is not on the line sheet', async () => {
    await seedStyle('mens-organic-tee', 'Organic Tee', 4800, []);

    await expect(
      createWholesaleEnquiry({ ...CONTACT, lines: [{ slug: 'mens-organic-tee', tier: 150 }] }),
    ).rejects.toBeInstanceOf(UnknownWholesaleStyleError);

    expect(await WholesaleEnquiry.countDocuments({})).toBe(0);
  });
});
