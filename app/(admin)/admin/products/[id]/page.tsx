import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHead } from '@/components/admin/PageHead';
import { ProductEditor } from '@/components/admin/ProductEditor';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { requireAdminPage } from '@/lib/auth/guards';
import { getProductFieldSuggestions, getProductForAdmin } from '@/lib/services/products';

export default async function EditProductPage({ params }: PageProps<'/admin/products/[id]'>) {
  await requireAdminPage('products:write');

  const { id } = await params;
  const [product, suggestions] = await Promise.all([
    getProductForAdmin(id),
    getProductFieldSuggestions(),
  ]);
  if (!product) notFound();

  const stock = product.variants.reduce((sum, variant) => sum + variant.stock, 0);

  return (
    <>
      <PageHead
        title={product.title}
        sub={`${product.variants.length} ${product.variants.length === 1 ? 'variant' : 'variants'} · ${stock} in stock · ${product.slug}`}
        actions={
          <>
            <StatusBadge status={product.archived ? 'archived' : product.status} />
            {product.status === 'published' && !product.archived ? (
              <Link href={`/product/${product.slug}`} className="abtn abtn--ghost">
                View in store
              </Link>
            ) : null}
            <Link href="/admin/products" className="abtn abtn--ghost">All products</Link>
          </>
        }
      />

      <ProductEditor product={product} suggestions={suggestions} />
    </>
  );
}
