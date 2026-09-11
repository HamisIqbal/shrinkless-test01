'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { PRIMARY_NAV, type ShopMenu } from '@/lib/shop/navigation';
import { SearchIcon, CartIcon, ArrowIcon } from '@/components/site/icons';
import { CartSheet } from '@/components/shop/CartSheet';
import { homeFonts } from '@/components/home/fonts';
import { HomeMegaMenu } from '@/components/home/HomeMegaMenu';
import { HomeDrawer } from '@/components/home/HomeDrawer';
import type { CartViewDTO } from '@/types/dto';

type Props = {
  menu: ShopMenu;
  cart: CartViewDTO | null;
  signedIn: boolean;
  /** Display only — every admin route re-checks the session server-side. */
  isAdmin: boolean;
  storeEmail: string;
};

/** How far the page moves before the bar takes its solid, shorter form. */
const COMPACT_AT = 16;

/** Hover grace in and out, so crossing the bar never drops the panel. */
const HOVER_IN = 120;
const HOVER_OUT = 220;

const WORDMARK = 'SHRINKLESS'.split('');

/** Two copies of a label stacked in a one-line window; hover rolls the second up. */
export function Roll({ children }: { children: string }) {
  return (
    <span className="hm-roll">
      <span className="hm-roll__a">{children}</span>
      <span className="hm-roll__b" aria-hidden="true">{children}</span>
    </span>
  );
}

/**
 * The homepage masthead.
 *
 * Behaves exactly like the shop header — transparent over the campaign at
 * rest, solid and shorter from the first scroll, the shop panel on a lazy
 * hover or a pinning click, search in a drop panel, the cart as a sheet — but
 * drawn as its own thing: links left, the wordmark centred, text utilities
 * right, and an ink sheet that the bar and the menu become together.
 */
