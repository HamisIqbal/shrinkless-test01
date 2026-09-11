'use client';

import { useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { updateQuantityAction } from '@/app/actions/cart';
import { imageUrl } from '@/lib/images';
import { formatCents } from '@/lib/money';
import { useToast } from '@/components/ui/Toast';
import type { CartLineDTO } from '@/types/dto';

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
    <div className="cartlines">
      <ul>
        {lines.map((line) => (
          <li key={line.variantId} className="cartline">
            <Link href={`/product/${line.productSlug}`} className="cartline__plate">
              <div className="frame frame--45">
                {line.imagePublicId ? (
                  <Image
                    src={imageUrl(line.imagePublicId, 'c_fill,w_400,h_500,q_auto,f_auto')}
                    alt={line.productTitle}
                    fill
                    sizes="160px"
                  />
                ) : null}
              </div>
            </Link>

            <div className="cartline__body">
              <h2 className="cartline__title">
                <Link href={`/product/${line.productSlug}`}>{line.productTitle}</Link>
              </h2>
              <p className="meta">{line.color} / {line.size.toUpperCase()}</p>
              <p className="meta tnum">{formatCents(line.unitPriceCents)} each</p>

              <div className="stepper" role="group" aria-label={`Quantity for ${line.productTitle}`}>
                <button
                  type="button"
                  className="stepper__button"
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

                <span className="stepper__value tnum" aria-live="polite">{line.quantity}</span>

                <button
                  type="button"
                  className="stepper__button"
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

                <button
                  type="button"
                  className="ulink cartline__remove"
                  disabled={pending}
                  onClick={() => change(line.variantId, 0)}
                >
                  Remove
                </button>
              </div>
            </div>

            <p className="cartline__total tnum">{formatCents(line.lineTotalCents)}</p>
          </li>
        ))}
      </ul>

    </div>
  );
}
