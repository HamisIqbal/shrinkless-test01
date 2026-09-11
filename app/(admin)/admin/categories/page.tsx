import { CategoryManager } from '@/components/admin/CategoryManager';
import { PageHead } from '@/components/admin/PageHead';
import { requireAdminPage } from '@/lib/auth/guards';
import { listCategories } from '@/lib/services/categories';
import { listUsedCategorySlugs } from '@/lib/services/products';

export default async function AdminCategoriesPage() {
  await requireAdminPage('categories:read');

  const [categories, usedSlugs] = await Promise.all([
    listCategories({ includeArchived: true }),
    listUsedCategorySlugs(),
  ]);

  // Slugs products already use that have no collection document yet. Surfaced
  // rather than silently missing, with the one control that fixes it.
  const known = new Set(categories.map((category) => category.slug));
  const orphans = usedSlugs.filter((slug) => !known.has(slug));

  return (
    <>
      <PageHead
        title="Collections"
        sub="Products belong to a collection by slug. Renaming a slug moves every product with it; archiving is refused while a collection still holds products."
      />

      <CategoryManager categories={categories} orphanSlugs={orphans} />
    </>
  );
}
