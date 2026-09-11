import Link from 'next/link';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { ListControls, Pagination } from '@/components/admin/ListControls';
import { PageHead } from '@/components/admin/PageHead';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { requireAdminPage } from '@/lib/auth/guards';
import { formatCents } from '@/lib/money';
import { parseListParams } from '@/lib/admin/query';
import { ORDER_FILTERS, ORDER_SORTS, listOrdersPaged } from '@/lib/services/orders';
import type { OrderRowDTO } from '@/types/dto';

/**
 * Payment and fulfilment are one status on this store, so the row states it
 * once and lets the order number and the total carry the scan.
 */
const columns: Column<OrderRowDTO>[] = [
  {
    key: 'number',
    header: 'Order',
    cell: (row) => (
      <>
        <Link href={`/admin/orders/${row.id}`} className="prow__title">
          {row.orderNumber}
        </Link>
        <span className="prow__meta">
          {new Date(row.createdAt).toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      </>
    ),
  },
  { key: 'email', header: 'Customer', cell: (row) => row.email },
  { key: 'items', header: 'Items', numeric: true, cell: (row) => row.itemCount },
  { key: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
  {
    key: 'total',
    header: 'Total',
    numeric: true,
    cell: (row) => formatCents(row.totalCents),
  },
];

export default async function AdminOrdersPage(props: PageProps<'/admin/orders'>) {
  await requireAdminPage('orders:read');

  const params = parseListParams(await props.searchParams, {
    sorts: ORDER_SORTS,
    filters: ORDER_FILTERS,
  });

  const page = await listOrdersPaged(params);

  return (
    <>
      <PageHead
        title="Orders"
        sub="Newest first. Search covers order numbers, customer emails and any SKU on a packing slip."
      />

      <ListControls
        action="/admin/orders"
        params={params}
        searchPlaceholder="Order number, email or SKU"
        filters={[
          {
            name: 'status',
            label: 'Status',
            options: [
              { value: 'pending', label: 'Pending' },
              { value: 'paid', label: 'Paid' },
              { value: 'shipped', label: 'Shipped' },
              { value: 'delivered', label: 'Delivered' },
              { value: 'cancelled', label: 'Cancelled' },
              { value: 'payment_failed', label: 'Payment failed' },
            ],
          },
        ]}
        sorts={[
          { value: 'createdAt', label: 'Placed' },
          { value: 'totalCents', label: 'Total' },
          { value: 'orderNumber', label: 'Order number' },
          { value: 'status', label: 'Status' },
        ]}
      />

      <DataTable
        columns={columns}
        rows={page.rows}
        rowKey={(row) => row.id}
        empty={params.q ? `No orders match “${params.q}”` : 'No orders yet'}
        emptyBody={
          params.q
            ? 'Try an order number, a customer email, or a SKU from the packing slip.'
            : 'Orders arrive here the moment they are placed, with the status they need moving to next and the stock they have claimed.'
        }
      />

      <Pagination action="/admin/orders" page={page} />
    </>
  );
}
