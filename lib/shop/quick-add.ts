import { formatCents } from '@/lib/money';
import { sizeOrder } from '@/lib/shop/colorways';
import type { QuantityRuleDTO, VariantDTO, WholesaleTierDTO } from '@/types/dto';

/**
 * One thing a card's Add to cart can put in the cart: a size of the colour on
 * show, or a run of a trade style. `variantId` is null when it cannot be
 * bought, so the choice is drawn but disabled rather than hidden — a missing
 * size reads as "not made", a struck one as "sold out".
 */
export type AddOption = {
  key: string;
  label: string;
  /** A second line, e.g. the per-unit price of a trade run. */
  detail?: string;
  variantId: string | null;
  quantity: number;
};

const UNITS = new Intl.NumberFormat('en-US');

/**
 * The sizes a retail card offers, for the colourway it is showing.
 *
 * Only enabled variants, smallest first, each added at the product's minimum
 * quantity — the same first quantity its own page opens on. A size with less
 * stock than that minimum cannot be bought from here, so it is disabled.
 */
export function retailAddOptions(variants: readonly VariantDTO[], rule: QuantityRuleDTO): AddOption[] {
  return variants
    .filter((variant) => variant.enabled)
    .sort((a, b) => sizeOrder(a.size) - sizeOrder(b.size))
    .map((variant) => ({
      key: variant.id,
      label: variant.size.toUpperCase(),
      variantId: variant.stock >= rule.min ? variant.id : null,
      quantity: rule.min,
    }));
}

/**
 * The runs a trade card offers, for the chosen colour.
 *
 * The same arithmetic as the style's own page: a run is not bought in a size,
 * so the variant behind it is the first enabled one in that colour, and the
 * quantity is the tier itself. Stock is not consulted — trade is made to order.
 */
export function tradeAddOptions(
  tiers: readonly WholesaleTierDTO[],
  variants: readonly VariantDTO[],
  color: string,
): AddOption[] {
  const variant =
    variants.find((candidate) => candidate.color === color && candidate.enabled) ??
    variants.find((candidate) => candidate.enabled);

  return tiers.map((step) => ({
    key: String(step.tier),
    label: `${UNITS.format(step.tier)} units`,
    detail: `${formatCents(step.unitPriceCents)} per unit`,
    variantId: variant?.id ?? null,
    quantity: step.tier,
  }));
}
