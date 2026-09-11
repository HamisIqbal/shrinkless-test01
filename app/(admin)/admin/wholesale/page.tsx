import Link from 'next/link';
import { BulkStockPanel } from '@/components/admin/BulkStockPanel';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { PageHead } from '@/components/admin/PageHead';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { WholesaleRowActions } from '@/components/admin/WholesaleRowActions';
import { requireAdminPage } from '@/lib/auth/guards';
import { cloudinaryUrl } from '@/lib/cloudinary/url';
import { cropStyle } from '@/lib/media/crop';
import { formatCents } from '@/lib/money';
import { listWholesaleForAdmin } from '@/lib/services/wholesale';
import type { AdminWholesaleRowDTO } from '@/types/dto';

const UNITS = new Intl.NumberFormat('en-US');

/**
 * The line sheet, from the other side.
 *
 * The same table as the product list, with one deliberate difference: the
 * thumbnail is drawn through `cropStyle` at the sheet's own 2:3 shape, so what
 * an admin sees in this list is what the buyer sees in the frame. A list that
 * showed an uncropped square would be the one place the crop could not be
 * checked.
 */
const columns: Column<AdminWholesaleRowDTO>[] = [
  {
    key: 'title',
    header: 'Style',
    cell: (row) => (
      <span className="prow">
        {row.imagePublicId ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            className="prow__thumb"
            src={cloudinaryUrl(row.imagePublicId, 'w_130,h_195,c_fill,q_auto,f_auto')}
            alt=""
            width={54}
            height={81}
            loading="lazy"
            style={cropStyle(row.image ?? undefined)}
          />
        ) : (
          <span className="prow__thumb prow__thumb--empty" aria-hidden="true">
            No image
          </span>
        )}

        <span>
          <Link href={`/admin/wholesale/${row.id}`} className="prow__title">
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
    key: 'variants',
    header: 'Variants',
    numeric: true,
    cell: (row) => <span className="anum">{row.variantCount}</span>,
  },
  {
    key: 'basis',
    header: 'Retail basis',
    numeric: true,
    cell: (row) => formatCents(row.retailCents),
  },
  {
    key: 'opening',
    header: 'From',
    numeric: true,
    cell: (row) => (
      <>
        <span className="anum">{formatCents(row.openingUnitCents)}</span>
        <span className="prow__meta">at {UNITS.format(row.openingTier)} units</span>
      </>
    ),
  },
  {
    key: 'actions',
    header: '',
    actions: true,
    cell: (row) => <WholesaleRowActions id={row.id} />,
  },
];

export default async function AdminWholesalePage() {
  await requireAdminPage('products:read');

  const rows = await listWholesaleForAdmin();

  return (
    <>
      <PageHead
        title="Wholesale"
        sub="The trade line sheet. These styles are sold by the tier and never appear on the shop grid; per-unit pricing is derived from each style's retail basis."
        actions={
          <>
            <Link href="/wholesale" className="abtn abtn--ghost">
              View line sheet
            </Link>
            <Link href="/admin/wholesale/new" className="abtn">
              New style
            </Link>
          </>
        }
      />

      <BulkStockPanel scope="wholesale" count={rows.length} />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        empty="No wholesale styles yet"
        emptyBody="A wholesale style holds the copy, the line sheet frame and the option sets; its trade tiers are worked out from one basis price."
        emptyAction={
          <Link href="/admin/wholesale/new" className="abtn">
            Add the first style
          </Link>
        }
      />
    </>
  );
}
