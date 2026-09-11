import { describe, expect, it } from 'vitest';
import { withTestDatabase } from '@/tests/setup/db';
import { Product } from '@/lib/db/models/product';
import { Variant } from '@/lib/db/models/variant';

withTestDatabase();

async function makeProduct() {
  return Product.create({
    title: 'Field Shirt',
    slug: 'field-shirt',
    category: 'shirts',
    status: 'published',
    optionSets: { sizes: ['s', 'm'], colors: ['sand'] },
  });
}

describe('Product model', () => {
  it('defaults to draft status', async () => {
    const product = await Product.create({ title: 'Draft Shirt', slug: 'draft-shirt', category: 'shirts' });
    expect(product.status).toBe('draft');
  });

  it('rejects a duplicate slug', async () => {
    await makeProduct();
    await expect(makeProduct()).rejects.toThrowError(/duplicate key/i);
  });

  it('rejects an unknown status', async () => {
    await expect(
      // @ts-expect-error deliberately invalid status, proving the enum is enforced
      Product.create({ title: 'X', slug: 'x', category: 'shirts', status: 'archived' }),
    ).rejects.toThrowError(/validation failed/i);
  });
});

describe('Variant model', () => {
  it('rejects a duplicate size and colour on the same product', async () => {
    const product = await makeProduct();
    const base = { productId: product._id, size: 'm', color: 'sand', priceCents: 4500 };

    await Variant.create({ ...base, sku: 'FS-M-SAND' });
    await expect(Variant.create({ ...base, sku: 'FS-M-SAND-2' })).rejects.toThrowError(/duplicate key/i);
  });

  it('rejects a negative price', async () => {
    const product = await makeProduct();
    await expect(
      Variant.create({ productId: product._id, size: 'm', color: 'sand', sku: 'FS-M-2', priceCents: -1 }),
    ).rejects.toThrowError(/validation failed/i);
  });

  it('defaults stock to zero', async () => {
    const product = await makeProduct();
    const variant = await Variant.create({
      productId: product._id, size: 's', color: 'sand', sku: 'FS-S-SAND', priceCents: 4500,
    });
    expect(variant.stock).toBe(0);
  });
});
