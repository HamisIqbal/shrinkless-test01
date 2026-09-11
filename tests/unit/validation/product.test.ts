import { describe, expect, it } from 'vitest';
import { productInputSchema } from '@/lib/validation/product';

const valid = {
  title: 'Field Tee',
  slug: 'Field-Tee',
  description: '',
  category: 'tees',
  status: 'draft',
  images: [],
  sizes: ['S', ' m '],
  colors: ['Sand'],
  variants: [
    { variantId: null, size: 'S', color: 'Sand', sku: 'field-tee-s-sand', priceCents: 4200, stock: 3, enabled: true },
  ],
};

describe('productInputSchema', () => {
  it('lowercases the slug and option values, and uppercases the sku', () => {
    const parsed = productInputSchema.parse(valid);

    expect(parsed.slug).toBe('field-tee');
    expect(parsed.sizes).toEqual(['s', 'm']);
    expect(parsed.variants[0].sku).toBe('FIELD-TEE-S-SAND');
  });

  it('rejects a negative price', () => {
    const result = productInputSchema.safeParse({
      ...valid,
      variants: [{ ...valid.variants[0], priceCents: -1 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a fractional price, because money is integer cents', () => {
    const result = productInputSchema.safeParse({
      ...valid,
      variants: [{ ...valid.variants[0], priceCents: 42.5 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty title', () => {
    expect(productInputSchema.safeParse({ ...valid, title: '  ' }).success).toBe(false);
  });

  it('rejects a slug with spaces or capitals left in it', () => {
    expect(productInputSchema.safeParse({ ...valid, slug: 'field tee' }).success).toBe(false);
  });
});
