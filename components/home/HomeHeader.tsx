'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { PRIMARY_NAV, type ShopMenu } from '@/lib/shop/navigation';
import { SearchIcon, AccountIcon, CartIcon, ArrowIcon } from '@/components/site/icons';
import { ProductCard } from '@/components/shop/ProductCard';
import { CartSheet } from '@/components/shop/CartSheet';
import { homeFonts } from '@/components/home/fonts';
import { HomeMegaMenu, PANEL_BY_HREF, type PanelKey } from '@/components/home/HomeMegaMenu';
import { HomeDrawer } from '@/components/home/HomeDrawer';
import type { CartViewDTO, ProductDTO } from '@/types/dto';

type Props = {
  menu: ShopMenu;
  cart: CartViewDTO | null;
  signedIn: boolean;
  /** Display only — every admin route re-checks the session server-side. */
  isAdmin: boolean;
  storeEmail: string;
  /** The published catalogue, so the search sheet can show cards before a
   *  single letter is typed and narrow them as one is. */
  products: ProductDTO[];
  /**
   * Whether this page opens on full-bleed media, so the bar may start
   * transparent over it. False on a page set on paper, where white type on a
   * transparent bar would be white type on a white page.
   */
  over?: boolean;
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
 * Three bands: the wordmark on the left, the navigation centred, and the three
 * utilities — search, account, bag — on the right as icons alone. The bar
 * words are set in Bebas Neue, which is what makes the row read as signage
 * rather than as interface; the wordmark keeps Archivo's width axis so the
 * brand is still the one thing on the bar in the brand's own face.
 *
 * Shop, Men and Women are links to their collections, and each drops the same
 * sheet with its own set of columns on a lazy hover. None of them carries a
 * plus: the sheet dropping is the disclosure. They used to be buttons that
 * pinned the sheet on a click, which left a shopper who clicked "Men" looking
 * at a menu instead of the men's collection. Pointing at anything else on the
 * bar — Wholesale, About Us, the utilities — puts the sheet away, so it never
 * hangs open under a word it does not belong to. Search opens a sheet the size of the window —
 * the field across the top, the catalogue as cards underneath it — and the
 * cart opens as a sheet of its own.
 *
 * On a page that opens on full-bleed media the bar starts transparent over it,
 * every word and icon in white, and only becomes paper on the first scroll —
 * so the photograph runs to the top of the screen. Which pages those are is
 * `lib/shop/chrome.ts`'s answer, not this component's.
 *
 * Below the desktop breakpoint it is white from the first pixel: there the
 * campaign is a tall crop behind a burger, the wordmark and three icons, and a
 * transparent bar could not promise those stay readable. On a phone the row is
 * the burger and the wordmark together on the left and the three utilities
 * hard right, evenly spaced, the bag's counter riding the corner of its mark
 * so all three sit as equal squares. Centred,
 * the wordmark had only the sliver of bar the icons left it and ran under the
 * search mark; beside the burger it has the whole left of the row.
 */
export function HomeHeader({ menu, cart, signedIn, isAdmin, storeEmail, products, over = false }: Props) {
  const router = useRouter();
  const itemCount = cart?.itemCount ?? 0;

  const [scrolled, setScrolled] = useState(false);
  const [megaPanel, setMegaPanel] = useState<PanelKey | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hovered, setHovered] = useState<number | null>(null);

  const searchInput = useRef<HTMLInputElement>(null);
  const hoverTimer = useRef(0);
  const headRef = useRef<HTMLElement>(null);

  const megaOpen = megaPanel !== null;
  const panel = megaOpen || searchOpen;

  /* The shop panel is pinned to the window rather than hung off the bar,
     because the bar lives inside the page slab and the slab clips to its
     rounded foot. Scrolled down to the footer, the foot is just under the bar
     and the panel was cut off there. Fixed, it escapes the clip; this keeps
     it docked to the bar's lower edge, which moves as the announcement bar
     scrolls away and the bar goes compact. */
  useEffect(() => {
    const head = headRef.current;
    if (!megaOpen || !head) return;

    let frame = 0;
    const dock = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        head.style.setProperty('--hm-mega-top', `${head.getBoundingClientRect().bottom}px`);
      });
    };

    dock();
    window.addEventListener('scroll', dock, { passive: true });
    window.addEventListener('resize', dock);
    const observer = new ResizeObserver(dock);
    observer.observe(head);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', dock);
      window.removeEventListener('resize', dock);
      observer.disconnect();
    };
  }, [megaOpen]);

  // The sheet opens showing the whole catalogue and narrows as you type, so it
  // is a way into the shop rather than an empty box waiting to be fed. Matched
  // on what a shopper can see on the tile — the name, the copy, the category
  // and the colourways — which is the same reach /shop's own search has.
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return products;

    return products.filter(
      (product) =>
        product.title.toLowerCase().includes(needle) ||
        product.description.toLowerCase().includes(needle) ||
        product.category.toLowerCase().includes(needle) ||
        product.colors.some((color) => color.toLowerCase().includes(needle)),
    );
  }, [products, query]);

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
      setMegaPanel(null);
      setSearchOpen(false);
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [panel]);

  // The sheet covers the window, so the page behind it should not scroll
  // under it — and the field is what a shopper came for, so it takes focus.
  useEffect(() => {
    if (!searchOpen) return;

    searchInput.current?.focus();

    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflow;
    };
  }, [searchOpen]);

  const closeMega = useCallback(() => {
    setMegaPanel(null);
  }, []);

  const closePanels = useCallback(() => {
    setMegaPanel(null);
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

  const hoverOpen = useCallback(
    (key: PanelKey) => {
      if (!canHover()) return;
      clearHover();
      hoverTimer.current = window.setTimeout(() => {
        setSearchOpen(false);
        setMegaPanel(key);
      }, HOVER_IN);
    },
    [canHover, clearHover],
  );

  const hoverClose = useCallback(() => {
    setHovered(null);
    if (!canHover()) return;
    clearHover();
    hoverTimer.current = window.setTimeout(() => setMegaPanel(null), HOVER_OUT);
  }, [canHover, clearHover]);

  /* Arriving on a word with no sheet of its own shuts the one that is down —
     and cancels one that was about to drop, if the pointer only passed over
     Men on its way here. The pointer never left the bar, so without this the
     header's own mouseleave never fired and Men's columns stayed open under
     Wholesale. */
  const leaveMega = useCallback(() => {
    clearHover();
    setMegaPanel(null);
  }, [clearHover]);

  function toggleSearch() {
    clearHover();
    setMegaPanel(null);
    setSearchOpen((value) => !value);
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const term = query.trim();

    router.push(term ? `/shop?q=${encodeURIComponent(term)}` : '/shop');
    setSearchOpen(false);
  }

  // `--over` is the transparent state the bar holds over the top of the
  // campaign on a desktop window; the stylesheet keeps it to that breakpoint.
  // `--menu` is the solid paper the bar goes when the shop sheet drops, so the
  // two read as one white surface. Search needs no bar state at all: its sheet
  // covers the window, bar included.
  const classes = [
    'hm-head',
    homeFonts,
    over && !scrolled && !panel ? 'hm-head--over' : '',
    scrolled ? 'hm-head--compact' : '',
    megaOpen && !searchOpen ? 'hm-head--menu' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <header ref={headRef} className={classes} onMouseLeave={hoverClose}>
        <div className="hm-head__bar">
          <div className="hm-head__left" onMouseEnter={leaveMega}>
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
          </div>

          <nav aria-label="Main" className="hm-nav">
            <LayoutGroup id="hm-nav">
              <ul onMouseLeave={() => setHovered(null)}>
                {PRIMARY_NAV.map((item, index) => {
                  const key = PANEL_BY_HREF[item.href];

                  return (
                    <li
                      key={item.href}
                      className="hm-nav__item"
                      onMouseEnter={() => setHovered(index)}
                      onFocus={() => setHovered(index)}
                      onBlur={() => setHovered(null)}
                    >
                      {key ? (
                        <Link
                          href={item.href}
                          className="hm-nav__link"
                          aria-expanded={megaPanel === key}
                          aria-controls="shop-mega"
                          onClick={leaveMega}
                          onMouseEnter={() => hoverOpen(key)}
                          onFocus={() => hoverOpen(key)}
                        >
                          {item.label}
                        </Link>
                      ) : (
                        <Link
                          href={item.href}
                          className="hm-nav__link"
                          onMouseEnter={leaveMega}
                          onFocus={leaveMega}
                        >
                          {item.label}
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

          <div className="hm-head__utils" onMouseEnter={leaveMega}>
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
              <span className="visually-hidden">Search</span>
            </button>

            <Link href={signedIn ? '/account' : '/login'} className="hm-util hm-util--account">
              <AccountIcon className="hm-util__icon" />
              <span className="visually-hidden">{signedIn ? 'Account' : 'Sign in'}</span>
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

        <HomeMegaMenu menu={menu} panel={megaPanel} id="shop-mega" onNavigate={closeMega} />
      </header>

      <div
        className={`hm-scrim${megaOpen && !searchOpen ? ' is-open is-soft' : ''}`}
        aria-hidden="true"
        onClick={closePanels}
      />

      {/* The search sheet: the whole window, the field centred across the top
          of it, and the catalogue laid out underneath as cards — the whole of
          it until a query narrows it. A drop that covered half the screen was
          neither a panel nor a page; this is a page.

          Rendered beside the header rather than inside it, so no filter or
          transform the bar ever takes can make it the containing block for a
          fixed child and shrink the sheet to the height of the bar. */}
      <div
        id="site-search"
        className={`hm-search ${homeFonts}${searchOpen ? ' is-open' : ''}`}
        inert={!searchOpen}
        data-lenis-prevent
      >
        <div className="hm-search__sheet">
          <div className="hm-search__top">
            <form className="hm-search__form" role="search" onSubmit={submitSearch}>
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
            </form>

            <button
              type="button"
              className="hm-search__close"
              onClick={() => setSearchOpen(false)}
            >
              <Roll>Close</Roll>
              <span className="hm-search__x" aria-hidden="true" />
            </button>
          </div>

          <div className="hm-search__results">
            <p className="hm-search__count" aria-live="polite">
              {query.trim()
                ? `${results.length} ${results.length === 1 ? 'result' : 'results'} for “${query.trim()}”`
                : 'Everything in the shop'}
            </p>

            {results.length ? (
              <ul className="hm-search__grid">
                {results.map((product, index) => (
                  <li key={product.id} className="hm-search__cell">
                    <ProductCard product={product} index={index} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hm-search__empty">
                Nothing matches that yet. Try a colour, a fit, or{' '}
                <Link href="/shop" onClick={() => setSearchOpen(false)}>
                  browse the shop
                </Link>
                .
              </p>
            )}
          </div>
        </div>
      </div>

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
