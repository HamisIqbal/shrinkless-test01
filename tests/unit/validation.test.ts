import { describe, expect, it } from 'vitest';
import { productFilterSchema } from '@/lib/validation/catalogue';

describe('productFilterSchema', () => {
  it('applies defaults to an empty query', () => {
    const parsed = productFilterSchema.parse({});
    expect(parsed).toEqual({
      sizes: [],
      colors: [],
      sort: 'newest',
      q: '',
      minPrice: null,
      maxPrice: null,
      gender: null,
    });
  });

  it('splits a comma-separated size list and lowercases it', () => {
    expect(productFilterSchema.parse({ size: 'M,L' }).sizes).toEqual(['m', 'l']);
  });

  it('accepts a single colour', () => {
    expect(productFilterSchema.parse({ color: 'Sand' }).colors).toEqual(['sand']);
  });

  it('falls back to the default sort when given an unknown value', () => {
    expect(productFilterSchema.parse({ sort: 'sideways' }).sort).toBe('newest');
  });

  it('accepts a known sort', () => {
    expect(productFilterSchema.parse({ sort: 'price-asc' }).sort).toBe('price-asc');
  });
});

describe('productFilterSchema price bounds', () => {
  it('reads whole-dollar bounds off the query', () => {
    const parsed = productFilterSchema.parse({ min: '40', max: '60' });
    expect(parsed.minPrice).toBe(40);
    expect(parsed.maxPrice).toBe(60);
  });

  it('keeps a zero lower bound rather than treating it as absent', () => {
    expect(productFilterSchema.parse({ min: '0' }).minPrice).toBe(0);
  });

  // A hand-edited URL should degrade to the unfiltered catalogue, not 500.
  it('ignores junk instead of throwing', () => {
    const parsed = productFilterSchema.parse({ min: 'cheap', max: '-5' });
    expect(parsed.minPrice).toBeNull();
    expect(parsed.maxPrice).toBeNull();
  });
});
