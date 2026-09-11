import { getStoreSettings } from '@/lib/services/settings';
import { readCartView } from '@/lib/cart-session';
import { buildShopMenu } from '@/lib/shop/menu.server';
import { auth } from '@/auth';
import { isAdminSession } from '@/lib/auth/guards';
import { SmoothScroll } from '@/components/ui/SmoothScroll';
import { Motion } from '@/components/ui/Motion';
import { ToastProvider } from '@/components/ui/Toast';
import { AnnounceBar } from '@/components/site/AnnounceBar';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { FooterReveal } from '@/components/site/FooterReveal';
import { HomeSwitch } from '@/components/home/HomeSwitch';
import { HomeAnnounce } from '@/components/home/HomeAnnounce';
import { HomeHeader } from '@/components/home/HomeHeader';
import { HomeFooter } from '@/components/home/HomeFooter';

export default async function ShopLayout({ children }: LayoutProps<'/'>) {
  const [settings, cart, session, menu] = await Promise.all([
    getStoreSettings(),
    readCartView(),
    auth(),
    buildShopMenu(),
  ]);

  return (
    <Motion>
    <ToastProvider>
    <div className="shell">
      <div className="shell__stack">
      <SmoothScroll />

      <a href="#main" className="skiplink">Skip to content</a>

      {/* The homepage draws its own announcement bar, header and footer; every
          other shop route keeps the standard ones. See HomeSwitch. */}
      <HomeSwitch
        home={<HomeAnnounce message={settings.announcement} />}
        rest={<AnnounceBar message={settings.announcement} />}
      />

      <HomeSwitch
        home={
          <HomeHeader
            menu={menu}
            cart={cart}
            signedIn={Boolean(session?.user)}
            isAdmin={isAdminSession(session)}
            storeEmail={settings.storeEmail}
          />
        }
        rest={
          <Header
            menu={menu}
            cart={cart}
            signedIn={Boolean(session?.user)}
            isAdmin={isAdminSession(session)}
            storeEmail={settings.storeEmail}
          />
        }
      />

      {/* The Instagram band is no longer bolted on here. Every route but the
          homepage gets it from app/(shop)/(instagram-last)/layout.tsx; the
          homepage places it itself, above New arrivals. */}
      <main id="main">{children}</main>
      </div>

      <FooterReveal>
        <HomeSwitch
          home={<HomeFooter storeEmail={settings.storeEmail} />}
          rest={<Footer storeEmail={settings.storeEmail} />}
        />
      </FooterReveal>
    </div>
    </ToastProvider>
    </Motion>
  );
}
