import { beforeEach, describe, expect, it } from 'vitest';
import { withTestDatabase } from '@/tests/setup/db';
import { Product } from '@/lib/db/models/product';
import { Variant } from '@/lib/db/models/variant';
import { getPublishedProductBySlug, listPublishedProducts } from '@/lib/services/products';

withTestDatabase();

const noFilter = {
  sizes: [],
  colors: [],
  sort: 'newest' as const,
  q: '',
  minPrice: null,
  maxPrice: null,
  gender: null,
};

async function seedCatalogue() {
  const shirt = await Product.create({
    title: 'Field Shirt', slug: 'field-shirt', category: 'shirts', status: 'published',
    optionSets: { sizes: ['s', 'm'], colors: ['sand'] },
  });
  await Variant.create({ productId: shirt._id, size: 's', color: 'sand', sku: 'FS-S', priceCents: 4500, stock: 3 });
  await Variant.create({ productId: shirt._id, size: 'm', color: 'sand', sku: 'FS-M', priceCents: 5500, stock: 0 });

  const draft = await Product.create({ title: 'Secret', slug: 'secret', category: 'shirts', status: 'draft' });
  await Variant.create({ productId: draft._id, size: 'm', color: 'black', sku: 'SEC-M', priceCents: 9900, stock: 5 });
}

beforeEach(seedCatalogue);

describe('listPublishedProducts', () => {
  it('excludes drafts', async () => {
    const products = await listPublishedProducts(noFilter);
    expect(products.map((p) => p.slug)).toEqual(['field-shirt']);
  });

  it('reports the lowest variant price', async () => {
    const [product] = await listPublishedProducts(noFilter);
    expect(product.minPriceCents).toBe(4500);
  });

  it('returns serializable ids as strings', async () => {
    const [product] = await listPublishedProducts(noFilter);
    expect(typeof product.id).toBe('string');
    expect(typeof product.variants[0].id).toBe('string');
  });

  it('filters by size', async () => {
    expect(await listPublishedProducts({ ...noFilter, sizes: ['xl'] })).toHaveLength(0);
    expect(await listPublishedProducts({ ...noFilter, sizes: ['s'] })).toHaveLength(1);
  });

  it('excludes a product whose only variant in that size is sold out', async () => {
    // 'm' exists on Field Shirt but has stock 0, so filtering by it must not
    // send the shopper to a product they cannot buy in that size.
    expect(await listPublishedProducts({ ...noFilter, sizes: ['m'] })).toHaveLength(0);
  });

  it('excludes a product whose only variant in that colour is sold out', async () => {
    await Variant.updateMany({ sku: 'FS-S' }, { stock: 0 });
    expect(await listPublishedProducts({ ...noFilter, colors: ['sand'] })).toHaveLength(0);
  });

  it('filters by category', async () => {
    expect(await listPublishedProducts(noFilter, 'hats')).toHaveLength(0);
    expect(await listPublishedProducts(noFilter, 'shirts')).toHaveLength(1);
  });
});

describe('getPublishedProductBySlug', () => {
  it('marks an out-of-stock variant as unavailable but still returns it', async () => {
    const product = await getPublishedProductBySlug('field-shirt');
    const medium = product?.variants.find((v) => v.size === 'm');

    expect(medium?.inStock).toBe(false);
    expect(medium).toBeDefined();
  });

  it('returns null for a draft product', async () => {
    expect(await getPublishedProductBySlug('secret')).toBeNull();
  });

  it('returns null for an unknown slug', async () => {
    expect(await getPublishedProductBySlug('nope')).toBeNull();
  });
});

describe('listPublishedProducts search', () => {
  it('matches the product title, case-insensitively', async () => {
    expect(await listPublishedProducts({ ...noFilter, q: 'FIELD' })).toHaveLength(1);
  });

  it('matches a colourway, because "charcoal" is a search a shopper makes', async () => {
    expect(await listPublishedProducts({ ...noFilter, q: 'sand' })).toHaveLength(1);
  });

  it('returns nothing for a term that appears nowhere', async () => {
    expect(await listPublishedProducts({ ...noFilter, q: 'balaclava' })).toHaveLength(0);
  });

  it('treats an empty query as no query', async () => {
    expect(await listPublishedProducts({ ...noFilter, q: '' })).toHaveLength(1);
  });
});
