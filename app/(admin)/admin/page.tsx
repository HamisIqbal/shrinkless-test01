import Link from 'next/link';
import { EmptyState } from '@/components/admin/EmptyState';
import { PageHead } from '@/components/admin/PageHead';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { requireAdminPage } from '@/lib/auth/guards';
import { formatCents } from '@/lib/money';
import { getAdminStats } from '@/lib/services/stats';

/**
 * An operational overview, not an analytics page.
 *
 * The composition is deliberately uneven: revenue takes the wide block because
 * it is the number the day is judged on, today's takings sit beside it in ink
 * because they are the number that changes hourly, and the two lists below are
 * sized by how often they are acted on rather than by how much they contain.
 *
 * Anything wanting a person today — orders awaiting payment, stock running out
 * — is the only thing on this page allowed to carry the acid.
 */
export default async function AdminDashboardPage() {
  const actor = await requireAdminPage('dashboard:read');

  const stats = await getAdminStats();
  const firstName = actor.name?.split(' ')[0];

  return (
    <>
      <PageHead
        title={firstName ? `Good day, ${firstName}` : 'The floor today'}
        sub="Everything that wants a decision, in the order it wants one."
        actions={
          <>
            <Link href="/admin/orders" className="abtn abtn--ghost">Orders</Link>
            <Link href="/admin/products/new" className="abtn">New product</Link>
          </>
        }
      />

      <div className="dash">
        <section className="panel dash__revenue">
          <p className="alabel">Revenue</p>

          <p className="figure__value figure__value--lg">
            {formatCents(stats.revenueMonthCents)}
          </p>
          <p className="figure__note">
            This month, across paid, shipped and delivered orders.
          </p>

          <dl className="figrow">
            <div>
              <dt>Last 7 days</dt>
              <dd>{formatCents(stats.revenueWeekCents)}</dd>
            </div>
            <div>
              <dt>All time</dt>
              <dd>{formatCents(stats.revenueTotalCents)}</dd>
            </div>
            <div>
              <dt>Average order</dt>
              <dd>{formatCents(stats.averageOrderCents)}</dd>
            </div>
          </dl>
        </section>

        <section className="panel panel--ink dash__today">
          <p className="alabel">Today</p>

          <p className="figure__value">{formatCents(stats.revenueTodayCents)}</p>
          <p className="figure__note">
            {stats.ordersToday} {stats.ordersToday === 1 ? 'order' : 'orders'} placed
            since midnight.
          </p>

          <dl className="figrow">
            <div>
              <dt>Awaiting payment</dt>
              <dd>{stats.ordersPending}</dd>
            </div>
            <div>
              <dt>Delivered</dt>
              <dd>{stats.ordersCompleted}</dd>
            </div>
          </dl>
        </section>

        <section className="panel dash__orders">
          <div className="panel__head">
            <p className="alabel">Order book</p>
            <Link href="/admin/orders" className="abtn abtn--quiet abtn--sm">All orders</Link>
          </div>

          <p className="figure__value">{stats.ordersTotal}</p>
          <p className="figure__note">Orders placed, all time.</p>

          <dl className="figrow">
            <div>
              <dt>Pending</dt>
              <dd>{stats.ordersPending}</dd>
            </div>
            <div>
              <dt>Cancelled</dt>
              <dd>{stats.ordersCancelled}</dd>
            </div>
          </dl>
        </section>

        <section
          className={`panel dash__stock${stats.outOfStockCount > 0 ? ' panel--acid' : ''}`}
        >
          <div className="panel__head">
            <p className="alabel">Stock needing attention</p>
            <Link href="/admin/inventory" className="abtn abtn--quiet abtn--sm">Inventory</Link>
          </div>

          {stats.lowStock.length ? (
            <>
              <p className="figure__note" style={{ marginTop: 0 }}>
                {stats.outOfStockCount} out of stock, {stats.lowStockCount} running low.
              </p>

              <ul className="stack">
                {stats.lowStock.slice(0, 5).map((row) => (
                  <li key={row.sku}>
                    <span className="stack__main">
                      <span className="stack__title">{row.title}</span>
                      <span className="stack__meta">
                        {row.size.toUpperCase()} · {row.color} · {row.sku}
                      </span>
                    </span>
                    <span className="stack__value">
                      {row.stock === 0 ? 'None left' : `${row.stock} left`}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState
              title="Every size is covered"
              body="Variants appear here as they approach their low-stock threshold, so a size runs out in the panel before it runs out on the shelf."
            />
          )}
        </section>

        <section className="panel dash__recent">
          <div className="panel__head">
            <p className="alabel">Latest orders</p>
            <Link href="/admin/orders" className="abtn abtn--quiet abtn--sm">All orders</Link>
          </div>

          {stats.recentOrders.length ? (
            <ul className="stack">
              {stats.recentOrders.map((order) => (
                <li key={order.id}>
                  <span className="stack__main">
                    <Link href={`/admin/orders/${order.id}`} className="stack__title">
                      {order.orderNumber}
                    </Link>
                    <span className="stack__meta">
                      {order.email} · {order.itemCount}{' '}
                      {order.itemCount === 1 ? 'item' : 'items'}
                    </span>
                  </span>
                  <span className="stack__value">
                    <StatusBadge status={order.status} />{' '}
                    <span className="anum">{formatCents(order.totalCents)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No orders yet"
              body="The moment one is placed it lands here, newest first, with the status it needs moving to next."
            />
          )}
        </section>

        <section className="panel dash__people">
          <div className="panel__head">
            <p className="alabel">Customers</p>
            <Link href="/admin/customers" className="abtn abtn--quiet abtn--sm">Directory</Link>
          </div>

          <p className="figure__value">{stats.customersTotal}</p>
          <p className="figure__note">
            {stats.customersNewThisMonth} joined this month.
          </p>

          {stats.bestSellers.length ? (
            <>
              <p className="alabel" style={{ marginTop: 'var(--ad-s-4)' }}>Selling best</p>
              <ul className="stack">
                {stats.bestSellers.slice(0, 3).map((row) => (
                  <li key={row.title}>
                    <span className="stack__main">
                      <span className="stack__title">{row.title}</span>
                      <span className="stack__meta">{row.unitsSold} sold</span>
                    </span>
                    <span className="stack__value">{formatCents(row.revenueCents)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      </div>
    </>
  );
}
