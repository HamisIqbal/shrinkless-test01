import { describe, expect, it } from 'vitest';
import { toColorways, sizeOrder } from '@/lib/shop/colorways';
import type { ProductDTO, VariantDTO } from '@/types/dto';

function variant(overrides: Partial<VariantDTO> & { color: string; size: string }): VariantDTO {
  return {
    id: `${overrides.color}-${overrides.size}`,
    sku: `SKU-${overrides.color}-${overrides.size}`.toUpperCase(),
    priceCents: 4800,
    stock: 5,
    inStock: true,
    enabled: true,
    lowStockThreshold: null,
    imagePublicId: '',
    ...overrides,
  };
}

const product: ProductDTO = {
  id: 'p1',
  title: 'Organic Tee',
  slug: 'organic-tee',
  description: '',
  category: 'tees',
  status: 'published',
  featured: false,
  badge: 'none',
  rating: 0,
  tags: [],
  baseSku: '',
  seo: { title: '', description: '', keywords: [] },
  quantityRule: { min: 1, step: 1, max: null },
  archived: false,
  images: [
    {
      publicId: 'https://img/black.jpg',
      width: 1400,
      height: 1750,
      alt: 'Black tee',
      focus: '',
      zoom: 1,
      mobileFocus: '',
    },
    {
      publicId: 'https://img/white.jpg',
      width: 1400,
      height: 1750,
      alt: 'White tee',
      focus: '',
      zoom: 1,
      mobileFocus: '',
    },
  ],
  sizes: ['s', 'm', 'l'],
  colors: ['black', 'white'],
  minPriceCents: 4800,
  variants: [
    variant({ color: 'black', size: 'm' }),
    variant({ color: 'black', size: 's' }),
    variant({ color: 'white', size: 'l', stock: 0, inStock: false }),
    variant({ color: 'white', size: 's', enabled: false }),
  ],
};

describe('toColorways', () => {
  it('produces one entry per colour, in the product order', () => {
    expect(toColorways(product).map((row) => row.color)).toEqual(['black', 'white']);
  });

  it('matches each colour to its own image', () => {
    const [black, white] = toColorways(product);

    expect(black.image?.url).toBe('https://img/black.jpg');
    expect(white.image?.url).toBe('https://img/white.jpg');
  });

  it('orders sizes by fit, not alphabetically', () => {
    const [black] = toColorways(product);

    expect(black.variants.map((row) => row.size)).toEqual(['s', 'm']);
  });

  it('drops disabled variants but keeps sold-out ones', () => {
    const [, white] = toColorways(product);

    expect(white.variants.map((row) => row.size)).toEqual(['l']);
    expect(white.inStock).toBe(false);
  });

  it('still returns a tile when a colour has no image of its own', () => {
    const single = { ...product, colors: ['black', 'white', 'charcoal'] };
    const rows = toColorways(single);

    expect(rows).toHaveLength(3);
    expect(rows[2].image?.url).toBe('https://img/black.jpg');
  });
});

describe('sizeOrder', () => {
  it('sorts a real size run', () => {
    const sizes = ['xl', 's', 'xxl', 'm', 'l'];

    expect([...sizes].sort((a, b) => sizeOrder(a) - sizeOrder(b))).toEqual([
      's', 'm', 'l', 'xl', 'xxl',
    ]);
  });
});
