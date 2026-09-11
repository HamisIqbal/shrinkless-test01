import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/admin/EmptyState';
import { NotesPanel } from '@/components/admin/NotesPanel';
import { PageHead } from '@/components/admin/PageHead';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { requireAdminPage } from '@/lib/auth/guards';
import { formatCents } from '@/lib/money';
import { getCustomerDetail } from '@/lib/services/users';
import { addCustomerNoteAction } from '@/app/actions/admin/customers';

/**
 * A profile, not a CRM record: the person's name leads, what they are worth to
 * the shop is stated once in ink, and their orders read as a history rather
 * than a data grid.
 */
export default async function AdminCustomerPage({ params }: PageProps<'/admin/customers/[id]'>) {
  await requireAdminPage('customers:read');

  const { id } = await params;
  const detail = await getCustomerDetail(id);
  if (!detail) notFound();

  const { customer, orders } = detail;
  const joined = customer.createdAt ? new Date(customer.createdAt) : null;

  return (
    <>
      <PageHead
        title={customer.name || customer.email}
        sub={customer.name ? customer.email : undefined}
        actions={
          <>
            {customer.role === 'admin' ? <StatusBadge status="admin" label="Admin" /> : null}
            <Link href="/admin/customers" className="abtn abtn--ghost">Directory</Link>
          </>
        }
      />

      <div className="adsplit">
        <div className="adsplit__col">
          <section className="panel panel--ink">
            <p className="alabel">Lifetime value</p>
            <p className="figure__value figure__value--lg">
              {formatCents(customer.lifetimeCents)}
            </p>
            <p className="figure__note">
              Across {customer.orderCount}{' '}
              {customer.orderCount === 1 ? 'order' : 'orders'} that earned money.
            </p>

            <dl className="figrow">
              <div>
                <dt>Average order</dt>
                <dd>{formatCents(customer.averageOrderCents)}</dd>
              </div>
              <div>
                <dt>Joined</dt>
                <dd style={{ fontSize: 'var(--ad-t-small)', fontWeight: 400 }}>
                  {joined
                    ? joined.toLocaleDateString('en-US', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Last order</dt>
                <dd style={{ fontSize: 'var(--ad-t-small)', fontWeight: 400 }}>
                  {customer.lastOrderAt
                    ? new Date(customer.lastOrderAt).toLocaleDateString('en-US', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Never'}
                </dd>
              </div>
            </dl>
          </section>

          <section className="panel">
            <p className="alabel">Order history</p>

            {orders.length ? (
              <ul className="stack">
                {orders.map((order) => (
                  <li key={order.id}>
                    <span className="stack__main">
                      <Link href={`/admin/orders/${order.id}`} className="stack__title">
                        {order.orderNumber}
                      </Link>
                      <span className="stack__meta">
                        {new Date(order.createdAt).toLocaleDateString('en-US', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}{' '}
                        · {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
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
                body="This account exists but has not bought anything. Orders appear here newest first as they are placed."
              />
            )}
          </section>
        </div>

        <div className="adsplit__col">
          {customer.addresses.length ? (
            <section className="panel">
              <p className="alabel">Addresses</p>

              {customer.addresses.map((address, index) => (
                <address className="aaddress" key={index} style={{ marginBottom: '1rem' }}>
                  <strong>{address.name}</strong>
                  {address.line1}
                  <br />
                  {address.line2 ? (
                    <>
                      {address.line2}
                      <br />
                    </>
                  ) : null}
                  {address.city}, {address.state} {address.postalCode}
                  <br />
                  {address.country}
                </address>
              ))}
            </section>
          ) : null}

          <NotesPanel
            id={customer.id}
            notes={customer.notes}
            action={addCustomerNoteAction}
            heading="Internal notes"
          />
        </div>
      </div>
    </>
  );
}
