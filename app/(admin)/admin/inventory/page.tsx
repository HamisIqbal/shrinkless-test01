import Link from 'next/link';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { ListControls, Pagination } from '@/components/admin/ListControls';
import { PageHead } from '@/components/admin/PageHead';
import { StockCell } from '@/components/admin/StockCell';
import { requireAdminPage } from '@/lib/auth/guards';
import { parseListParams } from '@/lib/admin/query';
import {
  INVENTORY_FILTERS,
  INVENTORY_SORTS,
  countStockStates,
  listInventory,
} from '@/lib/services/inventory';
import type { InventoryRowDTO } from '@/types/dto';

const STATE_LABEL: Record<InventoryRowDTO['state'], string> = {
  in_stock: 'In stock',
  low: 'Low',
  out: 'Out',
};

/**
 * A short bar under the count. Across sixty rows a number tells you the level
 * and a bar tells you the shape of the whole shelf, which is the question
 * someone opening this page is actually asking.
 *
 * Scaled against four times the threshold so "healthy" fills most of the track
 * and "low" is visibly short, without pretending to a precision it does not
 * have.
 */
function Level({ stock, threshold }: { stock: number; threshold: number }) {
  const ceiling = Math.max(threshold * 4, 1);
  const width = Math.min(100, Math.round((stock / ceiling) * 100));
  const state = stock <= 0 ? 'out' : stock <= threshold ? 'low' : 'in';

  return (
    <span className={`level level--${state}`} aria-hidden="true">
      <span className="level__fill" style={{ width: `${width}%` }} />
    </span>
  );
}

const columns: Column<InventoryRowDTO>[] = [
  {
    key: 'sku',
    header: 'Variant',
    cell: (row) => (
      <>
        <Link href={`/admin/inventory/${row.variantId}`} className="prow__title">
          {row.productTitle}
        </Link>
        <span className="prow__meta">
          {row.size.toUpperCase()} · {row.color} · {row.sku}
        </span>
      </>
    ),
  },
  {
    key: 'state',
    header: 'State',
    cell: (row) => (
      <>
        <span
          className={`pill pill--${row.state === 'out' ? 'attention' : row.state === 'low' ? 'off' : 'on'}`}
        >
          {STATE_LABEL[row.state]}
        </span>
        <span className="prow__meta">Low at {row.threshold}</span>
      </>
    ),
  },
  {
    key: 'level',
    header: 'Level',
    cell: (row) => <Level stock={row.stock} threshold={row.threshold} />,
  },
  {
    key: 'stock',
    header: 'On hand',
    actions: true,
    cell: (row) => <StockCell variantId={row.variantId} stock={row.stock} sku={row.sku} />,
  },
];

export default async function AdminInventoryPage(props: PageProps<'/admin/inventory'>) {
  await requireAdminPage('inventory:read');

  const params = parseListParams(await props.searchParams, {
    sorts: INVENTORY_SORTS,
    filters: INVENTORY_FILTERS,
    defaultDirection: 'asc',
  });

  const [page, counts] = await Promise.all([listInventory(params), countStockStates()]);

  return (
    <>
      <PageHead
        title="Inventory"
        sub="Every movement is recorded against the variant. Open a row for its full history."
      />

      {counts.out > 0 || counts.low > 0 ? (
        <p className={`anotice${counts.out > 0 ? ' anotice--alert' : ''}`}>
          {counts.out > 0
            ? `${counts.out} ${counts.out === 1 ? 'variant is' : 'variants are'} out of stock`
            : `${counts.low} ${counts.low === 1 ? 'variant is' : 'variants are'} running low`}
          {counts.out > 0 && counts.low > 0 ? `, and ${counts.low} more running low.` : '.'}
        </p>
      ) : null}

      <ListControls
        action="/admin/inventory"
        params={params}
        searchPlaceholder="SKU"
        filters={[
          {
            name: 'state',
            label: 'State',
            options: [
              { value: 'out', label: 'Out of stock' },
              { value: 'low', label: 'Low' },
              { value: 'in_stock', label: 'In stock' },
            ],
          },
        ]}
        sorts={[
          { value: 'stock', label: 'Stock' },
          { value: 'sku', label: 'SKU' },
          { value: 'updatedAt', label: 'Last changed' },
        ]}
      />

      <DataTable
        columns={columns}
        rows={page.rows}
        rowKey={(row) => row.variantId}
        empty={params.q ? `No SKU matches “${params.q}”` : 'Nothing to count yet'}
        emptyBody={
          params.q
            ? 'Search matches on SKU. Clear the filters to see every variant.'
            : 'Variants appear here as soon as a product has sizes and colours. Adjustments made here are recorded against the person who made them.'
        }
      />

      <Pagination action="/admin/inventory" page={page} />
    </>
  );
}
