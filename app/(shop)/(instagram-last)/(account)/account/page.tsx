import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { isAdminSession } from '@/lib/auth/guards';
import { LogoutButton } from '@/components/account/LogoutButton';
import { CatalogueHead } from '@/components/pages/CatalogueHead';
import { homeFonts } from '@/components/home/fonts';
import { formatCents } from '@/lib/money';
import { listOrdersForUser } from '@/lib/services/orders';
import '@/components/shop/shop.css';

export const metadata = { title: 'Your account' };

/**
 * The account, laid out the way the cart is: the orders as the ledger, and the
 * details and the ways out in the chalk panel beside it — so the two pages a
 * customer moves between read as one shop rather than two.
 */
export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const orders = await listOrdersForUser(session.user.id ?? '');

  return (
    <>
      <CatalogueHead
        eyebrow="Account"
        title={session.user.name || 'Your account'}
        lede={session.user.email ?? undefined}
        count={orders.length}
        unit={['order', 'orders']}
      />

      <div className={`sh-account ${homeFonts}`}>
        <div className="sh-wrap sh-account__layout">
          <section className="sh-account__section" aria-labelledby="orders-heading">
            <h2 id="orders-heading" className="sh-label">Orders</h2>

            {orders.length === 0 ? (
              <div className="sh-account__none">
                <p className="sh-body">No orders yet. When you place one, it shows up here.</p>
                <Link href="/shop" className="sh-btn">Shop tees</Link>
              </div>
            ) : (
              <ul className="sh-orders">
                {orders.map((order) => (
                  <li key={order.id} className="sh-order">
                    <span className="sh-order__num tnum">{order.orderNumber}</span>
                    <span className="sh-order__total tnum">{formatCents(order.totalCents)}</span>
                    <span className="sh-order__meta">
                      <span className="sh-order__status">{order.status.replace('_', ' ')}</span>
                      <span className="tnum">
                        {new Date(order.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="sh-receipt" aria-labelledby="details-heading">
            <h2 id="details-heading" className="sh-label">Details</h2>

            <dl className="sh-receipt__rows">
              <dt>Name</dt>
              <dd>{session.user.name || 'Not set'}</dd>
              <dt>Email</dt>
              <dd>{session.user.email}</dd>
            </dl>

            <div className="sh-account__acts">
              <Link href="/shop" className="sh-btn sh-btn--block">Shop all</Link>
              {isAdminSession(session) ? (
                <Link href="/admin" className="sh-btn sh-btn--ghost sh-btn--block">Admin panel</Link>
              ) : null}
              <LogoutButton />
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
