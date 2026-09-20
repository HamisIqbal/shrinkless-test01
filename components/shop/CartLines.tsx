'use client';

import { useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { updateQuantityAction } from '@/app/actions/cart';
import { imageUrl } from '@/lib/images';
import { formatCents } from '@/lib/money';
import { useToast } from '@/components/ui/Toast';
import type { CartLineDTO } from '@/types/dto';
import './shop.css';

/**
 * The cart as a ledger: one row per line, each stating the same four things in
 * the same order — what it is, how it is specified, how many, and what that
 * comes to.
 *
 * The arithmetic is the change. A line used to print a unit price on one side
 * of the row and a line total on the other, with nothing joining them, so a
 * cart holding two of something showed two numbers and left the reader to work
 * out which was which. Now the multiplication is written out under the figure
 * it produces.
 */
export function CartLines({ lines }: { lines: CartLineDTO[] }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function change(variantId: string, quantity: number) {
    startTransition(async () => {
      const result = await updateQuantityAction(variantId, quantity);

      if (!result.ok) toast(result.error, 'error');
      else if (quantity === 0) toast('Removed from cart');
    });
  }

  return (
    <ul className="sh-cart__lines">
      {lines.map((line) => (
        <li key={line.variantId} className="sh-cart__line">
          <Link href={`/product/${line.productSlug}`} className="sh-cart__plate">
            {line.imagePublicId ? (
              <Image
                src={imageUrl(line.imagePublicId, 'c_fill,w_400,h_500,q_auto,f_auto')}
                alt={line.productTitle}
                fill
                sizes="160px"
              />
            ) : null}
          </Link>

          <div className="sh-cart__body">
            <div className="sh-cart__top">
              <h3 className="sh-cart__name">
                <Link href={`/product/${line.productSlug}`}>{line.productTitle}</Link>
              </h3>

              <p className="sh-cart__sum tnum">
                {formatCents(line.lineTotalCents)}
                <span className="sh-cart__each">
                  {line.quantity} &times; {formatCents(line.unitPriceCents)}
                </span>
              </p>
            </div>

            <p className="sh-cart__spec">
              {line.color} / {line.size.toUpperCase()}
            </p>

            <div className="sh-cart__acts">
              <div
                className="sh-step"
                role="group"
                aria-label={`Quantity for ${line.productTitle}`}
              >
                <button
                  type="button"
                  className="sh-step__btn"
                  disabled={pending}
                  aria-label="Decrease quantity"
                  onClick={() =>
                    /* Stepping below the minimum removes the line: a product
                       sold in twelves has no "eleven" to fall back to. */
                    change(
                      line.variantId,
                      line.quantity - line.quantityRule.step < line.quantityRule.min
                        ? 0
                        : line.quantity - line.quantityRule.step,
                    )
                  }
                >
                  &minus;
                </button>

                <span className="sh-step__value tnum" aria-live="polite">{line.quantity}</span>

                <button
                  type="button"
                  className="sh-step__btn"
                  disabled={
                    pending ||
                    line.quantity + line.quantityRule.step > line.availableStock ||
                    (line.quantityRule.max !== null &&
                      line.quantity + line.quantityRule.step > line.quantityRule.max)
                  }
                  aria-label="Increase quantity"
                  onClick={() => change(line.variantId, line.quantity + line.quantityRule.step)}
                >
                  +
                </button>
              </div>

              <button
                type="button"
                className="sh-link"
                disabled={pending}
                onClick={() => change(line.variantId, 0)}
              >
                Remove
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
