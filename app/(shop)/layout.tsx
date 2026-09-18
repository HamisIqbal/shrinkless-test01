import { cookies } from 'next/headers';
import { getStoreSettings } from '@/lib/services/settings';
import { listPublishedProducts } from '@/lib/services/products';
import { readCartView } from '@/lib/cart-session';
import { buildShopMenu } from '@/lib/shop/menu.server';
import { auth } from '@/auth';
import { isAdminSession } from '@/lib/auth/guards';
import { SmoothScroll } from '@/components/ui/SmoothScroll';
import { Motion } from '@/components/ui/Motion';
import { ToastProvider } from '@/components/ui/Toast';
import { ANNOUNCE_COOKIE, isDismissed } from '@/lib/shop/announcement';
import { AnnounceBar } from '@/components/site/AnnounceBar';
import { Chrome } from '@/components/site/Chrome';
import { FooterReveal } from '@/components/site/FooterReveal';
import { HomeFooter } from '@/components/home/HomeFooter';

export default async function ShopLayout({ children }: LayoutProps<'/'>) {
  const [settings, cart, session, menu, products, jar] = await Promise.all([
    getStoreSettings(),
    readCartView(),
    auth(),
    buildShopMenu(),
    // The homepage's search sheet shows cards rather than a bare field, so it
    // needs the catalogue. Read here rather than fetched on open: the store is
    // small enough to hand over whole, and a sheet that opens already full is
    // the point of it.
    listPublishedProducts({ sizes: [], colors: [], sort: 'newest', q: '', minPrice: null, maxPrice: null, gender: null }),
    cookies(),
  ]);

  const dismissed = isDismissed(settings.announcement, jar.get(ANNOUNCE_COOKIE)?.value);

  return (
    <Motion>
    <ToastProvider>
    <div className="shell">
      <div className="shell__stack">
      <SmoothScroll />

      <a href="#main" className="skiplink">Skip to content</a>

      {/* Every storefront page carries the bar now, the homepage included.
          Whether it has already been put away is read here rather than in the
          browser: a bar that appears and then vanishes is a flash and a shift
          on every single page load, and reading storage while rendering is a
          hydration mismatch. */}
      <AnnounceBar message={settings.announcement} dismissed={dismissed} />

      <Chrome
        menu={menu}
        cart={cart}
        signedIn={Boolean(session?.user)}
        isAdmin={isAdminSession(session)}
        storeEmail={settings.storeEmail}
        products={products}
      />

      <main id="main">{children}</main>
      </div>

      <FooterReveal>
        <HomeFooter storeEmail={settings.storeEmail} />
      </FooterReveal>
    </div>
    </ToastProvider>
    </Motion>
  );
}