export function HomeHeader({ menu, cart, signedIn, isAdmin, storeEmail }: Props) {
  const router = useRouter();
  const itemCount = cart?.itemCount ?? 0;

  const [scrolled, setScrolled] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hovered, setHovered] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);

  const searchInput = useRef<HTMLInputElement>(null);
  const hoverTimer = useRef(0);

  const panel = megaOpen || searchOpen;
  const overlaid = !scrolled && !panel;

  useEffect(() => {
    let frame = 0;

    function read() {
      frame = 0;
      setScrolled(window.scrollY > COMPACT_AT);
    }

    function onScroll() {
      if (!frame) frame = requestAnimationFrame(read);
    }

    frame = requestAnimationFrame(read);
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!panel) return;

    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setPinned(false);
      setMegaOpen(false);
      setSearchOpen(false);
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [panel]);

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

  const closeMega = useCallback(() => {
    setPinned(false);
    setMegaOpen(false);
  }, []);

  const closePanels = useCallback(() => {
    setPinned(false);
    setMegaOpen(false);
    setSearchOpen(false);
  }, []);

  // Hover only where hovering is a real gesture; a tap's synthetic
  // mouseenter would race the click handler.
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
    hoverTimer.current = window.setTimeout(() => {
      setSearchOpen(false);
      setMegaOpen(true);
    }, HOVER_IN);
  }, [canHover, clearHover]);

  const hoverClose = useCallback(() => {
    setHovered(null);
    if (!canHover() || pinned) return;
    clearHover();
    hoverTimer.current = window.setTimeout(() => setMegaOpen(false), HOVER_OUT);
  }, [canHover, clearHover, pinned]);

  function toggleMega() {
    clearHover();
    const next = !megaOpen;
    setSearchOpen(false);
    setPinned(next);
    setMegaOpen(next);
  }

  function toggleSearch() {
    clearHover();
    setPinned(false);
    setMegaOpen(false);
    setSearchOpen((value) => !value);
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const term = query.trim();

    router.push(term ? `/shop?q=${encodeURIComponent(term)}` : '/shop');
    setSearchOpen(false);
  }

  const classes = [
    'hm-head',
    homeFonts,
    overlaid ? 'hm-head--over' : '',
    scrolled ? 'hm-head--compact' : '',
    panel ? 'hm-head--panel' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <header className={classes} onMouseLeave={hoverClose}>
        <div className="hm-head__bar">
          <div className="hm-head__left">
            <button
              type="button"
              className="hm-burger"
              aria-expanded={drawerOpen}
              aria-controls="mobile-drawer"
              onClick={() => setDrawerOpen(true)}
            >
              <span className="hm-burger__lines" aria-hidden="true" />
              <span className="visually-hidden">Open menu</span>
            </button>

            <nav aria-label="Main" className="hm-nav">
              <LayoutGroup id="hm-nav">
                <ul onMouseLeave={() => setHovered(null)}>
                  {PRIMARY_NAV.map((item, index) => {
                    const isShop = item.href === '/shop';

                    return (
                      <li
                        key={item.href}
                        className="hm-nav__item"
                        onMouseEnter={() => setHovered(index)}
                        onFocus={() => setHovered(index)}
                        onBlur={() => setHovered(null)}
                      >
                        {isShop ? (
                          <button
                            type="button"
                            className="hm-nav__link"
                            aria-expanded={megaOpen}
                            aria-controls="shop-mega"
                            onClick={toggleMega}
                            onMouseEnter={hoverOpen}
                            onFocus={hoverOpen}
                          >
                            {item.label}
                            <span className="hm-nav__plus" aria-hidden="true" />
                          </button>
                        ) : (
                          <Link href={item.href} className="hm-nav__link">
                            {item.label}
                            {item.highlight ? (
                              <span className="hm-nav__flag" aria-hidden="true" />
                            ) : null}
                          </Link>
                        )}

                        <AnimatePresence>
                          {hovered === index ? (
                            <motion.span
                              layoutId="hm-nav-line"
                              className="hm-nav__line"
                              aria-hidden="true"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 520, damping: 42, mass: 0.6 }}
                            />
                          ) : null}
                        </AnimatePresence>
                      </li>
                    );
                  })}
                </ul>
              </LayoutGroup>
            </nav>
          </div>

          <Link href="/" className="hm-mark">
            <span className="visually-hidden">Shrinkless, home</span>
            <span className="hm-mark__word" aria-hidden="true">
              {WORDMARK.map((letter, index) => (
                <span
                  key={index}
                  className="hm-mark__char"
                  style={{ '--i': index } as React.CSSProperties}
                >
                  {letter}
                </span>
              ))}
            </span>
          </Link>

          <div className="hm-head__utils">
            {isAdmin ? (
              <Link href="/admin" className="hm-util hm-util--admin">
                <Roll>Admin</Roll>
              </Link>
            ) : null}

            <button
              type="button"
              className="hm-util hm-util--search"
              aria-expanded={searchOpen}
              aria-controls="site-search"
              onClick={toggleSearch}
            >
              <SearchIcon className="hm-util__icon" />
              <span className="hm-util__text" aria-hidden="true"><Roll>Search</Roll></span>
              <span className="visually-hidden">Search</span>
            </button>

            <Link href={signedIn ? '/account' : '/login'} className="hm-util hm-util--account">
              <span className="hm-util__text"><Roll>{signedIn ? 'Account' : 'Sign in'}</Roll></span>
            </Link>

            {/* Opens the sheet rather than navigating; /cart is still a real page. */}
            <button
              type="button"
              className="hm-util hm-util--bag"
              aria-expanded={cartOpen}
              aria-haspopup="dialog"
              onClick={() => setCartOpen(true)}
            >
              <CartIcon className="hm-util__icon" />
              <span className="hm-util__text" aria-hidden="true"><Roll>Bag</Roll></span>
              <span className="hm-util__count tnum" aria-hidden="true">
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span
                    key={itemCount}
                    className="hm-util__num"
                    initial={{ y: '-110%' }}
                    animate={{ y: '0%' }}
                    exit={{ y: '110%' }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {itemCount}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="visually-hidden">
                Cart, {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </span>
            </button>
          </div>
        </div>

        <div
          id="site-search"
          className={`hm-search${searchOpen ? ' is-open' : ''}`}
          inert={!searchOpen}
        >
          <form className="hm-search__inner" role="search" onSubmit={submitSearch}>
            <label htmlFor="site-search-input" className="hm-search__label">
              Search products
            </label>
            <div className="hm-search__field">
              <input
                id="site-search-input"
                ref={searchInput}
                type="search"
                className="hm-search__input"
                placeholder="Search tees, colours, fits"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button type="submit" className="hm-search__go">
                <ArrowIcon />
                <span className="visually-hidden">Search</span>
              </button>
            </div>
            <button type="button" className="hm-search__close" onClick={() => setSearchOpen(false)}>
              <Roll>Close</Roll>
            </button>
          </form>
        </div>

        <HomeMegaMenu menu={menu} open={megaOpen} id="shop-mega" onNavigate={closeMega} />
      </header>

      <div
        className={`hm-scrim${panel ? ' is-open' : ''}`}
        aria-hidden="true"
        onClick={closePanels}
      />

      <div id="mobile-drawer">
        <HomeDrawer
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
