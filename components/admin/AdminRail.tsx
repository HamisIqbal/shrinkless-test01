'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { logoutAction } from '@/app/actions/auth';
import {
  CategoriesIcon,
  ContentIcon,
  CustomersIcon,
  DashboardIcon,
  DiscountsIcon,
  ExitIcon,
  InventoryIcon,
  MediaIcon,
  OrdersIcon,
  PaymentsIcon,
  ProductsIcon,
  SettingsIcon,
  ShippingIcon,
  StorefrontIcon,
  WholesaleIcon,
} from '@/components/admin/icons';

const NAV = [
  { href: '/admin', label: 'Dashboard', Icon: DashboardIcon },
  { href: '/admin/orders', label: 'Orders', Icon: OrdersIcon },
  { href: '/admin/products', label: 'Products', Icon: ProductsIcon },
  { href: '/admin/wholesale', label: 'Wholesale', Icon: WholesaleIcon },
  { href: '/admin/inventory', label: 'Inventory', Icon: InventoryIcon },
  { href: '/admin/customers', label: 'Customers', Icon: CustomersIcon },
  { href: '/admin/categories', label: 'Collections', Icon: CategoriesIcon },
  { href: '/admin/media', label: 'Media', Icon: MediaIcon },
  { href: '/admin/content', label: 'Content', Icon: ContentIcon },
  { href: '/admin/discounts', label: 'Discounts', Icon: DiscountsIcon },
  { href: '/admin/shipping', label: 'Shipping', Icon: ShippingIcon },
  { href: '/admin/payments', label: 'Payments', Icon: PaymentsIcon },
  { href: '/admin/settings', label: 'Settings', Icon: SettingsIcon },
];

/**
 * The dark spine.
 *
 * A client component for two reasons: it marks the current section, and on a
 * phone it opens and closes. `/admin` is matched exactly so the dashboard does
 * not stay lit on every page beneath it.
 *
 * At a desk it is the dark column down the left of the sheet. Below 64rem it
 * folds into a slim bar across the top — the brand, the section you are in,
 * and a Menu button — and the whole list opens over the screen when asked.
 * The row of pills it used to become showed three sections of thirteen and
 * hid the rest off the edge, and the header it lived in took a third of the
 * screen before the page had started.
 *
 * The two ways out — back to the shop, and out of the session — are at the
 * foot of the list at both widths.
 */
export function AdminRail({ actorEmail }: { actorEmail: string }) {
  const pathname = usePathname();
  const [signingOut, startSignOut] = useTransition();
  const [open, setOpen] = useState(false);

  function isCurrent(href: string): boolean {
    return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
  }

  const here = NAV.find(({ href }) => isCurrent(href));

  /* While the menu covers the screen the page underneath must not scroll, and
     Escape is the way out a keyboard expects. */
  useEffect(() => {
    if (!open) return;

    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    window.addEventListener('keydown', onKey);

    return () => {
      root.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={`rail${open ? ' rail--open' : ''}`}>
      <div className="rail__top">
        <Link href="/admin" className="rail__brand" onClick={() => setOpen(false)}>
          Shrinkless
        </Link>

        {here ? <span className="rail__here">{here.label}</span> : null}

        <button
          type="button"
          className="rail__menu"
          aria-expanded={open}
          aria-controls="admin-menu"
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      <div className="rail__drawer" id="admin-menu">
        <div className="rail__scroll">
          <nav aria-label="Admin sections" className="rail__nav">
            <ul>
              {NAV.map(({ href, label, Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="rail__link"
                    aria-current={isCurrent(href) ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                  >
                    <Icon className="rail__icon" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="rail__foot">
          <div className="rail__who">
            <span className="rail__actor">Signed in</span>
            <span className="rail__email">{actorEmail}</span>
          </div>

          <div className="rail__actions">
            <Link href="/" className="rail__action">
              <StorefrontIcon />
              View store
            </Link>

            <button
              type="button"
              className="rail__action rail__action--out"
              disabled={signingOut}
              onClick={() => startSignOut(logoutAction)}
            >
              <ExitIcon />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Drawn here rather than in the icon set: they are the menu's own two states
   and nothing else in the panel uses them. */
function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
