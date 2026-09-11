import { describe, expect, it } from 'vitest';
import { Discount, DiscountRedemption } from '@/lib/db/models/discount';
import { Product } from '@/lib/db/models/product';
import {
  DiscountCodeTakenError,
  amountFor,
  evaluateDiscount,
  redeemDiscount,
  saveDiscount,
} from '@/lib/services/discounts';
import { withTestDatabase } from '@/tests/setup/db';
import type { CartLineDTO } from '@/types/dto';

withTestDatabase();

const RULE = { min: 1, step: 1, max: null };

function line(overrides: Partial<CartLineDTO> = {}): CartLineDTO {
  return {
    variantId: 'v1',
    productTitle: 'Field Tee',
    productSlug: 'field-tee',
    size: 's',
    color: 'sand',
    imagePublicId: '',
    unitPriceCents: 5000,
    quantity: 1,
    lineTotalCents: 5000,
    availableStock: 10,
    quantityRule: RULE,
    ...overrides,
  };
}

async function seedDiscount(overrides: Record<string, unknown> = {}) {
  return Discount.create({
    code: 'SAVE10',
    type: 'percentage',
    value: 1000, // 10%
    active: true,
    ...overrides,
  });
}

describe('amountFor', () => {
  it('takes a percentage of the eligible total, rounded down', () => {
    // 2,500 basis points of 3,333 cents is 833.25 — never 834.
    expect(amountFor({ type: 'percentage', value: 2500 }, 3333)).toBe(833);
  });

  it('never discounts more than the goods are worth', () => {
    expect(amountFor({ type: 'fixed', value: 9999 }, 4000)).toBe(4000);
    expect(amountFor({ type: 'percentage', value: 10_000 }, 4000)).toBe(4000);
  });

  it('is zero when there is nothing eligible', () => {
    expect(amountFor({ type: 'fixed', value: 500 }, 0)).toBe(0);
  });
});

describe('evaluateDiscount', () => {
  it('prices a valid code', async () => {
    await seedDiscount();

    const result = await evaluateDiscount({ code: 'save10', lines: [line()] });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.amountCents).toBe(500);
  });

  it('refuses an unknown code without saying why it is unknown', async () => {
    const result = await evaluateDiscount({ code: 'NOPE', lines: [line()] });

    expect(result).toMatchObject({ ok: false, reason: 'unknown' });
  });

  it('refuses an inactive, unstarted, or expired code', async () => {
    const now = new Date('2026-06-15T00:00:00.000Z');

    await seedDiscount({ code: 'OFF', active: false });
    await seedDiscount({ code: 'SOON', startsAt: new Date('2026-07-01T00:00:00.000Z') });
    await seedDiscount({ code: 'GONE', endsAt: new Date('2026-06-01T00:00:00.000Z') });

    expect(await evaluateDiscount({ code: 'OFF', lines: [line()], now })).toMatchObject({
      reason: 'inactive',
    });
    expect(await evaluateDiscount({ code: 'SOON', lines: [line()], now })).toMatchObject({
      reason: 'not_started',
    });
    expect(await evaluateDiscount({ code: 'GONE', lines: [line()], now })).toMatchObject({
      reason: 'expired',
    });
  });

  it('refuses a code that has hit its total limit', async () => {
    await seedDiscount({ usageLimit: 2, usedCount: 2 });

    expect(await evaluateDiscount({ code: 'SAVE10', lines: [line()] })).toMatchObject({
      reason: 'exhausted',
    });
  });

  it('refuses a customer who has used their allowance', async () => {
    const discount = await seedDiscount({ perCustomerLimit: 1 });

    await DiscountRedemption.create({
      discountId: discount._id,
      code: 'SAVE10',
      email: 'buyer@example.com',
      orderId: discount._id,
      amountCents: 500,
    });

    expect(
      await evaluateDiscount({
        code: 'SAVE10',
        lines: [line()],
        email: 'Buyer@Example.com',
      }),
    ).toMatchObject({ reason: 'customer_limit' });
  });

  it('measures the minimum against the whole order', async () => {
    await seedDiscount({ minOrderCents: 8000 });

    expect(await evaluateDiscount({ code: 'SAVE10', lines: [line()] })).toMatchObject({
      reason: 'below_minimum',
    });

    const two = [line(), line({ variantId: 'v2' })];
    expect(await evaluateDiscount({ code: 'SAVE10', lines: two })).toMatchObject({ ok: true });
  });

  it('only discounts the lines a category restriction covers', async () => {
    await Product.create({ title: 'Field Tee', slug: 'field-tee', category: 'tees' });
    await Product.create({ title: 'Cap', slug: 'cap', category: 'hats' });

    await seedDiscount({ code: 'TEES', type: 'percentage', value: 5000, categorySlugs: ['tees'] });

    const lines = [line(), line({ productSlug: 'cap', variantId: 'v2' })];
    const result = await evaluateDiscount({ code: 'TEES', lines });

    expect(result.ok).toBe(true);
    // Half off the 5,000-cent tee only — the cap is untouched.
    if (result.ok) expect(result.amountCents).toBe(2500);
  });

  it('refuses when the restriction matches nothing in the cart', async () => {
    await Product.create({ title: 'Cap', slug: 'cap', category: 'hats' });
    await seedDiscount({ code: 'TEES', categorySlugs: ['tees'] });

    expect(
      await evaluateDiscount({ code: 'TEES', lines: [line({ productSlug: 'cap' })] }),
    ).toMatchObject({ reason: 'no_eligible_items' });
  });
});

describe('saveDiscount', () => {
  it('refuses a duplicate code', async () => {
    await seedDiscount();

    await expect(
      saveDiscount({
        code: 'SAVE10',
        description: '',
        type: 'fixed',
        value: 100,
        active: true,
        startsAt: null,
        endsAt: null,
        usageLimit: null,
        perCustomerLimit: null,
        minOrderCents: 0,
        productIds: [],
        categorySlugs: [],
      }),
    ).rejects.toBeInstanceOf(DiscountCodeTakenError);
  });

  it('cannot be used to reset the redemption counter', async () => {
    const discount = await seedDiscount({ usedCount: 7 });

    await saveDiscount({
      id: String(discount._id),
      code: 'SAVE10',
      description: 'edited',
      type: 'percentage',
      value: 1000,
      active: true,
      startsAt: null,
      endsAt: null,
      usageLimit: null,
      perCustomerLimit: null,
      minOrderCents: 0,
      productIds: [],
      categorySlugs: [],
    });

    expect((await Discount.findById(discount._id).lean())?.usedCount).toBe(7);
  });
});

describe('redeemDiscount', () => {
  it('counts a redemption once, however many times it is retried', async () => {
    const discount = await seedDiscount();
    const orderId = String(discount._id);

    const input = {
      discountId: String(discount._id),
      code: 'SAVE10',
      orderId,
      email: 'buyer@example.com',
      amountCents: 500,
    };

    await redeemDiscount(input);
    await redeemDiscount(input);

    expect((await Discount.findById(discount._id).lean())?.usedCount).toBe(1);
    expect(await DiscountRedemption.countDocuments({})).toBe(1);
  });
});
