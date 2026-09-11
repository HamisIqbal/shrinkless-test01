import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FulfillmentPanel } from '@/components/admin/FulfillmentPanel';
import { NotesPanel } from '@/components/admin/NotesPanel';
import { PageHead } from '@/components/admin/PageHead';
import { RefundPanel } from '@/components/admin/RefundPanel';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { requireAdminPage } from '@/lib/auth/guards';
import { formatCents } from '@/lib/money';
import { getOrderById } from '@/lib/services/orders';
import { addOrderNoteAction } from '@/app/actions/admin/orders';

/**
 * One order, as modular panels: what was bought, who bought it, what it cost,
 * where it goes, and what has happened to it. The operational controls sit in
 * the narrower right column so the left stays a readable record.
 */
export default async function AdminOrderPage({ params }: PageProps<'/admin/orders/[id]'>) {
  await requireAdminPage('orders:read');

  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();

  const refundable = order.totalCents - order.refundedCents;
  const placed = new Date(order.createdAt);

  return (
    <>
      <PageHead
        title={order.orderNumber}
        sub={
          <>
            Placed{' '}
            {placed.toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}{' '}
            · {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
          </>
        }
        actions={
          <>
            <StatusBadge status={order.status} />
            <Link href="/admin/orders" className="abtn abtn--ghost">All orders</Link>
          </>
        }
      />

      <div className="adsplit">
        <div className="adsplit__col">
          <section className="panel">
            <p className="alabel">Items</p>

            <ul className="items">
              {order.items.map((item) => (
                <li key={item.sku}>
                  <span>
                    <span className="items__name">{item.title}</span>
                    <span className="items__spec">
                      {item.size.toUpperCase()} · {item.color} · {item.sku} ×{' '}
                      {item.quantity}
                    </span>
                  </span>
                  <span className="items__price anum">
                    {formatCents(item.unitPriceCents * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <p className="alabel">Totals</p>

            <dl className="adlist">
              <div>
                <dt>Subtotal</dt>
                <dd>{formatCents(order.subtotalCents)}</dd>
              </div>

              {order.discountCents > 0 ? (
                <div>
                  <dt>Discount{order.discountCode ? ` · ${order.discountCode}` : ''}</dt>
                  <dd>−{formatCents(order.discountCents)}</dd>
                </div>
              ) : null}

              <div>
                <dt>Shipping{order.shippingMethodName ? ` · ${order.shippingMethodName}` : ''}</dt>
                <dd>{formatCents(order.shippingCents)}</dd>
              </div>

              <div>
                <dt>Tax</dt>
                <dd>{formatCents(order.taxCents)}</dd>
              </div>

              <div className="adlist__total">
                <dt>Total</dt>
                <dd>{formatCents(order.totalCents)}</dd>
              </div>

              {order.refundedCents > 0 ? (
                <div>
                  <dt>Refunded</dt>
                  <dd>−{formatCents(order.refundedCents)}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="panel">
            <p className="alabel">Payment</p>

            {order.payments.length ? (
              <ul className="stack">
                {order.payments.map((payment) => (
                  <li key={payment.id}>
                    <span className="stack__main">
                      <span className="stack__title">
                        {payment.provider} · {payment.status}
                      </span>
                      <span className="stack__meta">
                        {payment.brand ? `${payment.brand} ····${payment.last4} · ` : ''}
                        {payment.providerPaymentId}
                      </span>
                    </span>
                    <span className="stack__value">{formatCents(payment.amountCents)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="aquiet">
                No payment recorded. Payment rows are written by the provider&rsquo;s
                webhook, and none is connected to this store yet.
              </p>
            )}
          </section>

          <section className="panel">
            <p className="alabel">Timeline</p>

            <ol className="timeline">
              {[...order.statusHistory].reverse().map((event, index) => (
                <li key={`${event.status}-${index}`}>
                  <span className="timeline__what">{event.status.replace(/_/g, ' ')}</span>
                  <span className="timeline__meta">
                    {new Date(event.at).toLocaleString('en-US', {
                      day: 'numeric',
                      month: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}{' '}
                    · {event.actor}
                  </span>
                  {event.note ? <p className="timeline__note">{event.note}</p> : null}
                </li>
              ))}

              <li>
                <span className="timeline__what">Order placed</span>
                <span className="timeline__meta">
                  {placed.toLocaleString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </li>
            </ol>
          </section>
        </div>

        <div className="adsplit__col">
          <FulfillmentPanel
            orderId={order.id}
            status={order.status}
            trackingNumber={order.trackingNumber}
            allowed={order.allowedTransitions}
          />

          <section className="panel">
            <p className="alabel">Customer</p>

            <p className="items__name">
              {order.userId ? (
                <Link href={`/admin/customers/${order.userId}`}>{order.email}</Link>
              ) : (
                order.email
              )}
            </p>
            <p className="aquiet">
              {order.userId ? 'Has an account' : 'Guest checkout'}
            </p>
          </section>

          <section className="panel">
            <p className="alabel">Ship to</p>

            <address className="aaddress">
              <strong>{order.shippingAddress.name}</strong>
              {order.shippingAddress.line1}
              <br />
              {order.shippingAddress.line2 ? (
                <>
                  {order.shippingAddress.line2}
                  <br />
                </>
              ) : null}
              {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
              {order.shippingAddress.postalCode}
              <br />
              {order.shippingAddress.country}
              {order.trackingNumber ? (
                <>
                  <br />
                  <br />
                  Tracking: {order.trackingNumber}
                </>
              ) : null}
            </address>
          </section>

          <RefundPanel
            orderId={order.id}
            refundableCents={refundable}
            status={order.status}
          />

          <NotesPanel id={order.id} notes={order.notes} action={addOrderNoteAction} />
        </div>
      </div>
    </>
  );
}
