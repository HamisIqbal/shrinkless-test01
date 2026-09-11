'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addToCartAction } from '@/app/actions/cart';
import { ProductStory } from '@/components/shop/ProductStory';
import { StickyBuyBar } from '@/components/shop/StickyBuyBar';
import { useToast } from '@/components/ui/Toast';
import { formatCents } from '@/lib/money';
import type { WholesaleTier } from '@/lib/wholesale/pricing';
import type { WholesaleProductDetailDTO } from '@/types/dto';

type Props = { style: WholesaleProductDetailDTO };

const UNITS = new Intl.NumberFormat('en-US');

/**
 * The trade equivalent of `VariantPicker`, in the same order and the same
 * frame: price, story, spec, the choices, then the action that ends the page.
 *
 * The choices a wholesale buyer makes are a colour and a run size — a dropdown
 * of this style's own tiers, read off `style.tiers` and never hardcoded,
 * because every style's ladder is struck from its own retail basis. Choosing
 * one re-prices the panel and sets how many units the buttons add. There is no
 * size to pick; see `selected` below.
 *
 * Nothing is priced in the browser: the figures are the server's, and the cart
 * re-prices from the variant record it is handed.
 */
export function WholesaleBuyPanel({ style }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [picked, setPicked] = useState<WholesaleTier | null>(null);
  const [color, setColor] = useState(style.colors[0] ?? '');
  const [pending, startTransition] = useTransition();
  const actionsRef = useRef<HTMLDivElement>(null);

  const chosen = useMemo(
    () => style.tiers.find((step) => step.tier === picked) ?? null,
    [style.tiers, picked],
  );

  /* A run is not bought in a size. The old panel made a buyer pick one before
     it would let them enquire, which was a retail habit carried across: a
     trade order is a size run, and which sizes it breaks down into is settled
     in the conversation the enquiry starts. So the colourway is the choice,
     and the variant behind it is the first the style has in that colour. */
  const selected = useMemo(
    () =>
      style.variants.find((variant) => variant.color === color && variant.enabled) ??
      style.variants.find((variant) => variant.enabled),
    [style.variants, color],
  );

  /** The opening rung, shown until a quantity is chosen. */
  const opening = style.tiers[0];

  const priceLabel = chosen
    ? `${formatCents(chosen.unitPriceCents)} per unit`
    : opening
      ? `From ${formatCents(opening.unitPriceCents)} per unit`
      : 'Price on request';

  /* Only once a run is chosen. The opening rung used to sit here quoting the
     retail basis it was struck from, which invited a trade buyer to compare
     their price to a shelf price they will never charge. */
  const basis = chosen
    ? `${UNITS.format(chosen.tier)} units · ${formatCents(chosen.totalCents)} total`
    : null;

  /** Both buttons do the same thing; only Buy now carries on to the cart. */
  function add(then?: () => void) {
    if (!chosen) {
      toast('Choose a quantity first', 'error');
      return;
    }

    if (!selected) {
      toast('That colourway is unavailable', 'error');
      return;
    }

    startTransition(async () => {
      const result = await addToCartAction(selected.id, chosen.tier);
      toast(result.ok ? 'Added to cart' : result.error, result.ok ? 'ok' : 'error');

      if (result.ok) {
        router.refresh();
        then?.();
      }
    });
  }

  return (
    <div className="picker">
      <p className="picker__price tnum">
        {priceLabel}
        {basis ? <span className="tradestyle__basis">{basis}</span> : null}
      </p>

      <ProductStory description={style.description} />

      <ul className="picker__spec">
        <li>Garment Dyed Organic Cotton</li>
        <li>Made in USA</li>
        <li>Made to order</li>
        {/* Stated rather than chosen: the run's size ratio is settled in the
            enquiry, but the buyer still has to know what the style is cut in. */}
        {style.sizes.length ? (
          <li>{`Sizes ${style.sizes.map((size) => size.toUpperCase()).join(', ')}`}</li>
        ) : null}
      </ul>

      {style.colors.length ? (
        <fieldset className="picker__group">
          <legend className="meta picker__legend">Colors</legend>
          <div className="swatchrow">
            {style.colors.map((option) => (
              <label
                key={option}
                className={`swatch${color === option ? ' swatch--on' : ''}`}
              >
                <input
                  type="radio"
                  name="color"
                  value={option}
                  className="visually-hidden"
                  checked={color === option}
                  onChange={() => setColor(option)}
                />
                <span className={`swatch__dot dot--${option}`} aria-hidden="true" />
                <span className="swatch__name">{option}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="picker__group">
        <label className="meta picker__legend" htmlFor="wholesale-quantity">
          Quantity — sold by the run
        </label>
        <select
          id="wholesale-quantity"
          className="picker__select"
          value={picked ?? ''}
          onChange={(event) => {
            const next = event.target.value;
            setPicked(next ? (Number(next) as WholesaleTier) : null);
          }}
        >
          <option value="">Choose a quantity</option>
          {style.tiers.map((step) => (
            <option key={step.tier} value={step.tier}>
              {`${UNITS.format(step.tier)} units — ${formatCents(
                step.unitPriceCents,
              )} per unit · ${formatCents(step.totalCents)}`}
            </option>
          ))}
        </select>

        {chosen ? (
          <p className="picker__total tnum" aria-live="polite">
            <span>Indicative total</span>
            <span>{formatCents(chosen.totalCents)}</span>
          </p>
        ) : null}
      </div>

      <div className="picker__actions" ref={actionsRef}>
        <button
          type="button"
          className="btn btn--light btn--lg btn--block"
          onClick={() => add()}
          disabled={pending}
        >
          {pending ? 'Adding' : 'Add to cart'}
        </button>

        <button
          type="button"
          className="btn btn--accent btn--lg btn--block"
          onClick={() => add(() => router.push('/cart'))}
          disabled={pending}
        >
          Buy now
        </button>
      </div>

      {/* The same two handlers, not a second purchase path. */}
      <StickyBuyBar
        anchor={actionsRef}
        title={style.title}
        price={
          chosen
            ? `${UNITS.format(chosen.tier)} units · ${formatCents(chosen.totalCents)}`
            : priceLabel
        }
      >
        <button type="button" className="btn" onClick={() => add()} disabled={pending}>
          {pending ? 'Adding' : 'Add to cart'}
        </button>
        <button
          type="button"
          className="btn btn--accent"
          onClick={() => add(() => router.push('/cart'))}
          disabled={pending}
        >
          Buy now
        </button>
      </StickyBuyBar>
    </div>
  );
}
