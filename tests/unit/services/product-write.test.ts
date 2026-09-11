import { describe, expect, it } from 'vitest';
import { Variant } from '@/lib/db/models/variant';
import { SlugTakenError, getProductForAdmin, saveProduct } from '@/lib/services/products';
import { withTestDatabase } from '@/tests/setup/db';

withTestDatabase();

const input = {
  title: 'Field Tee',
  slug: 'field-tee',
  description: 'Heavyweight cotton.',
  category: 'tees',
  status: 'draft' as const,
  images: [{ publicId: 'shrinkless/field-tee', width: 1200, height: 1500, alt: 'Field tee' }],
  sizes: ['s', 'm'],
  colors: ['sand'],
  variants: [
    { variantId: null, size: 's', color: 'sand', sku: 'FIELD-TEE-S-SAND', priceCents: 4200, stock: 3, enabled: true },
    { variantId: null, size: 'm', color: 'sand', sku: 'FIELD-TEE-M-SAND', priceCents: 4200, stock: 4, enabled: true },
  ],
};

describe('saveProduct', () => {
  it('creates a product with its variants', async () => {
    const id = await saveProduct(input);
    const dto = await getProductForAdmin(id);

    expect(dto?.title).toBe('Field Tee');
    expect(dto?.variants).toHaveLength(2);
    expect(dto?.sizes).toEqual(['s', 'm']);
  });

  it('updates the product in place rather than creating a second one', async () => {
    const id = await saveProduct(input);
    await saveProduct({ ...input, id, title: 'Field Tee II', status: 'published' });

    const dto = await getProductForAdmin(id);
    expect(dto?.title).toBe('Field Tee II');
    expect(dto?.status).toBe('published');
    expect(await Variant.countDocuments({})).toBe(2);
  });

  it('appends a new colour without touching existing stock', async () => {
    const id = await saveProduct(input);
    const saved = await getProductForAdmin(id);
    const existing = saved!.variants.map((variant) => ({
      variantId: variant.id, size: variant.size, color: variant.color, sku: variant.sku,
      priceCents: variant.priceCents, stock: variant.stock, enabled: variant.enabled,
    }));

    await saveProduct({
      ...input,
      id,
      colors: ['sand', 'black'],
      variants: [
        ...existing,
        { variantId: null, size: 's', color: 'black', sku: 'FIELD-TEE-S-BLACK', priceCents: 4200, stock: 0, enabled: true },
      ],
    });

    const dto = await getProductForAdmin(id);
    expect(dto?.variants).toHaveLength(3);
    expect(dto?.variants.find((v) => v.sku === 'FIELD-TEE-S-SAND')?.stock).toBe(3);
  });

  it('disables a variant without deleting it, so cart references survive', async () => {
    const id = await saveProduct(input);
    const saved = await getProductForAdmin(id);
    const target = saved!.variants.find((v) => v.size === 'm')!;

    await saveProduct({
      ...input,
      id,
      variants: saved!.variants.map((variant) => ({
        variantId: variant.id, size: variant.size, color: variant.color, sku: variant.sku,
        priceCents: variant.priceCents, stock: variant.stock,
        enabled: variant.id !== target.id,
      })),
    });

    const dto = await getProductForAdmin(id);
    expect(dto?.variants).toHaveLength(2);
    expect(dto?.variants.find((v) => v.id === target.id)?.enabled).toBe(false);
  });

  it('rejects a slug that belongs to a different product', async () => {
    await saveProduct(input);

    await expect(
      saveProduct({ ...input, title: 'Copy', variants: [] }),
    ).rejects.toBeInstanceOf(SlugTakenError);
  });

  it('allows a product to keep its own slug on re-save', async () => {
    const id = await saveProduct(input);
    await expect(saveProduct({ ...input, id })).resolves.toBe(id);
  });
});
