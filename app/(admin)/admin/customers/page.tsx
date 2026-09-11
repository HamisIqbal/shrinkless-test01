import Link from 'next/link';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { ListControls, Pagination } from '@/components/admin/ListControls';
import { PageHead } from '@/components/admin/PageHead';
import { requireAdminPage } from '@/lib/auth/guards';
import { formatCents } from '@/lib/money';
import { parseListParams } from '@/lib/admin/query';
import { CUSTOMER_FILTERS, CUSTOMER_SORTS, listCustomersPaged } from '@/lib/services/users';
import type { CustomerRowDTO } from '@/types/dto';

const columns: Column<CustomerRowDTO>[] = [
  {
    key: 'email',
    header: 'Customer',
    cell: (row) => (
      <>
        <Link href={`/admin/customers/${row.id}`} className="prow__title">
          {row.name || row.email}
        </Link>
        <span className="prow__meta">{row.name ? row.email : row.role}</span>
      </>
    ),
  },
  { key: 'orders', header: 'Orders', numeric: true, cell: (row) => row.orderCount },
  {
    key: 'lifetime',
    header: 'Lifetime',
    numeric: true,
    cell: (row) => formatCents(row.lifetimeCents),
  },
  {
    key: 'last',
    header: 'Last order',
    numeric: true,
    cell: (row) =>
      row.lastOrderAt
        ? new Date(row.lastOrderAt).toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : '—',
  },
];

export default async function AdminCustomersPage(props: PageProps<'/admin/customers'>) {
  await requireAdminPage('customers:read');

  const params = parseListParams(await props.searchParams, {
    sorts: CUSTOMER_SORTS,
    filters: CUSTOMER_FILTERS,
  });

  const page = await listCustomersPaged(params);

  return (
    <>
      <PageHead
        title="Customers"
        sub="Everyone with an account, what they have spent, and when they last ordered."
      />

      <ListControls
        action="/admin/customers"
        params={params}
        searchPlaceholder="Email or name"
        filters={[
          {
            name: 'role',
            label: 'Role',
            options: [
              { value: 'customer', label: 'Customers' },
              { value: 'admin', label: 'Admins' },
            ],
          },
          {
            name: 'hasOrders',
            label: 'Ordered',
            options: [{ value: 'true', label: 'Has ordered' }],
          },
        ]}
        sorts={[
          { value: 'createdAt', label: 'Joined' },
          { value: 'email', label: 'Email' },
          { value: 'name', label: 'Name' },
        ]}
      />

      <DataTable
        columns={columns}
        rows={page.rows}
        rowKey={(row) => row.id}
        empty={params.q ? `No customers match “${params.q}”` : 'No customers yet'}
        emptyBody={
          params.q
            ? 'Search covers names and email addresses.'
            : 'An account appears here as soon as someone registers, and fills in with their orders as they buy.'
        }
      />

      <Pagination action="/admin/customers" page={page} />
    </>
  );
}
