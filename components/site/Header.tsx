'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PRIMARY_NAV, type ShopMenu } from '@/lib/shop/navigation';
import { MegaMenu } from '@/components/site/MegaMenu';
import { SearchIcon, AccountIcon, CartIcon } from '@/components/site/icons';
import { MobileDrawer } from '@/components/site/MobileDrawer';
import { CartSheet } from '@/components/shop/CartSheet';
import type { CartViewDTO } from '@/types/dto';

type Props = {
  menu: ShopMenu;
  cart: CartViewDTO | null;
  signedIn: boolean;
  /** Shows the way back into the admin panel. Display only — every admin
   *  route re-checks the session server-side. */
  isAdmin: boolean;
  storeEmail: string;
};

/** How far you have to move before the compact bar takes over. */
const COMPACT_AT = 16;

/** Hover grace, in and out. Short enough to feel immediate, long enough that
 *  a pointer passing through the bar never opens anything. */
const HOVER_IN = 120;
const HOVER_OUT = 220;

/**
 * Sits over the campaign hero on the homepage and takes a solid ground the
 * moment the page moves.
 *
 * The shop panel opens on hover on a pointer device and on click everywhere.
 * The hover is deliberately lazy in both directions: it waits `HOVER_IN` before
 * opening, so merely crossing the bar on the way to the cart does not drop a
 * full-width panel over the page, and `HOVER_OUT` before closing, so the
 * diagonal from the trigger down into the panel does not shut it en route.
 *
 * Clicking pins the panel. A pinned panel ignores hover entirely until it is
 * clicked shut or the route changes — otherwise a shopper who deliberately
 * opened it would lose it the moment their pointer drifted.
 *
 * Spec §11: the compact bar has to arrive on the *first* meaningful scroll,
 * so the trigger is scroll position, not the foot of the hero. Sixteen pixels
 * is roughly one wheel notch — far enough not to fire on a rubber-band bounce,
 * near enough that the bar feels like it was waiting for you. Scrolling back
 * to the top hands the transparent treatment back.
 */
