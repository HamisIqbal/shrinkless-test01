/**
 * The wholesale price ladder.
 *
 * PRICES HERE ARE DERIVED, NOT QUOTED. The tiers are real — they are the order
 * sizes the mill runs — but the discounts below were invented to make the page
 * demonstrable, exactly as the seed's retail prices and ratings were. Replace
 * `DISCOUNT_PERCENT` with the real trade terms before anyone is shown a number
 * they might hold us to.
 *
 * Pure arithmetic on purpose: no database, no formatting, no React. The page,
 * the server action and the confirmation email all price a line the same way
 * because they all come through here, and a discrepancy between the quote a
 * buyer saw and the quote that lands in the inbox is the one bug this module
 * exists to make impossible.
 */

/** Order sizes, in units, ascending. The only quantities wholesale sells in. */
export const WHOLESALE_TIERS = [150, 300, 450, 600, 1200] as const;

export type WholesaleTier = (typeof WHOLESALE_TIERS)[number];

/**
 * How far off retail each tier lands. Deepens with volume, which is the whole
 * argument for ordering more, and is stated in whole percent because that is
 * how a line sheet states it.
 */
const DISCOUNT_PERCENT: Record<WholesaleTier, number> = {
  150: 40,
  300: 45,
  450: 50,
  600: 55,
  1200: 60,
};

export type TierQuote = {
  tier: WholesaleTier;
  discountPercent: number;
  unitPriceCents: number;
  totalCents: number;
};

/**
 * Narrows an unknown — a form field, a URL fragment, a JSON body — to a tier.
 *
 * Deliberately strict about the type as well as the value: `'300'` is what a
 * form sends and it is not a tier, so callers are forced to convert before
 * asking rather than after.
 */
export function isWholesaleTier(value: unknown): value is WholesaleTier {
  return (
    typeof value === 'number' && (WHOLESALE_TIERS as readonly number[]).includes(value)
  );
}

/**
 * One line of a quote.
 *
 * The unit price is rounded to a whole cent BEFORE it is multiplied out. Doing
 * it the other way round produces a total that no longer divides by the
 * per-unit figure printed beside it, and a buyer checking our arithmetic on a
 * 1200-piece line would find us out by several dollars.
 */
export function quoteForTier(retailCents: number, tier: WholesaleTier): TierQuote {
  const discountPercent = DISCOUNT_PERCENT[tier];
  const unitPriceCents = Math.max(
    0,
    Math.round((retailCents * (100 - discountPercent)) / 100),
  );

  return {
    tier,
    discountPercent,
    unitPriceCents,
    totalCents: unitPriceCents * tier,
  };
}

/** Every tier for one style, in the order the page prints them. */
export function tierLadder(retailCents: number): TierQuote[] {
  return WHOLESALE_TIERS.map((tier) => quoteForTier(retailCents, tier));
}

export type EnquiryLineTotals = { unitPriceCents: number; tier: number };

/** What the enquiry panel shows at the bottom, and what the email repeats. */
export function enquiryTotal(lines: readonly EnquiryLineTotals[]): {
  units: number;
  totalCents: number;
} {
  return lines.reduce(
    (running, line) => ({
      units: running.units + line.tier,
      totalCents: running.totalCents + line.unitPriceCents * line.tier,
    }),
    { units: 0, totalCents: 0 },
  );
}
