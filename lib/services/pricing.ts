import { getStoreSettings } from '@/lib/services/settings';
import { evaluateDiscount } from '@/lib/services/discounts';
import { defaultShippingQuote, quoteShipping } from '@/lib/services/shipping';
import type { CartLineDTO, PricingBreakdownDTO, SettingsDTO } from '@/types/dto';

/**
 * The one place an order total is calculated.
 *
 * Every input that decides money comes from the database: line prices from the
 * variant, the discount from the coupon record, the shipping rate from the
 * method, the tax rate from settings. The only thing a caller may supply from
 * a request is a *code* and a *destination* — never an amount.
 *
 * Order of operations matters and is fixed here: discount comes off the
 * subtotal, tax is charged on the discounted goods, and shipping is added
 * last and untaxed. A different jurisdiction may want a different order; it
 * should change this function rather than growing a second one.
 */
export async function priceOrder(input: {
  lines: CartLineDTO[];
  discountCode?: string;
  shippingMethodCode?: string;
  country?: string;
  state?: string;
  userId?: string | null;
  email?: string | null;
  settings?: SettingsDTO;
  now?: Date;
}): Promise<PricingBreakdownDTO> {
  const settings = input.settings ?? (await getStoreSettings());

  const subtotalCents = input.lines.reduce((sum, line) => sum + line.lineTotalCents, 0);

  let discountCents = 0;
  let discountCode = '';
  let discountError = '';

  const code = (input.discountCode ?? '').trim();
  if (code) {
    const evaluation = await evaluateDiscount({
      code,
      lines: input.lines,
      userId: input.userId ?? null,
      email: input.email ?? null,
      now: input.now,
    });

    if (evaluation.ok) {
      discountCents = evaluation.amountCents;
      discountCode = evaluation.discount.code;
    } else {
      // A bad code is reported, never thrown: a checkout should still price
      // itself so the shopper sees a total and the reason side by side.
      discountError = evaluation.message;
    }
  }

  const discountedGoods = Math.max(0, subtotalCents - discountCents);

  const quote = input.shippingMethodCode
    ? (await quoteShipping({
        subtotalCents: discountedGoods,
        country: input.country,
        state: input.state,
        settings,
      })).find((candidate) => candidate.code === input.shippingMethodCode) ?? null
    : await defaultShippingQuote({
        subtotalCents: discountedGoods,
        country: input.country,
        state: input.state,
        settings,
      });

  const shippingCents = quote?.rateCents ?? 0;

  return {
    subtotalCents,
    discountCode,
    discountCents,
    shippingCents,
    shippingMethodCode: quote?.code ?? '',
    shippingMethodName: quote?.name ?? '',
    taxCents: taxFor(discountedGoods, settings),
    totalCents: discountedGoods + shippingCents + taxFor(discountedGoods, settings),
    discountError,
  };
}

/**
 * Tax on the discounted goods only.
 *
 * `stripe` mode means the provider is the authority and calculates at
 * checkout, so nothing is charged here — returning a guess would produce a
 * total the payment page then contradicts.
 */
export function taxFor(taxableCents: number, settings: SettingsDTO): number {
  if (settings.taxMode === 'flat') {
    return Math.round((taxableCents * settings.flatTaxRateBasisPoints) / 10_000);
  }

  return 0;
}
