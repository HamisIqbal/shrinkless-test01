import { MediaManager } from '@/components/admin/MediaManager';
import { requireAdminPage } from '@/lib/auth/guards';
import { listMediaPages } from '@/lib/services/site-media';

/**
 * The storefront's photography and the height of its bands, edited on the page
 * they belong to.
 *
 * No page head and no panel around it: this tab is the site, full screen, with
 * the editor's own bar over the top of it. The admin shell is still underneath
 * — Close returns to it — but nothing of it shows while the editor is open,
 * because a sidebar beside a page you are art-directing is a smaller page and
 * a worse decision.
 *
 * The pages, their slots and the home page's sections all come from
 * `lib/services/site-media.ts` — the same registry the storefront renders from
 * — so the editor cannot offer a frame or a band the site does not have.
 */
export default async function AdminMediaPage() {
  await requireAdminPage('media:read');

  const pages = await listMediaPages();

  return <MediaManager pages={pages} />;
}
