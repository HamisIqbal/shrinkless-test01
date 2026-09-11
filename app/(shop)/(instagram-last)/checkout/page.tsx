import Link from 'next/link';
import { readCartView } from '@/lib/cart-session';
import { CheckoutFlow } from '@/components/shop/CheckoutFlow';
import { formatCents } from '@/lib/money';
import { publishableKey, stripeConfigured } from '@/lib/stripe/client';

export const metadata = { title: 'Checkout' };

/**
 * Checkout stays on the store rather than handing the last step to a hosted
 * payment page. The whole shop has been built to feel like one thing; the
 * moment a shopper actually pays is the worst possible place to break that.
 */
export default async function CheckoutPage() {
  const cart = await readCartView();

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="band band--tight wrap cartpage">
        <p className="eyebrow">Checkout</p>
        <h1 className="head cartpage__head">Nothing to pay for yet.</h1>
        <Link href="/shop" className="btn btn--lg cartpage__cta">Shop tees</Link>
      </div>
    );
  }

  // Shipping is a flat standard service at no charge, so the total is the
  // subtotal. Stated here rather than left to be inferred from a blank row.
  const totalCents = cart.subtotalCents;

  return (
    <div className="band band--tight wrap checkout">
      <header>
        <p className="eyebrow">Checkout</p>
        <h1 className="head checkout__head">Almost yours.</h1>
      </header>

      <div className="checkout__layout">
        <div className="checkout__main">
          {stripeConfigured() ? (
            <CheckoutFlow publishableKey={publishableKey()} totalCents={totalCents} />
          ) : (
            <p className="notice notice--error checkout__unavailable">
              Checkout is being set up and cannot take payments yet. Your cart is
              saved — please try again shortly.
            </p>
          )}
        </div>

        <aside className="summary checkout__summary" aria-labelledby="summary-heading">
          <h2 id="summary-heading" className="meta">Order</h2>
          <hr className="rule summary__rule" />

          <ul className="checkout__items">
            {cart.lines.map((line) => (
              <li key={line.variantId} className="checkout__item">
                <span>
                  <span className="checkout__itemname">{line.productTitle}</span>
                  <span className="checkout__itemspec">
                    {line.color} / {line.size.toUpperCase()} × {line.quantity}
                  </span>
                </span>
                <span className="tnum">{formatCents(line.lineTotalCents)}</span>
              </li>
            ))}
          </ul>

          <hr className="rule summary__rule" />

          <dl className="summary__rows">
            <dt>Subtotal</dt>
            <dd className="tnum">{formatCents(cart.subtotalCents)}</dd>
            <dt>Shipping</dt>
            <dd>Free</dd>
          </dl>

          <hr className="rule summary__rule" />

          <dl className="summary__rows checkout__total">
            <dt>Total</dt>
            <dd className="tnum">{formatCents(totalCents)}</dd>
          </dl>

          <p className="checkout__terms">
            All sales are final. We ship within the United States only.
          </p>

          <Link href="/cart" className="ulink summary__back">Edit cart</Link>
        </aside>
      </div>
    </div>
  );
}
