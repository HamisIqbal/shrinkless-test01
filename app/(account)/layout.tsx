import { cookies } from 'next/headers';
import { getStoreSettings } from '@/lib/services/settings';
import { readCartView } from '@/lib/cart-session';
import { buildShopMenu } from '@/lib/shop/menu.server';
import { auth } from '@/auth';
import { isAdminSession } from '@/lib/auth/guards';
import { Motion } from '@/components/ui/Motion';
import { ToastProvider } from '@/components/ui/Toast';
import { ANNOUNCE_COOKIE, isDismissed } from '@/lib/shop/announcement';
import { AnnounceBar } from '@/components/site/AnnounceBar';
import { Header } from '@/components/site/Header';
import { HomeFooter } from '@/components/home/HomeFooter';
import { FooterReveal } from '@/components/site/FooterReveal';
import { HomeInstagram } from '@/components/home/HomeInstagram';

export default async function AccountLayout({ children }: LayoutProps<'/'>) {
  const [settings, cart, session, menu, jar] = await Promise.all([
    getStoreSettings(),
    readCartView(),
    auth(),
    buildShopMenu(),
    cookies(),
  ]);

  const dismissed = isDismissed(settings.announcement, jar.get(ANNOUNCE_COOKIE)?.value);

  return (
    <Motion>
    <ToastProvider>
    <div className="shell">
      <div className="shell__stack">
      <AnnounceBar message={settings.announcement} dismissed={dismissed} />

      <a href="#main" className="skiplink">Skip to content</a>

      <Header
        menu={menu}
        cart={cart}
        signedIn={Boolean(session?.user)}
        isAdmin={isAdminSession(session)}
        storeEmail={settings.storeEmail}
      />

      <main id="main" className="band band--tight wrap">
        <div className="accountpane">{children}</div>
      </main>

        <HomeInstagram />
      </div>

      <FooterReveal>
        <HomeFooter storeEmail={settings.storeEmail} />
      </FooterReveal>
    </div>
    </ToastProvider>
    </Motion>
  );
}
