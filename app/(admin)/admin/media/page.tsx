import { MediaManager } from '@/components/admin/MediaManager';
import { PageHead } from '@/components/admin/PageHead';
import { requireAdminPage } from '@/lib/auth/guards';
import { listMediaPages } from '@/lib/services/site-media';

/**
 * Every photograph the storefront uses, page by page.
 *
 * A register, not a rehearsal. This tab used to be the shop itself in a
 * full-screen frame with the controls beside it; it is now a list of the
 * images the site is actually built from, each one replaceable by upload or by
 * address and croppable for the desk and the phone separately.
 *
 * The pages, their slots and the home page's sections all come from
 * `lib/services/site-media.ts` — the same registry the storefront renders from
 * — so the list cannot offer a frame or a band the site does not have, and
 * cannot miss one it does.
 */
export default async function AdminMediaPage() {
  await requireAdminPage('media:read');

  const pages = await listMediaPages();

  return (
    <>
      <PageHead
        title="Media"
        sub="The photography the storefront is built from, and the height and ground of the homepage's bands. Words live on Content; product photography lives on each product."
      />

      <MediaManager pages={pages} />
    </>
  );
}
