import { describe, expect, it } from 'vitest';
import { retailAddOptions, tradeAddOptions } from '@/lib/shop/quick-add';
import type { VariantDTO } from '@/types/dto';

function variant(id: string, size: string, color: string, extra: Partial<VariantDTO> = {}): VariantDTO {
  return {
    id,
    size,
    color,
    sku: id,
    priceCents: 3000,
    stock: 10,
    inStock: true,
    enabled: true,
    lowStockThreshold: null,
    imagePublicId: '',
    ...extra,
  };
}

const single = { min: 1, step: 1, max: null };

describe('retailAddOptions', () => {
  it('lists enabled sizes smallest first, at the minimum quantity', () => {
    const options = retailAddOptions(
      [variant('c', 'xl', 'black'), variant('a', 's', 'black'), variant('b', 'm', 'black')],
      single,
    );

    expect(options.map((option) => option.label)).toEqual(['S', 'M', 'XL']);
    expect(options.every((option) => option.quantity === 1)).toBe(true);
  });

  it('leaves out disabled variants', () => {
    const options = retailAddOptions(
      [variant('a', 's', 'black'), variant('b', 'm', 'black', { enabled: false })],
      single,
    );

    expect(options.map((option) => option.label)).toEqual(['S']);
  });

  it('disables a size that is out of stock', () => {
    const [option] = retailAddOptions([variant('a', 's', 'black', { stock: 0, inStock: false })], single);
    expect(option.variantId).toBeNull();
  });

  it('disables a size with less stock than the product minimum', () => {
    const rule = { min: 12, step: 12, max: null };
    const [short, enough] = retailAddOptions(
      [variant('a', 's', 'black', { stock: 6 }), variant('b', 'm', 'black', { stock: 24 })],
      rule,
    );

    expect(short.variantId).toBeNull();
    expect(enough).toMatchObject({ variantId: 'b', quantity: 12 });
  });
});

describe('tradeAddOptions', () => {
  const tiers = [
    { tier: 150, discountPercent: 40, unitPriceCents: 1800, totalCents: 270000 },
    { tier: 300, discountPercent: 45, unitPriceCents: 1650, totalCents: 495000 },
  ];

  it('offers each run at the tier quantity, priced per unit', () => {
    const options = tradeAddOptions(tiers, [variant('a', 'm', 'black')], 'black');

    expect(options).toEqual([
      { key: '150', label: '150 units', detail: '$18.00 per unit', variantId: 'a', quantity: 150 },
      { key: '300', label: '300 units', detail: '$16.50 per unit', variantId: 'a', quantity: 300 },
    ]);
  });

  it('adds the first enabled variant in the chosen colour, whatever its stock', () => {
    const options = tradeAddOptions(
      tiers,
      [
        variant('a', 's', 'black'),
        variant('b', 's', 'white', { enabled: false }),
        variant('c', 'm', 'white', { stock: 0, inStock: false }),
      ],
      'white',
    );

    expect(options[0].variantId).toBe('c');
  });

  it('cannot be bought when the style has no enabled variant', () => {
    const options = tradeAddOptions(tiers, [variant('a', 's', 'black', { enabled: false })], 'black');
    expect(options.every((option) => option.variantId === null)).toBe(true);
  });
});
