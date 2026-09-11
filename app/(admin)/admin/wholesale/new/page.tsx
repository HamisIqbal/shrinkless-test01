import Link from 'next/link';
import { PageHead } from '@/components/admin/PageHead';
import { WholesaleEditor } from '@/components/admin/WholesaleEditor';
import { requireAdminPage } from '@/lib/auth/guards';

export default async function NewWholesaleStylePage() {
  await requireAdminPage('products:write');

  return (
    <>
      <PageHead
        title="New wholesale style"
        sub="It stays a draft until you publish it, so it will not reach the line sheet before the photography and the price are right."
        actions={
          <Link href="/admin/wholesale" className="abtn abtn--ghost">
            Cancel
          </Link>
        }
      />

      <WholesaleEditor product={null} />
    </>
  );
}
