'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addToCartAction } from '@/app/actions/cart';
import { ProductStory } from '@/components/shop/ProductStory';
import { RestockForm } from '@/components/shop/RestockForm';
import { StickyBuyBar } from '@/components/shop/StickyBuyBar';
import { useToast } from '@/components/ui/Toast';
import { formatCents } from '@/lib/money';
import { sizeOrder } from '@/lib/shop/colorways';
import { quantityBounds, snapQuantity } from '@/lib/validation/product';
import type { QuantityRuleDTO, VariantDTO } from '@/types/dto';

type Props = {
  /** For the back-in-stock record, which is per product and per colourway. */
  slug: string;
  /** Named in the sticky bar once the page's own actions have scrolled off. */
  title: string;
  sizes: string[];
  colors: string[];
  variants: VariantDTO[];
  /** Sits under the price: the first thing read after the number. */
  description?: string;
  /** From `?color=` on the collection tiles, so the tile you clicked is selected. */
  initialColor?: string;
  /** How this product is sold: a minimum, a step, and an optional ceiling.
   *  The stepper offers only legal values; the server enforces the same rule. */
  quantityRule?: QuantityRuleDTO;
};

const SINGLES: QuantityRuleDTO = { min: 1, step: 1, max: null };

export function VariantPicker({
  slug,
  title,
  sizes,
  colors,
  variants,
  description,
  initialColor,
  quantityRule = SINGLES,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const actionsRef = useRef<HTMLDivElement>(null);

  const [color, setColor] = useState(
    initialColor && colors.includes(initialColor) ? initialColor : (colors[0] ?? ''),
  );
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState(quantityRule.min);
  const [pending, startTransition] = useTransition();

  const ordered = [...sizes].sort((a, b) => sizeOrder(a) - sizeOrder(b));

  function findVariant(nextSize: string, nextColor: string) {
    return variants.find(
      (variant) => variant.size === nextSize && variant.color === nextColor && variant.enabled,
    );
  }

  const selected = size ? findVariant(size, color) : undefined;
  const priced = selected ?? findVariant(ordered[0] ?? '', color);

  // Nothing in this colourway can be bought. The buttons say so rather than
  // sending a shopper round the "choose a size" loop with no size to choose:
  // every chip is disabled, so the error had no way to be acted on.
  const soldOut = ordered.every((option) => {
    const variant = findVariant(option, color);
    return !variant || !variant.inStock;
  });

  // The stepper cannot offer more than the shelf holds, and cannot offer a
  // quantity the product is not sold in. Shared with the quick view, which is
  // this same control in a smaller frame.
  const { highest } = quantityBounds(quantityRule, selected?.stock ?? null);

  const capped = Math.min(Math.max(quantity, quantityRule.min), highest);

  /** True when the shelf cannot even cover one legal purchase. */
  const belowMinimum = Boolean(selected) && (selected?.stock ?? 0) < quantityRule.min;

  /* Nothing here can be bought right now. The stepper is already pinned to the
     minimum with no smaller rung to drop to, so leaving the buttons live meant
     the only thing pressing them could produce was the same refusal every
     time. */
  const unbuyable = pending || belowMinimum;

  function add(then?: () => void) {
    if (!selected) {
      toast('Choose a size first', 'error');
      return;
    }

    startTransition(async () => {
      const result = await addToCartAction(selected.id, capped);
      toast(result.ok ? 'Added to cart' : result.error, result.ok ? 'ok' : 'error');

      if (result.ok) {
        router.refresh();
        then?.();
      }
    });
  }

  const priceLabel = priced ? formatCents(priced.priceCents) : 'Unavailable';

  return (
    <div className="picker">
      <p className="picker__price tnum">{priceLabel}</p>

      <ProductStory description={description} />

      <ul className="picker__spec">
        <li>Garment Dyed Organic Cotton</li>
        <li>Made in USA</li>
        <li>Doesn&rsquo;t Shrink</li>
      </ul>

      <fieldset className="picker__group">
        <legend className="meta picker__legend">Color</legend>
        <div className="swatchrow">
          {colors.map((option) => (
            <label key={option} className={`swatch${color === option ? ' swatch--on' : ''}`}>
              <input
                type="radio"
                name="color"
                value={option}
                className="visually-hidden"
                checked={color === option}
                onChange={() => {
                  setColor(option);
                  // A size the new colourway does not stock would otherwise stay
                  // lit while nothing was actually selected underneath it.
                  const carried = findVariant(size, option);
                  if (!carried || !carried.inStock) setSize('');
                }}
              />
              <span className={`swatch__dot dot--${option}`} aria-hidden="true" />
              <span className="swatch__name">{option}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {soldOut ? (
        <RestockForm slug={slug} color={color} />
      ) : (
        <>
      <fieldset className="picker__group">
        <legend className="meta picker__legend">Size</legend>
        <div className="chiprow">
          {ordered.map((option) => {
            const variant = findVariant(option, color);
            const unavailable = !variant || !variant.inStock;

            return (
              <label
                key={option}
                className={`chip${size === option ? ' chip--on' : ''}${
                  unavailable ? ' chip--sold' : ''
                }`}
                aria-disabled={unavailable || undefined}
                title={unavailable ? `${option.toUpperCase()} is sold out` : undefined}
              >
                <input
                  type="radio"
                  name="size"
                  value={option}
                  className="visually-hidden"
                  checked={size === option}
                  disabled={unavailable}
                  onChange={() => setSize(option)}
                />
                {option.toUpperCase()}
                {unavailable ? <span className="visually-hidden"> (sold out)</span> : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="picker__group">
        <p className="meta picker__legend" id="qty-label">
          Quantity
          {quantityRule.step > 1 ? ` — sold in ${quantityRule.step}s` : ''}
          {quantityRule.step === 1 && quantityRule.min > 1
            ? ` — minimum ${quantityRule.min}`
            : ''}
        </p>
        <div className="stepper picker__qty" role="group" aria-labelledby="qty-label">
          <button
            type="button"
            className="stepper__button"
            disabled={capped <= quantityRule.min}
            aria-label="Decrease quantity"
            onClick={() => setQuantity(Math.max(capped - quantityRule.step, quantityRule.min))}
          >
            &minus;
          </button>

          <span className="stepper__value tnum" aria-live="polite">{capped}</span>

          <button
            type="button"
            className="stepper__button"
            disabled={capped >= highest}
            aria-label="Increase quantity"
            onClick={() => setQuantity(snapQuantity(Math.min(capped + quantityRule.step, highest), quantityRule))}
          >
            +
          </button>

          {selected ? (
            <span
              className={`picker__stock${selected.stock > 5 && !belowMinimum ? ' picker__stock--in' : ''}`}
            >
              {belowMinimum
                ? `Fewer than ${quantityRule.min} left`
                : selected.stock <= 5
                  ? `Only ${selected.stock} left`
                  : 'In stock'}
            </span>
          ) : null}
        </div>
      </div>

      <div className="picker__actions" ref={actionsRef}>
        <button
          type="button"
          className="btn btn--lg btn--block"
          onClick={() => add()}
          disabled={unbuyable}
        >
          {pending ? 'Adding' : belowMinimum ? 'Not enough left' : 'Add to cart'}
        </button>

        {/* Buy now adds and goes to the cart rather than jumping the shopper
            straight into payment: the cart is where a second thought, a
            quantity change and the running total all live, and skipping it
            for one tap saved is not a trade this shop makes. */}
        <button
          type="button"
          className="btn btn--accent btn--lg btn--block"
          onClick={() => add(() => router.push('/cart'))}
          disabled={unbuyable}
        >
          Buy now
        </button>
      </div>

      {/* The same two handlers, not a second purchase path. */}
      <StickyBuyBar anchor={actionsRef} title={title} price={priceLabel}>
        <button
          type="button"
          className="btn"
          onClick={() => add()}
          disabled={unbuyable}
        >
          {pending ? 'Adding' : belowMinimum ? 'Not enough left' : 'Add to cart'}
        </button>
        <button
          type="button"
          className="btn btn--accent"
          onClick={() => add(() => router.push('/cart'))}
          disabled={unbuyable}
        >
          Buy now
        </button>
      </StickyBuyBar>
        </>
      )}
    </div>
  );
}
