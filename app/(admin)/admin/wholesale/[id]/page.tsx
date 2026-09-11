import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHead } from '@/components/admin/PageHead';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { WholesaleEditor } from '@/components/admin/WholesaleEditor';
import { requireAdminPage } from '@/lib/auth/guards';
import { formatCents } from '@/lib/money';
import { getProductForAdmin } from '@/lib/services/products';
import { isWholesaleProduct } from '@/lib/services/wholesale';
import { WHOLESALE_TIERS, quoteForTier } from '@/lib/wholesale/pricing';

const UNITS = new Intl.NumberFormat('en-US');

export default async function EditWholesaleStylePage({
  params,
}: PageProps<'/admin/wholesale/[id]'>) {
  await requireAdminPage('products:write');

  const { id } = await params;
  const product = await getProductForAdmin(id);

  // A retail id reaching this URL is a wrong turn, not a permission problem:
  // opening the wholesale editor over a shop product would offer trade tiers
  // for a style that has none and hide the merchandising fields it does use.
  if (!product || !isWholesaleProduct(product.tags)) notFound();

  const sellable = product.variants.filter((variant) => variant.enabled);
  const basis = sellable.length ? Math.min(...sellable.map((v) => v.priceCents)) : 0;
  const opening = quoteForTier(basis, WHOLESALE_TIERS[0]);

  return (
    <>
      <PageHead
        title={product.title}
        sub={`${product.variants.length} ${product.variants.length === 1 ? 'variant' : 'variants'} · ${formatCents(opening.unitPriceCents)} per unit at ${UNITS.format(opening.tier)} · ${product.slug}`}
        actions={
          <>
            <StatusBadge status={product.archived ? 'archived' : product.status} />
            {product.status === 'published' && !product.archived ? (
              <Link href="/wholesale" className="abtn abtn--ghost">
                View line sheet
              </Link>
            ) : null}
            <Link href="/admin/wholesale" className="abtn abtn--ghost">
              All styles
            </Link>
          </>
        }
      />

      <WholesaleEditor product={product} />
    </>
  );
}
