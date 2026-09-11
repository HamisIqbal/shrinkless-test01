import Link from 'next/link';
import { BulkStockPanel } from '@/components/admin/BulkStockPanel';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { ListControls, Pagination } from '@/components/admin/ListControls';
import { PageHead } from '@/components/admin/PageHead';
import { ProductRowActions } from '@/components/admin/ProductRowActions';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { requireAdminPage } from '@/lib/auth/guards';
import { cloudinaryUrl } from '@/lib/cloudinary/url';
import { formatCents } from '@/lib/money';
import { parseListParams } from '@/lib/admin/query';
import {
  PRODUCT_FILTERS,
  PRODUCT_SORTS,
  listProductsForAdmin,
  listUsedCategorySlugs,
} from '@/lib/services/products';
import type { AdminProductRowDTO } from '@/types/dto';

/**
 * The product list of a clothing brand should look like clothes, so the
 * thumbnail leads and the row is tall enough to let it. Everything else on the
 * row is set quietly around it.
 */
const columns: Column<AdminProductRowDTO>[] = [
  {
    key: 'title',
    header: 'Product',
    cell: (row) => (
      <span className="prow">
        {row.imagePublicId ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            className="prow__thumb"
            src={cloudinaryUrl(row.imagePublicId, 'w_130,h_162,c_fill,q_auto,f_auto')}
            alt=""
            width={65}
            height={81}
            loading="lazy"
          />
        ) : (
          <span className="prow__thumb prow__thumb--empty" aria-hidden="true">
            No image
          </span>
        )}

        <span>
          <Link href={`/admin/products/${row.id}`} className="prow__title">
            {row.title}
          </Link>
          <span className="prow__meta">
            {row.category} · {row.slug}
          </span>
        </span>
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    cell: (row) => <StatusBadge status={row.archived ? 'archived' : row.status} />,
  },
  {
    key: 'stock',
    header: 'Stock',
    numeric: true,
    cell: (row) => (
      <>
        <span className="anum">{row.totalStock}</span>
        <span className="prow__meta">
          {row.variantCount} {row.variantCount === 1 ? 'variant' : 'variants'}
        </span>
      </>
    ),
  },
  {
    key: 'price',
    header: 'From',
    numeric: true,
    cell: (row) => formatCents(row.minPriceCents),
  },
  {
    key: 'actions',
    header: '',
    actions: true,
    cell: (row) => (
      <ProductRowActions
        id={row.id}
        status={row.status}
        archived={row.archived}
        title={row.title}
      />
    ),
  },
];

export default async function AdminProductsPage(props: PageProps<'/admin/products'>) {
  await requireAdminPage('products:read');

  const params = parseListParams(await props.searchParams, {
    sorts: PRODUCT_SORTS,
    filters: PRODUCT_FILTERS,
  });

  const [page, categories] = await Promise.all([
    listProductsForAdmin(params),
    listUsedCategorySlugs(),
  ]);

  return (
    <>
      <PageHead
        title="Products"
        sub="Everything the store sells, live or in draft. Archived products keep their history and leave the shop."
        actions={<Link href="/admin/products/new" className="abtn">New product</Link>}
      />

      <ListControls
        action="/admin/products"
        params={params}
        searchPlaceholder="Title, slug, SKU or tag"
        filters={[
          {
            name: 'status',
            label: 'Status',
            options: [
              { value: 'published', label: 'Published' },
              { value: 'draft', label: 'Draft' },
            ],
          },
          {
            name: 'category',
            label: 'Collection',
            options: categories.map((slug) => ({ value: slug, label: slug })),
          },
          {
            name: 'featured',
            label: 'Featured',
            options: [{ value: 'true', label: 'Featured only' }],
          },
          {
            name: 'archived',
            label: 'Archive',
            options: [{ value: 'true', label: 'Archived only' }],
          },
        ]}
        sorts={[
          { value: 'updatedAt', label: 'Last edited' },
          { value: 'createdAt', label: 'Created' },
          { value: 'title', label: 'Title' },
          { value: 'status', label: 'Status' },
        ]}
      />

      <BulkStockPanel
        scope="products"
        count={page.total}
        q={params.q}
        filters={params.filters}
      />

      <DataTable
        columns={columns}
        rows={page.rows}
        rowKey={(row) => row.id}
        empty={params.q ? `Nothing matches “${params.q}”` : 'No products yet'}
        emptyBody={
          params.q
            ? 'Search covers titles, slugs, SKUs and tags. Clear the filters to see the whole catalogue.'
            : 'A product holds the copy, the photography and the option sets; sizes and colours become variants with their own SKU, price and stock.'
        }
        emptyAction={
          params.q ? null : (
            <Link href="/admin/products/new" className="abtn">Add the first product</Link>
          )
        }
      />

      <Pagination action="/admin/products" page={page} />
    </>
  );
}
