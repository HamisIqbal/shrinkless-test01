import Link from 'next/link';
import { readCartView } from '@/lib/cart-session';
import { CartLines } from '@/components/shop/CartLines';
import { formatCents } from '@/lib/money';
import { homeFonts } from '@/components/home/fonts';
import { CatalogueHead } from '@/components/pages/CatalogueHead';
import '@/components/shop/shop.css';

export const metadata = { title: 'Cart' };

/**
 * A ledger and a receipt, under the same chalk band every other shop page
 * opens on — the cart was the one page that started on a bare white sheet.
 *
 * The page was a stack: an eyebrow, a heading, a bordered list of lines, then
 * a summary card underneath them on anything narrower than a desk. Now the
 * count sits on the same rule as the title, the lines are the ledger, and the
 * receipt stays in view beside them while the ledger scrolls — so the figure
 * somebody is about to pay is never the thing they have to scroll to find.
 */
export default async function CartPage() {
  const cart = await readCartView();

  if (!cart || cart.lines.length === 0) {
    return (
      <>
        <CatalogueHead
          eyebrow="Cart"
          title="Nothing in it yet"
          lede="Garment dyed organic cotton, cut and sewn in the United States, and built to hold its shape wash after wash."
        />

        <div className={`sh-cart ${homeFonts}`}>
          <div className="sh-wrap">
            <div className="sh-cart__none">
              <Link href="/shop" className="sh-btn">Shop tees</Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  const count = cart.lines.reduce((total, line) => total + line.quantity, 0);

  return (
    <>
      <CatalogueHead eyebrow="Cart" title="Your cart" count={count} unit={['item', 'items']} />

      <div className={`sh-cart ${homeFonts}`}>
        <div className="sh-wrap">
          <div className="sh-cart__layout">
            <CartLines lines={cart.lines} />

            <aside className="sh-receipt" aria-labelledby="receipt-heading">
              <h2 id="receipt-heading" className="sh-label">Receipt</h2>

              <dl className="sh-receipt__rows">
                <dt>Subtotal</dt>
                <dd className="tnum">{formatCents(cart.subtotalCents)}</dd>
                <dt>Shipping</dt>
                <dd className="sh-receipt__pending">At checkout</dd>
                <dt>Tax</dt>
                <dd className="sh-receipt__pending">At checkout</dd>
              </dl>

              {/* Named "Due today" rather than "Total", because shipping and tax
                  are still to come and calling this the total would be a figure
                  the next page contradicts. */}
              <p className="sh-receipt__total">
                <span className="sh-label">Due today</span>
                <span className="sh-receipt__figure tnum">{formatCents(cart.subtotalCents)}</span>
              </p>

              <Link href="/checkout" className="sh-btn sh-btn--block">Checkout</Link>

              <Link href="/shop" className="sh-link sh-receipt__back">Keep shopping</Link>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
