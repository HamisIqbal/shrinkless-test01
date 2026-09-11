import { PageHead } from '@/components/admin/PageHead';
import { ShippingManager } from '@/components/admin/ShippingManager';
import { requireAdminPage } from '@/lib/auth/guards';
import { formatCents } from '@/lib/money';
import { getStoreSettings } from '@/lib/services/settings';
import { listShippingMethods } from '@/lib/services/shipping';

export default async function AdminShippingPage() {
  await requireAdminPage('shipping:read');

  const [methods, settings] = await Promise.all([
    listShippingMethods({ includeArchived: true }),
    getStoreSettings(),
  ]);

  return (
    <>
      <PageHead
        title="Shipping"
        sub="Rates are quoted server-side at checkout. A method with no countries and no states applies everywhere; anything listed narrows it."
      />

      {settings.freeShippingThresholdCents !== null ? (
        <p className="anotice">
          Store-wide, orders over{' '}
          {formatCents(settings.freeShippingThresholdCents)} ship free regardless of
          method.
        </p>
      ) : null}

      <ShippingManager methods={methods} />
    </>
  );
}
