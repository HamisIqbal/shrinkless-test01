import Link from 'next/link';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { ListControls, Pagination } from '@/components/admin/ListControls';
import { PageHead } from '@/components/admin/PageHead';
import { requireAdminPage } from '@/lib/auth/guards';
import { formatCents } from '@/lib/money';
import { parseListParams } from '@/lib/admin/query';
import { PAYMENT_FILTERS, PAYMENT_SORTS, listPaymentsPaged } from '@/lib/services/orders';
import type { PaymentDTO } from '@/types/dto';

type Row = PaymentDTO & { orderNumber: string; email: string };

/**
 * Payments, read-only.
 *
 * There is nothing to act on here by design: payment rows are written by a
 * provider's webhook and by nothing else, so this is a ledger to consult
 * rather than a screen to work in. Card metadata is a brand and four digits —
 * nothing on this page could be used to charge anything.
 */
const columns: Column<Row>[] = [
  {
    key: 'order',
    header: 'Order',
    cell: (row) => (
      <>
        <Link href={`/admin/orders/${row.orderId}`} className="prow__title">
          {row.orderNumber}
        </Link>
        <span className="prow__meta">{row.email}</span>
      </>
    ),
  },
  {
    key: 'method',
    header: 'Method',
    cell: (row) => (
      <>
        {row.brand ? `${row.brand} ····${row.last4}` : row.provider}
        <span className="prow__meta">{row.provider}</span>
      </>
    ),
  },
  { key: 'status', header: 'Status', cell: (row) => row.status },
  {
    key: 'reference',
    header: 'Reference',
    cell: (row) => <span className="anum">{row.providerPaymentId}</span>,
  },
  {
    key: 'at',
    header: 'Date',
    numeric: true,
    cell: (row) =>
      new Date(row.at).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
  },
  {
    key: 'amount',
    header: 'Amount',
    numeric: true,
    cell: (row) => formatCents(row.amountCents),
  },
];

export default async function AdminPaymentsPage(props: PageProps<'/admin/payments'>) {
  await requireAdminPage('payments:read');

  const params = parseListParams(await props.searchParams, {
    sorts: PAYMENT_SORTS,
    filters: PAYMENT_FILTERS,
  });

  const page = await listPaymentsPaged(params);

  return (
    <>
      <PageHead
        title="Payments"
        sub="Every transaction recorded against an order, with its provider reference. Read-only — payment records are written by the provider, never here."
      />

      <ListControls
        action="/admin/payments"
        params={params}
        searchPlaceholder="Provider reference"
        filters={[
          {
            name: 'provider',
            label: 'Provider',
            options: [
              { value: 'stripe', label: 'Stripe' },
              { value: 'paypal', label: 'PayPal' },
            ],
          },
        ]}
        sorts={[
          { value: 'createdAt', label: 'Date' },
          { value: 'amountCents', label: 'Amount' },
        ]}
      />

      <DataTable
        columns={columns}
        rows={page.rows}
        rowKey={(row) => row.id}
        empty="No payments recorded"
        emptyBody="Transactions land here when a payment provider's webhook confirms them. None is connected to this store yet, so the ledger is empty rather than broken."
      />

      <Pagination action="/admin/payments" page={page} />
    </>
  );
}