export function Header({ menu, cart, signedIn, isAdmin, storeEmail }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const itemCount = cart?.itemCount ?? 0;

  const canOverlay = pathname === '/';

  const [scrolled, setScrolled] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [query, setQuery] = useState('');

  const searchInput = useRef<HTMLInputElement>(null);
  const hoverTimer = useRef(0);
  /** Set by a click. State rather than a ref because the hover handlers read
   *  it and have to be rebuilt when it changes. */
  const [pinned, setPinned] = useState(false);

  const overlaid = canOverlay && !scrolled && !megaOpen && !searchOpen;

  useEffect(() => {
    let frame = 0;

    function read() {
      frame = 0;
      setScrolled(window.scrollY > COMPACT_AT);
    }

    function onScroll() {
      // One read per painted frame. The listener itself does no layout work.
      if (!frame) frame = requestAnimationFrame(read);
    }

    frame = requestAnimationFrame(read);
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Any navigation closes everything. Without this a soft route change leaves
  // the mega menu hanging over the page it just moved to. Adjusting during
  // render rather than in an effect means the new route never paints a frame
  // with the old panel still open.
  const [routeMark, setRouteMark] = useState(pathname);

  if (routeMark !== pathname) {
    setRouteMark(pathname);
    setPinned(false);
    setMegaOpen(false);
    setDrawerOpen(false);
    setSearchOpen(false);
    setCartOpen(false);
  }

  useEffect(() => {
    if (!megaOpen && !searchOpen) return;

    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setPinned(false);
      setMegaOpen(false);
      setSearchOpen(false);
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [megaOpen, searchOpen]);

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

  const closeMega = useCallback(() => {
    setPinned(false);
    setMegaOpen(false);
  }, []);

  // Hover only where hovering is a real gesture. A touch device reports a
  // synthetic mouseenter on tap, which would race the click handler and leave
  // the panel opening and closing in the same gesture.
  const canHover = useCallback(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 62rem)').matches,
    [],
  );

  const clearHover = useCallback(() => {
    if (hoverTimer.current) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = 0;
    }
  }, []);

  useEffect(() => clearHover, [clearHover]);

  const hoverOpen = useCallback(() => {
    if (!canHover()) return;
    clearHover();
    hoverTimer.current = window.setTimeout(() => setMegaOpen(true), HOVER_IN);
  }, [canHover, clearHover]);

  const hoverClose = useCallback(() => {
    if (!canHover() || pinned) return;
    clearHover();
    hoverTimer.current = window.setTimeout(() => setMegaOpen(false), HOVER_OUT);
  }, [canHover, clearHover, pinned]);

  function toggleMega() {
    clearHover();
    const next = !megaOpen;
    setPinned(next);
    setMegaOpen(next);
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const term = query.trim();

    router.push(term ? `/shop?q=${encodeURIComponent(term)}` : '/shop');
    setSearchOpen(false);
  }

  const classes = [
    'masthead',
    overlaid ? 'masthead--over' : '',
    scrolled ? 'masthead--compact' : '',
    megaOpen || searchOpen ? 'masthead--panel' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      {/* The panel is inside the header, so leaving the header is the one
          event that reliably means "the pointer has abandoned the menu" —
          leaving the trigger alone would fire on the way into the panel. */}
      <header className={classes} onMouseLeave={hoverClose}>
        <div className="wrap masthead__inner">
          <button
            type="button"
            className="masthead__toggle"
            aria-expanded={drawerOpen}
            aria-controls="mobile-drawer"
            onClick={() => setDrawerOpen(true)}
          >
            <span className="masthead__bars" aria-hidden="true" />
            <span className="visually-hidden">Open menu</span>
          </button>

          <Link href="/" className="wordmark">Shrinkless</Link>

          <nav aria-label="Main" className="mainnav">
            <ul>
              {PRIMARY_NAV.map((item) => {
                const isShop = item.href === '/shop';
                const current = isShop
                  ? pathname === '/shop'
                  : pathname.startsWith(item.href);

                return (
                  <li key={item.href} className="mainnav__item">
                    {isShop ? (
                      <button
                        type="button"
                        className="ulink mainnav__trigger"
                        aria-expanded={megaOpen}
                        aria-controls="shop-mega"
                        onClick={toggleMega}
                        onMouseEnter={hoverOpen}
                        onFocus={hoverOpen}
                      >
                        {item.label}
                        <span className="mainnav__chevron" aria-hidden="true" />
                      </button>
                    ) : (
                      <Link
                        href={item.href}
                        className="ulink"
                        aria-current={current ? 'page' : undefined}
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="masthead__utils">
            {isAdmin ? (
              <Link href="/admin" className="adminlink masthead__admin">
                Admin
              </Link>
            ) : null}

            <button
              type="button"
              className="iconbtn masthead__search"
              aria-expanded={searchOpen}
              aria-controls="site-search"
              onClick={() => setSearchOpen((value) => !value)}
            >
              <SearchIcon />
              <span className="visually-hidden">Search</span>
            </button>

            <Link
              href={signedIn ? '/account' : '/login'}
              className="iconbtn masthead__account"
            >
              <AccountIcon />
              <span className="visually-hidden">{signedIn ? 'Account' : 'Sign in'}</span>
            </Link>

            {/* Opens the sheet rather than navigating. /cart is still a real
                page — a bookmark, a shared link and a JavaScript-less browser
                all land on it — but nothing here sends a shopper away from
                what they were looking at to see a list. */}
            <button
              type="button"
              className="iconbtn iconbtn--cart"
              aria-expanded={cartOpen}
              aria-haspopup="dialog"
              onClick={() => setCartOpen(true)}
            >
              <CartIcon />
              {itemCount > 0 ? (
                <span className="iconbtn__count tnum" aria-hidden="true">{itemCount}</span>
              ) : null}
              <span className="visually-hidden">
                Cart, {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </span>
            </button>
          </div>
        </div>

        <div
          id="site-search"
          className={`sitesearch${searchOpen ? ' sitesearch--open' : ''}`}
          inert={!searchOpen}
        >
          <form className="wrap sitesearch__inner" role="search" onSubmit={submitSearch}>
            <label htmlFor="site-search-input" className="visually-hidden">
              Search products
            </label>
            <input
              id="site-search-input"
              ref={searchInput}
              type="search"
              className="sitesearch__input"
              placeholder="Search tees, colours, fits"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="submit" className="btn sitesearch__go">Search</button>
            <button
              type="button"
              className="ulink sitesearch__close"
              onClick={() => setSearchOpen(false)}
            >
              Close
            </button>
          </form>
        </div>

        <MegaMenu menu={menu} open={megaOpen} id="shop-mega" onNavigate={closeMega} />
      </header>

      <div id="mobile-drawer">
        <MobileDrawer
          menu={menu}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          itemCount={itemCount}
          signedIn={signedIn}
          isAdmin={isAdmin}
          storeEmail={storeEmail}
          onOpenCart={() => {
            setDrawerOpen(false);
            setCartOpen(true);
          }}
        />
      </div>

      <CartSheet cart={cart} open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
