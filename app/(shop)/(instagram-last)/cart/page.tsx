import Link from 'next/link';
import { readCartView } from '@/lib/cart-session';
import { CartLines } from '@/components/shop/CartLines';
import { formatCents } from '@/lib/money';

export const metadata = { title: 'Cart' };

export default async function CartPage() {
  const cart = await readCartView();

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="band band--tight wrap cartpage">
        <p className="eyebrow">Cart</p>
        <h1 className="head cartpage__head">Nothing in it yet.</h1>
        <Link href="/shop" className="btn btn--lg cartpage__cta">Shop tees</Link>
      </div>
    );
  }

  return (
    <div className="band band--tight wrap cartpage">
      <header>
        <p className="eyebrow">Cart</p>
        <h1 className="head cartpage__head">Your cart</h1>
      </header>

      <div className="cartlayout">
        <CartLines lines={cart.lines} />

        <aside className="summary" aria-labelledby="summary-heading">
          <h2 id="summary-heading" className="meta">Summary</h2>
          <hr className="rule summary__rule" />

          <dl className="summary__rows">
            <dt>Subtotal</dt>
            <dd className="tnum">{formatCents(cart.subtotalCents)}</dd>
            <dt>Shipping</dt>
            <dd className="summary__pending">At checkout</dd>
            <dt>Tax</dt>
            <dd className="summary__pending">At checkout</dd>
          </dl>

          <hr className="rule summary__rule" />

          <Link href="/checkout" className="btn btn--lg btn--block summary__cta">Checkout</Link>
          <Link href="/shop" className="ulink summary__back">Keep shopping</Link>
        </aside>
      </div>
    </div>
  );
}
