'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { formatCents } from '@/lib/money';
import { imageUrl } from '@/lib/images';
import { sizeOrder, toColorways } from '@/lib/shop/colorways';
import { addToCartAction } from '@/app/actions/cart';
import { quantityBounds, snapQuantity } from '@/lib/validation/product';
import { useToast } from '@/components/ui/Toast';
import type { ProductDTO } from '@/types/dto';

type Props = {
  /** Never null: the grid mounts this only while a product is open, keyed by
   *  product id, so every open starts from clean state without a reset pass. */
  product: ProductDTO;
  onClose: () => void;
};

const EASE = [0.16, 0.84, 0.44, 1] as const;

/**
 * A miniature product page over the collection, so choosing a size does not
 * cost the shopper their place in the grid.
 *
 * Everything needed to buy is here — colour, size, quantity, add to cart, buy
 * now — plus a way through to the full page for the detail this cannot hold.
 * The dialog traps focus and restores it on close; the backdrop and Escape
 * both dismiss.
 */
export function QuickView({ product, onClose }: Props) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const rule = product.quantityRule;

  const [color, setColor] = useState(product.colors[0] ?? '');
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState(rule.min);
  const [pending, startTransition] = useTransition();

  const colorways = useMemo(() => toColorways(product), [product]);

  useEffect(() => {
    const panel = panelRef.current;
    const previous = document.activeElement as HTMLElement | null;

    function nodes(): HTMLElement[] {
      if (!panel) return [];
      return [
        ...panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((node) => node.offsetParent !== null);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const list = nodes();
      if (!list.length) return;

      const first = list[0];
      const last = list[list.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => nodes()[0]?.focus());

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      cancelAnimationFrame(raf);
      previous?.focus?.();
    };
  }, [onClose]);

  const ordered = [...product.sizes].sort((a, b) => sizeOrder(a) - sizeOrder(b));
  const colorway = colorways.find((option) => option.color === color) ?? colorways[0];
  const image = colorway?.image ?? (product.images[0]
    ? { url: product.images[0].publicId, alt: product.images[0].alt }
    : null);

  function variantFor(nextSize: string, nextColor: string) {
    return product.variants.find(
      (variant) => variant.size === nextSize && variant.color === nextColor && variant.enabled,
    );
  }

  const selected = size ? variantFor(size, color) : undefined;
  const priced = selected ?? variantFor(ordered[0] ?? '', color);

  /* The quick view sells the same products the product page does, under the
     same rules. It used to step by one from one regardless — so a style sold
     in twelves opened here on a quantity the shop does not sell, and its Add
     to cart was refused by the server every time it was pressed. */
  const { highest } = quantityBounds(rule, selected?.stock ?? null);
  const capped = Math.min(Math.max(quantity, rule.min), highest);

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

  const href = `/product/${product.slug}${color ? `?color=${encodeURIComponent(color)}` : ''}`;

  return (
    <motion.div
      className="quick"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.24, ease: EASE }}
    >
      <button
        type="button"
        className="quick__scrim"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
      />

      <motion.div
        className="quick__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-title"
        ref={panelRef}
        /* Lenis owns the page's wheel and swallows the event before a nested
           scroller sees it, which left this panel draggable by its scrollbar
           and immovable by a trackpad. The attribute is Lenis's own opt-out:
           a wheel over the panel stays with the browser. */
        data-lenis-prevent
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.34, ease: EASE }}
      >
        <button type="button" className="quick__close" onClick={onClose}>
          <span className="quick__closemark" aria-hidden="true" />
          <span className="visually-hidden">Close quick view</span>
        </button>

        <div className="quick__media">
          <div className="frame frame--45">
            {image ? (
              <Image
                src={imageUrl(image.url, 'c_fill,w_1000,h_1250,q_auto,f_auto')}
                alt={image.alt || product.title}
                fill
                sizes="(min-width: 48rem) 40vw, 90vw"
              />
            ) : null}
          </div>
        </div>

        <div className="quick__body">
          <p className="eyebrow">Shrinkless</p>
          <h2 id="quick-title" className="sub quick__title">{product.title}</h2>

          <p className="quick__price tnum">
            {priced ? formatCents(priced.priceCents) : 'Unavailable'}
          </p>

          {product.description ? (
            <p className="quick__copy">{product.description}</p>
          ) : null}

          <fieldset className="quick__group">
            <legend className="meta quick__legend">Colour</legend>
            <div className="swatchrow">
              {product.colors.map((option) => (
                <label
                  key={option}
                  className={`swatch${color === option ? ' swatch--on' : ''}`}
                >
                  <input
                    type="radio"
                    name="quick-color"
                    value={option}
                    className="visually-hidden"
                    checked={color === option}
                    onChange={() => { setColor(option); setSize(''); }}
                  />
                  <span
                    className={`swatch__dot dot--${option}`}
                    aria-hidden="true"
                  />
                  <span className="swatch__name">{option}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="quick__group">
            <legend className="meta quick__legend">Size</legend>
            <div className="chiprow">
              {ordered.map((option) => {
                const variant = variantFor(option, color);
                const out = !variant || !variant.inStock;

                return (
                  <label
                    key={option}
                    className={`chip${size === option ? ' chip--on' : ''}${out ? ' chip--sold' : ''}`}
                  >
                    <input
                      type="radio"
                      name="quick-size"
                      value={option}
                      className="visually-hidden"
                      checked={size === option}
                      disabled={out}
                      onChange={() => setSize(option)}
                    />
                    {option.toUpperCase()}
                    {out ? <span className="visually-hidden"> (sold out)</span> : null}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="quick__group">
            <p className="meta quick__legend" id="quick-qty">
              Quantity
              {rule.step > 1 ? ` — sold in ${rule.step}s` : ''}
              {rule.step === 1 && rule.min > 1 ? ` — minimum ${rule.min}` : ''}
            </p>
            <div className="stepper" role="group" aria-labelledby="quick-qty">
              <button
                type="button"
                className="stepper__button"
                onClick={() => setQuantity(Math.max(capped - rule.step, rule.min))}
                disabled={capped <= rule.min}
              >
                <span aria-hidden="true">&minus;</span>
                <span className="visually-hidden">Decrease quantity</span>
              </button>
              <output className="stepper__value tnum">{capped}</output>
              <button
                type="button"
                className="stepper__button"
                onClick={() =>
                  setQuantity(snapQuantity(Math.min(capped + rule.step, highest), rule))
                }
                disabled={capped >= highest}
              >
                <span aria-hidden="true">+</span>
                <span className="visually-hidden">Increase quantity</span>
              </button>
            </div>
          </div>

          <div className="quick__actions">
            <button
              type="button"
              className="btn btn--lg btn--block"
              onClick={() => add()}
              disabled={pending}
            >
              {pending ? 'Adding' : 'Add to cart'}
            </button>

            {/* Buy now adds and moves to the cart, the same as on a product
                page — one purchase path, not two. */}
            <button
              type="button"
              className="btn btn--outline btn--lg btn--block"
              onClick={() => add(() => router.push('/cart'))}
              disabled={pending}
            >
              Buy now
            </button>
          </div>

          <Link href={href} className="ulink quick__full" onClick={onClose}>
            View full product
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
