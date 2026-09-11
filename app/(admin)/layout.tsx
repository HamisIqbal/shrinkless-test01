import { AdminRail } from '@/components/admin/AdminRail';
import { requireAdminPage } from '@/lib/auth/guards';

export const metadata = { title: 'Shrinkless admin' };

/**
 * The shell: a white worksheet floating on warm off-white, with the dark
 * spine down its left edge. The outer padding is the design — it is what
 * makes the interface read as an object on a desk rather than a browser
 * chrome filled edge to edge.
 */
export default async function AdminLayout({ children }: LayoutProps<'/'>) {
  const actor = await requireAdminPage();

  return (
    <div className="admin">
      <div className="admin__shell">
        <AdminRail actorEmail={actor.email} />

        <main className="admin__main">
          <div className="apage">{children}</div>
        </main>
      </div>
    </div>
  );
}
