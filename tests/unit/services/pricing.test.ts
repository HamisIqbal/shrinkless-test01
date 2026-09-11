import { describe, expect, it } from 'vitest';
import { Discount } from '@/lib/db/models/discount';
import { ShippingMethod } from '@/lib/db/models/shipping-method';
import { updateStoreSettings } from '@/lib/services/settings';
import { priceOrder, taxFor } from '@/lib/services/pricing';
import { methodServes, quoteShipping, rateFor } from '@/lib/services/shipping';
import { withTestDatabase } from '@/tests/setup/db';
import type { CartLineDTO, SettingsDTO } from '@/types/dto';

withTestDatabase();

function line(cents: number, slug = 'field-tee'): CartLineDTO {
  return {
    variantId: `v-${slug}-${cents}`,
    productTitle: 'Field Tee',
    productSlug: slug,
    size: 's',
    color: 'sand',
    imagePublicId: '',
    unitPriceCents: cents,
    quantity: 1,
    lineTotalCents: cents,
    availableStock: 10,
    quantityRule: { min: 1, step: 1, max: null },
  };
}

const BASE_SETTINGS = {
  storeEmail: 'orders@shrinkless.com',
  announcement: '',
  shippingZones: [],
  freeShippingThresholdCents: null,
  taxMode: 'none' as const,
  flatTaxRateBasisPoints: 0,
};

async function settings(overrides: Partial<SettingsDTO> = {}): Promise<SettingsDTO> {
  return updateStoreSettings({ ...BASE_SETTINGS, ...overrides });
}

describe('taxFor', () => {
  it('charges the flat rate on the taxable amount', async () => {
    const store = await settings({ taxMode: 'flat', flatTaxRateBasisPoints: 825 });

    expect(taxFor(10_000, store)).toBe(825);
  });

  it('charges nothing when the provider is the authority', async () => {
    const store = await settings({ taxMode: 'stripe', flatTaxRateBasisPoints: 825 });

    expect(taxFor(10_000, store)).toBe(0);
  });
});

describe('shipping quotes', () => {
  it('matches a method only where it applies', () => {
    const method = { countries: ['US'], states: ['TX'] };

    expect(methodServes(method, { country: 'US', state: 'TX' })).toBe(true);
    expect(methodServes(method, { country: 'US', state: 'CA' })).toBe(false);
    expect(methodServes({ countries: [], states: [] }, {})).toBe(true);
  });

  it('waives the rate above a threshold, its own or the store-wide one', () => {
    expect(rateFor({ rateCents: 900, freeOverCents: 5000 }, 5000, null)).toEqual({
      rateCents: 0,
      free: true,
    });

    expect(rateFor({ rateCents: 900, freeOverCents: null }, 8000, 7500)).toEqual({
      rateCents: 0,
      free: true,
    });

    expect(rateFor({ rateCents: 900, freeOverCents: null }, 100, 7500)).toEqual({
      rateCents: 900,
      free: false,
    });
  });

  it('falls back to the legacy zone table when no method exists', async () => {
    const store = await settings({
      shippingZones: [{ name: 'Domestic', states: ['TX'], rateCents: 700 }],
    });

    const quotes = await quoteShipping({ subtotalCents: 1000, state: 'TX', settings: store });

    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({ code: 'ZONE', rateCents: 700 });
  });

  it('prefers configured methods over the legacy table', async () => {
    const store = await settings({
      shippingZones: [{ name: 'Domestic', states: ['TX'], rateCents: 700 }],
    });

    await ShippingMethod.create({ name: 'Standard', code: 'STD', rateCents: 500, active: true });

    const quotes = await quoteShipping({ subtotalCents: 1000, state: 'TX', settings: store });

    expect(quotes.map((quote) => quote.code)).toEqual(['STD']);
  });
});

describe('priceOrder', () => {
  it('adds shipping and tax to the discounted goods', async () => {
    const store = await settings({ taxMode: 'flat', flatTaxRateBasisPoints: 1000 });
    await ShippingMethod.create({ name: 'Standard', code: 'STD', rateCents: 500, active: true });
    await Discount.create({ code: 'TENOFF', type: 'fixed', value: 1000, active: true });

    const result = await priceOrder({
      lines: [line(10_000)],
      discountCode: 'TENOFF',
      settings: store,
    });

    // 10,000 − 1,000 = 9,000 goods; 10% tax on the discounted goods; 500 ship.
    expect(result).toMatchObject({
      subtotalCents: 10_000,
      discountCents: 1000,
      discountCode: 'TENOFF',
      shippingCents: 500,
      taxCents: 900,
      totalCents: 10_400,
    });
  });

  it('reports a bad code instead of failing to price the order', async () => {
    const store = await settings();

    const result = await priceOrder({
      lines: [line(4000)],
      discountCode: 'NOPE',
      settings: store,
    });

    expect(result.discountCents).toBe(0);
    expect(result.totalCents).toBe(4000);
    expect(result.discountError).toMatch(/not recognised/i);
  });

  it('lets a discount push an order over the free-shipping threshold', async () => {
    const store = await settings({ freeShippingThresholdCents: 5000 });
    await ShippingMethod.create({ name: 'Standard', code: 'STD', rateCents: 900, active: true });

    const paid = await priceOrder({ lines: [line(4000)], settings: store });
    const free = await priceOrder({ lines: [line(6000)], settings: store });

    expect(paid.shippingCents).toBe(900);
    expect(free.shippingCents).toBe(0);
  });

  it('never produces a negative total', async () => {
    const store = await settings();
    await Discount.create({ code: 'HUGE', type: 'fixed', value: 999_999, active: true });

    const result = await priceOrder({
      lines: [line(2000)],
      discountCode: 'HUGE',
      settings: store,
    });

    expect(result.discountCents).toBe(2000);
    expect(result.totalCents).toBe(0);
  });
});
