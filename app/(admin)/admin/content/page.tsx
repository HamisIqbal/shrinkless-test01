import { PageHead } from '@/components/admin/PageHead';
import { ContentManager } from '@/components/admin/ContentManager';
import { requireAdminPage } from '@/lib/auth/guards';
import { listContentPages } from '@/lib/services/site-content';

/**
 * The storefront's writing, edited where it appears.
 *
 * Every field here is a piece of type in a layout that was composed by hand,
 * so the set is fixed and what changes is the wording inside it. A field
 * showing "Changed" has been rewritten; restoring one deletes the row and puts
 * back the wording the site shipped with.
 *
 * Words only. How a line is set — its size, its colour, where it sits — is the
 * Media tab's business, and nothing here touches it.
 *
 * The pages, their sections and the fields in them all come from
 * `lib/services/site-content.ts` — the same registry the storefront renders
 * from — so a page here cannot show a line the site does not have.
 */
export default async function AdminContentPage() {
  await requireAdminPage('content:read');

  const pages = await listContentPages();

  return (
    <>
      <PageHead
        title="Content"
        sub="The words the storefront is built from, section by section. Photography and layout live on Media; product copy lives on each product."
      />

      <ContentManager pages={pages} />
    </>
  );
}
