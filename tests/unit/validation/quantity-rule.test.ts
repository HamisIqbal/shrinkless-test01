import { describe, expect, it } from 'vitest';
import {
  isAllowedQuantity,
  quantityBounds,
  quantityOptions,
  quantityRuleSchema,
  snapQuantity,
} from '@/lib/validation/product';

const SINGLES = { min: 1, step: 1, max: null };
const PAIRS = { min: 2, step: 2, max: null };
const DOZENS = { min: 12, step: 12, max: 36 };

describe('isAllowedQuantity', () => {
  it('allows anything whole and positive by default', () => {
    expect(isAllowedQuantity(1, SINGLES)).toBe(true);
    expect(isAllowedQuantity(97, SINGLES)).toBe(true);
    expect(isAllowedQuantity(0, SINGLES)).toBe(false);
    expect(isAllowedQuantity(1.5, SINGLES)).toBe(false);
  });

  it('enforces a step', () => {
    expect(isAllowedQuantity(2, PAIRS)).toBe(true);
    expect(isAllowedQuantity(4, PAIRS)).toBe(true);
    expect(isAllowedQuantity(3, PAIRS)).toBe(false);
    expect(isAllowedQuantity(1, PAIRS)).toBe(false);
  });

  it('enforces a minimum and a maximum together', () => {
    expect(isAllowedQuantity(12, DOZENS)).toBe(true);
    expect(isAllowedQuantity(24, DOZENS)).toBe(true);
    expect(isAllowedQuantity(36, DOZENS)).toBe(true);
    expect(isAllowedQuantity(48, DOZENS)).toBe(false);
    expect(isAllowedQuantity(18, DOZENS)).toBe(false);
  });
});

describe('snapQuantity', () => {
  it('rounds up to the next legal value', () => {
    expect(snapQuantity(1, DOZENS)).toBe(12);
    expect(snapQuantity(13, DOZENS)).toBe(24);
    expect(snapQuantity(99, DOZENS)).toBe(36);
    expect(snapQuantity(3, PAIRS)).toBe(4);
  });
});

describe('quantityOptions', () => {
  it('offers only what the rule and the shelf both allow', () => {
    expect(quantityOptions(DOZENS, 30)).toEqual([12, 24]);
    expect(quantityOptions(PAIRS, 7)).toEqual([2, 4, 6]);
    expect(quantityOptions(DOZENS, 5)).toEqual([]);
  });

  it('caps the list for an unbounded rule', () => {
    expect(quantityOptions(SINGLES, 10_000, 10)).toHaveLength(10);
  });
});

describe('quantityRuleSchema', () => {
  it('rejects a maximum below the minimum', () => {
    expect(quantityRuleSchema.safeParse({ min: 12, step: 12, max: 6 }).success).toBe(false);
  });

  it('rejects a maximum no step can reach', () => {
    expect(quantityRuleSchema.safeParse({ min: 12, step: 12, max: 30 }).success).toBe(false);
  });

  it('accepts a reachable maximum', () => {
    expect(quantityRuleSchema.safeParse({ min: 12, step: 12, max: 36 }).success).toBe(true);
  });
});

/* --------------------------------------------------------------------------
   quantityBounds

   The arithmetic behind both steppers. It lives in one place because the
   product page and the quick view had drifted apart: the quick view stepped
   by one from one whatever the product was sold in, so a style sold in
   dozens opened on a quantity the shop refuses.
   -------------------------------------------------------------------------- */

describe('quantityBounds', () => {
  it('caps at the stock on the shelf', () => {
    expect(quantityBounds(SINGLES, 3)).toEqual({ lowest: 1, highest: 3 });
  });

  it('lands on the last whole step at or below the stock', () => {
    // 30 on the shelf, sold in twelves: 24 is the most that can be bought.
    expect(quantityBounds({ min: 12, step: 12, max: null }, 30).highest).toBe(24);
  });

  it("honours the product's own ceiling below the stock", () => {
    expect(quantityBounds(DOZENS, 500).highest).toBe(36);
  });

  it('never returns a highest below the minimum, however bare the shelf', () => {
    // Fewer than one legal purchase in stock. The stepper still has to render
    // something, and the minimum is the only quantity that means anything.
    expect(quantityBounds(DOZENS, 4)).toEqual({ lowest: 12, highest: 12 });
    expect(quantityBounds(DOZENS, 0).highest).toBe(12);
  });

  it('opens on ten steps when no size is chosen yet', () => {
    expect(quantityBounds(SINGLES, null).highest).toBe(10);
    expect(quantityBounds(PAIRS, null).highest).toBe(20);
  });
});
