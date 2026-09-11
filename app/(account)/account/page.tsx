import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { isAdminSession } from '@/lib/auth/guards';
import { LogoutButton } from '@/components/account/LogoutButton';
import { formatCents } from '@/lib/money';
import { listOrdersForUser } from '@/lib/services/orders';

export const metadata = { title: 'Your account' };

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const orders = await listOrdersForUser(session.user.id ?? '');

  return (
    <div>
      <header className="pagehead">
        <p className="eyebrow">Account</p>
        <h1 className="head">{session.user.name || 'Your account'}</h1>
      </header>

      <dl className="deflist">
        <dt>Name</dt>
        <dd>{session.user.name || 'Not set'}</dd>
        <dt>Email</dt>
        <dd>{session.user.email}</dd>
      </dl>

      <section aria-labelledby="orders-heading" className="spread">
        <p className="spread__label" id="orders-heading">Orders</p>

        <div className="spread__body">
          {orders.length === 0 ? (
            <p className="lede">No orders yet. When you place one, it shows up here.</p>
          ) : (
            <ul className="orderlist">
              {orders.map((order) => (
                <li key={order.id} className="orderlist__row">
                  <span className="orderlist__num tnum">{order.orderNumber}</span>
                  <span className="meta">{order.status.replace('_', ' ')}</span>
                  <span className="meta tnum">
                    {new Date(order.createdAt).toLocaleDateString('en-US')}
                  </span>
                  <span className="price tnum">{formatCents(order.totalCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="accountfoot">
        <Link href="/shop" className="btn">Shop all</Link>
        {isAdminSession(session) ? (
          <Link href="/admin" className="btn">Admin panel</Link>
        ) : null}
        <LogoutButton />
      </div>
    </div>
  );
}
