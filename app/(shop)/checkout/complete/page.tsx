import Link from 'next/link';
import { findConfirmedOrder } from '@/lib/services/checkout';
import { formatCents } from '@/lib/money';

export const metadata = { title: 'Order confirmed' };

/** Every arrival here is about one specific payment, so there is nothing to
 *  cache and nothing that would be right for the next shopper. */
export const dynamic = 'force-dynamic';

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

/**
 * Where Stripe sends a shopper back to.
 *
 * Both the card path (`redirect: 'if_required'`, which never leaves the page)
 * and the wallet and bank paths (which do) land here with the intent id and
 * its client secret. The secret is what authorises the page — a guest has no
 * session, so it is the only thing that proves whose order this is.
 *
 * The order may still read `pending`: the webhook is what marks it paid, and
 * it can easily arrive after the shopper does. That is said plainly rather
 * than papered over with a spinner that would be lying about what it is
 * waiting for.
 */
export default async function CheckoutCompletePage(
  props: PageProps<'/checkout/complete'>,
) {
  const params = await props.searchParams;

  const order = await findConfirmedOrder(
    first(params.payment_intent),
    first(params.payment_intent_client_secret),
  );

  if (!order) {
    return (
      <div className="band band--tight wrap cartpage">
        <p className="eyebrow">Checkout</p>
        <h1 className="head cartpage__head">We cannot find that order.</h1>
        <p className="lede confirm__note">
          If you were charged, the confirmation email is the record — nothing is
          lost. Write to us and we will find it.
        </p>
        <Link href="/shop" className="btn btn--lg cartpage__cta">Back to the shop</Link>
      </div>
    );
  }

  const settled = order.status !== 'pending' && order.status !== 'payment_failed';
  const failed = order.status === 'payment_failed';

  return (
    <div className="band band--tight wrap confirm">
      <p className="eyebrow">Checkout</p>

      <h1 className="head confirm__head">
        {failed ? 'That payment did not go through.' : 'Thank you. It’s yours.'}
      </h1>

      <p className="lede confirm__note">
        {failed
          ? 'Nothing has been charged and nothing has shipped. Your cart is still where you left it.'
          : settled
            ? `A receipt is on its way to ${order.email}. We pack and ship within two working days.`
            : `Payment received. We are confirming it with the bank — the receipt to ${order.email} follows the moment that clears.`}
      </p>

      <dl className="confirm__facts">
        <dt>Order</dt>
        <dd className="anum">{order.orderNumber}</dd>
        <dt>Total</dt>
        <dd className="tnum">{formatCents(order.totalCents)}</dd>
        <dt>Shipping to</dt>
        <dd>
          {order.shippingName}
          {order.shippingCity ? ` — ${order.shippingCity}, ${order.shippingState}` : ''}
        </dd>
      </dl>

      <hr className="rule confirm__rule" />

      <ul className="confirm__items">
        {order.items.map((item, index) => (
          <li key={`${item.title}-${item.size}-${index}`} className="confirm__item">
            <span className="confirm__itemname">{item.title}</span>
            <span className="confirm__itemspec">
              {item.color} / {item.size.toUpperCase()} × {item.quantity}
            </span>
          </li>
        ))}
      </ul>

      <div className="confirm__actions">
        <Link href="/shop" className="btn btn--lg">Keep shopping</Link>
        <Link href="/account" className="ulink">Your orders</Link>
      </div>
    </div>
  );
}
