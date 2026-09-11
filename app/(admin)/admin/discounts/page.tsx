import { DiscountManager } from '@/components/admin/DiscountManager';
import { ListControls, Pagination } from '@/components/admin/ListControls';
import { PageHead } from '@/components/admin/PageHead';
import { requireAdminPage } from '@/lib/auth/guards';
import { parseListParams } from '@/lib/admin/query';
import { DISCOUNT_FILTERS, DISCOUNT_SORTS, listDiscounts } from '@/lib/services/discounts';
import { listCategories } from '@/lib/services/categories';

export default async function AdminDiscountsPage(props: PageProps<'/admin/discounts'>) {
  await requireAdminPage('discounts:read');

  const params = parseListParams(await props.searchParams, {
    sorts: DISCOUNT_SORTS,
    filters: DISCOUNT_FILTERS,
  });

  const [page, categories] = await Promise.all([listDiscounts(params), listCategories()]);

  return (
    <>
      <PageHead
        title="Discounts"
        sub="Codes are validated and priced on the server. The browser only ever sends the code."
      />

      <ListControls
        action="/admin/discounts"
        params={params}
        searchPlaceholder="Code or description"
        filters={[
          {
            name: 'state',
            label: 'State',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'archived', label: 'Archived' },
            ],
          },
          {
            name: 'type',
            label: 'Type',
            options: [
              { value: 'percentage', label: 'Percentage' },
              { value: 'fixed', label: 'Fixed amount' },
            ],
          },
        ]}
        sorts={[
          { value: 'createdAt', label: 'Created' },
          { value: 'code', label: 'Code' },
          { value: 'usedCount', label: 'Times used' },
          { value: 'endsAt', label: 'Expiry' },
        ]}
      />

      <DiscountManager
        discounts={page.rows}
        categorySlugs={categories.map((category) => category.slug)}
      />

      <Pagination action="/admin/discounts" page={page} />
    </>
  );
}
