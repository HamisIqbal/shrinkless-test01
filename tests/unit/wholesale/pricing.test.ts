import { describe, expect, it } from 'vitest';
import {
  WHOLESALE_TIERS,
  isWholesaleTier,
  quoteForTier,
  tierLadder,
  enquiryTotal,
} from '@/lib/wholesale/pricing';

describe('wholesale tiers', () => {
  it('offers the five order sizes, ascending', () => {
    expect([...WHOLESALE_TIERS]).toEqual([150, 300, 450, 600, 1200]);
  });

  it('recognises only a real tier', () => {
    expect(isWholesaleTier(300)).toBe(true);
    expect(isWholesaleTier(301)).toBe(false);
    expect(isWholesaleTier('300')).toBe(false);
    expect(isWholesaleTier(null)).toBe(false);
  });
});

describe('quoteForTier', () => {
  it('discounts a $48 retail tee down the ladder', () => {
    expect(quoteForTier(4800, 150)).toEqual({
      tier: 150,
      discountPercent: 40,
      unitPriceCents: 2880,
      totalCents: 432_000,
    });

    expect(quoteForTier(4800, 1200)).toEqual({
      tier: 1200,
      discountPercent: 60,
      unitPriceCents: 1920,
      totalCents: 2_304_000,
    });
  });

  it('rounds the unit price to a whole cent rather than carrying a fraction', () => {
    // 4550 * 0.55 = 2502.5 — a half cent, which must not reach the total.
    const quote = quoteForTier(4550, 150);

    expect(Number.isInteger(quote.unitPriceCents)).toBe(true);
    expect(quote.totalCents).toBe(quote.unitPriceCents * 150);
  });

  it('never prices below zero', () => {
    expect(quoteForTier(0, 1200).unitPriceCents).toBe(0);
  });
});

describe('tierLadder', () => {
  it('returns one quote per tier, cheapest per unit last', () => {
    const ladder = tierLadder(6200);

    expect(ladder.map((step) => step.tier)).toEqual([...WHOLESALE_TIERS]);

    const units = ladder.map((step) => step.unitPriceCents);
    expect(units).toEqual([...units].sort((a, b) => b - a));
  });

  it('always beats retail, even at the smallest tier', () => {
    for (const step of tierLadder(4400)) expect(step.unitPriceCents).toBeLessThan(4400);
  });
});

describe('enquiryTotal', () => {
  it('adds the lines up', () => {
    expect(
      enquiryTotal([
        { unitPriceCents: 2880, tier: 150 },
        { unitPriceCents: 1920, tier: 1200 },
      ]),
    ).toEqual({ units: 1350, totalCents: 2_736_000 });
  });

  it('is zero for an empty enquiry', () => {
    expect(enquiryTotal([])).toEqual({ units: 0, totalCents: 0 });
  });
});
