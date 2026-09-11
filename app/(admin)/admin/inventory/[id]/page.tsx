import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Types } from 'mongoose';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { Pagination } from '@/components/admin/ListControls';
import { PageHead } from '@/components/admin/PageHead';
import { StockTakePanel } from '@/components/admin/StockTakePanel';
import { requireAdminPage } from '@/lib/auth/guards';
import { parseListParams } from '@/lib/admin/query';
import { connectToDatabase } from '@/lib/db/connection';
import { Variant } from '@/lib/db/models/variant';
import { Product } from '@/lib/db/models/product';
import { defaultLowStockThreshold, listAdjustments, stockStateFor } from '@/lib/services/inventory';
import type { InventoryAdjustmentDTO } from '@/types/dto';

const columns: Column<InventoryAdjustmentDTO>[] = [
  {
    key: 'at',
    header: 'When',
    cell: (row) => (
      <>
        {new Date(row.at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
        <span className="prow__meta">
          {new Date(row.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </span>
      </>
    ),
  },
  { key: 'reason', header: 'Reason', cell: (row) => row.reason },
  {
    key: 'note',
    header: 'Note',
    cell: (row) =>
      row.orderId ? (
        <Link href={`/admin/orders/${row.orderId}`}>{row.note || 'Order'}</Link>
      ) : (
        row.note || '—'
      ),
  },
  { key: 'who', header: 'By', cell: (row) => row.actorEmail },
  {
    key: 'delta',
    header: 'Change',
    numeric: true,
    cell: (row) => (row.delta > 0 ? `+${row.delta}` : String(row.delta)),
  },
  { key: 'result', header: 'Left', numeric: true, cell: (row) => row.resultingStock },
];

export default async function AdminVariantPage(props: PageProps<'/admin/inventory/[id]'>) {
  await requireAdminPage('inventory:read');

  const { id } = await props.params;
  if (!Types.ObjectId.isValid(id)) notFound();

  await connectToDatabase();

  const variant = await Variant.findById(id).lean();
  if (!variant) notFound();

  const [product, threshold, page] = await Promise.all([
    Product.findById(variant.productId).select('title').lean(),
    defaultLowStockThreshold(),
    listAdjustments(
      id,
      parseListParams(await props.searchParams, { sorts: ['createdAt'], filters: [] }),
    ),
  ]);

  const effective = variant.lowStockThreshold ?? threshold;
  const state = stockStateFor(variant.stock, effective);

  return (
    <>
      <PageHead
        title={product?.title ?? 'Unknown product'}
        sub={`${variant.size.toUpperCase()} · ${variant.color} · ${variant.sku}`}
        actions={
          <Link
            href={`/admin/products/${String(variant.productId)}`}
            className="abtn abtn--ghost"
          >
            Edit product
          </Link>
        }
      />

      <div className="adsplit">
        <div className="adsplit__col">
          <section className="panel panel--ink">
            <p className="alabel">On hand</p>
            <p className="figure__value figure__value--lg">{variant.stock}</p>
            <p className="figure__note">
              {state === 'out'
                ? 'Nothing left on the shelf. The storefront shows this size as sold out.'
                : state === 'low'
                  ? `At or below the low-stock threshold of ${effective}.`
                  : `Comfortably above the low-stock threshold of ${effective}.`}
            </p>

            <dl className="figrow">
              <div>
                <dt>Low at</dt>
                <dd>{effective}</dd>
              </div>
              <div>
                <dt>Threshold</dt>
                <dd style={{ fontSize: 'var(--ad-t-small)', fontWeight: 400 }}>
                  {variant.lowStockThreshold === null ? 'Store default' : 'Override'}
                </dd>
              </div>
            </dl>
          </section>

          <StockTakePanel
            variantId={String(variant._id)}
            stock={variant.stock}
            threshold={variant.lowStockThreshold ?? null}
          />
        </div>

        <div className="adsplit__col">
          <section className="panel panel--outline">
            <p className="alabel">How stock moves</p>
            <p className="aquiet">
              Orders take stock when they are marked paid and return it if they are
              cancelled. Everything else — deliveries, corrections, damage — is
              recorded by the person who entered it.
            </p>
          </section>
        </div>
      </div>

      <section className="apage__section">
        <p className="alabel">Movement history</p>

        <DataTable
          columns={columns}
          rows={page.rows}
          rowKey={(row) => row.id}
          empty="No movements yet"
          emptyBody="Every adjustment, sale and return is recorded here with its reason and the person behind it."
        />

        <Pagination action={`/admin/inventory/${id}`} page={page} />
      </section>
    </>
  );
}
