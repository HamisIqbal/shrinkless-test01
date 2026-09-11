import { PageHead } from '@/components/admin/PageHead';
import { SettingsForm } from '@/components/admin/SettingsForm';
import { requireAdminPage } from '@/lib/auth/guards';
import { getStoreSettings } from '@/lib/services/settings';

export default async function AdminSettingsPage() {
  await requireAdminPage('settings:read');
  const settings = await getStoreSettings();

  return (
    <>
      <PageHead
        title="Settings"
        sub="Store-wide values the storefront and the pricing engine both read."
      />

      <SettingsForm settings={settings} />
    </>
  );
}
