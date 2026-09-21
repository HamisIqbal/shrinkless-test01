'use client';

import { useEffect, useState } from 'react';
import { SlotMedia } from '@/components/site/SlotMedia';
import Link from 'next/link';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import type { ShopMenu } from '@/lib/shop/navigation';

/** Which bar word the sheet is currently speaking for. */
export type PanelKey = 'shop' | 'men' | 'women';

type Props = {
  menu: ShopMenu;
  /** The open panel, or null while the sheet is shut. */
  panel: PanelKey | null;
  id: string;
  onNavigate: () => void;
};

/** The three bar words that open the sheet, by the route they point at. */
export const PANEL_BY_HREF: Record<string, PanelKey> = {
  '/shop': 'shop',
  '/shop/men': 'men',
  '/shop/women': 'women',
};

type Column = {
  key: string;
  /** Omitted on a column that is only a photograph. */
  label?: string;
  href: string;
  /** A column with links carries the plus and can be opened; Wholesale cannot. */
  links?: { label: string; href: string }[];
  /** `men` or `women` — the photograph the admin published for that category. */
  feature?: string;
};

/**
 * One set of columns per bar word.
 *
 * Shop is the way in to all four destinations. Men and Women are the same
 * sheet narrowed to one of them: the category first with its own list, the
 * routes a shopper in that category would actually want next, and the
 * category's photograph holding the last column. The lists are a single entry
 * today because a single entry is what the store sells; they are data rather
 * than markup so the day there are more is an edit here.
 *
 * Exported because the phone drawer reads the same set: the menu a shopper
 * meets on a phone should be the menu they meet on a desktop, and two copies
 * of it would drift apart the first time one is edited.
 */
export const PANELS: Record<PanelKey, Column[]> = {
  shop: [
    { key: 'all', label: 'Shop all', href: '/shop', links: [{ label: 'Tees', href: '/shop' }] },
    {
      key: 'men',
      label: 'Men',
      href: '/shop/men',
      links: [{ label: 'Tees', href: '/shop/men' }],
      feature: 'men',
    },
    {
      key: 'women',
      label: 'Women',
      href: '/shop/women',
      links: [{ label: 'Tees', href: '/shop/women' }],
      feature: 'women',
    },
    { key: 'wholesale', label: 'Wholesale', href: '/wholesale' },
  ],
  men: [
    {
      key: 'men-all',
      label: 'Shop all men',
      href: '/shop/men',
      links: [{ label: 'Tees', href: '/shop/men' }],
    },
    {
      key: 'men-shop',
      label: 'The full shop',
      href: '/shop',
      links: [{ label: 'Tees', href: '/shop' }],
    },
    { key: 'men-wholesale', label: 'Wholesale', href: '/wholesale' },
    { key: 'men-feature', href: '/shop/men', feature: 'men' },
  ],
  women: [
    {
      key: 'women-all',
      label: 'Shop all women',
      href: '/shop/women',
      links: [{ label: 'Tees', href: '/shop/women' }],
    },
    {
      key: 'women-shop',
      label: 'The full shop',
      href: '/shop',
      links: [{ label: 'Tees', href: '/shop' }],
    },
    { key: 'women-wholesale', label: 'Wholesale', href: '/wholesale' },
    { key: 'women-feature', href: '/shop/women', feature: 'women' },
  ],
};

const CURTAIN = [0.76, 0, 0.24, 1] as const;
const LAND = [0.16, 1, 0.3, 1] as const;

/* The sheet drops like a blind; its columns rise through their own masks a
   beat behind it. Closing is quicker and unstaggered — leaving should never be
   the slow part. */
const sheet: Variants = {
  open: {
    clipPath: 'inset(0% 0% 0% 0%)',
    transition: { duration: 0.55, ease: CURTAIN, delayChildren: 0.14, staggerChildren: 0.05 },
  },
  closed: {
    clipPath: 'inset(0% 0% 100% 0%)',
    transition: { duration: 0.4, ease: CURTAIN, delay: 0.05 },
  },
};

const rise: Variants = {
  open: { y: '0%', opacity: 1, transition: { duration: 0.7, ease: LAND } },
  closed: { y: '105%', opacity: 0, transition: { duration: 0.2 } },
};

/**
 * The homepage's shop sheet: white, under the masthead, the whole width of the
 * screen, its destinations set out as columns with a photograph inside the
 * columns that have one.
 *
 * Shop, Men and Women each open it with their own set of columns, so the bar
 * word a shopper reached for is the one the sheet answers. Swapping between
 * those three re-runs the columns' stagger without dropping the sheet: the
 * blind stays down and its contents change under it.
 *
 * A column with a list carries a plus. Where hovering is a real gesture the
 * list opens on hover and the label stays a plain link. Where it is not — a
 * touchscreen wide enough for this sheet — the first tap on a column opens its
 * list and the second follows the link, so nothing becomes unreachable in
 * exchange for the reveal. The plus toggles either way, and it is a plain plus
 * that becomes a plain cross: no disc, no ornament.
 *
 * Mounted throughout so both directions animate, and `inert` while closed so
 * its links cannot be tabbed into. The header owns the open state.
 */
export function HomeMegaMenu({ menu, panel, id, onNavigate }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [hoverable, setHoverable] = useState(false);
  const [wasPanel, setWasPanel] = useState(panel);
  // Held one beat past the close, so the sheet does not empty out for the
  // length of the blind going back up.
  const [shown, setShown] = useState<PanelKey>(panel ?? 'shop');

  const open = panel !== null;

  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine)');
    const read = () => setHoverable(query.matches);

    read();
    query.addEventListener('change', read);
    return () => query.removeEventListener('change', read);
  }, []);

  // A sheet that reopens should reopen shut, not on whatever was last read,
  // and one that changes panel should drop the old panel's open column.
  // Adjusted during render rather than in an effect: the collapse belongs to
  // the same paint that changes the sheet, and an effect would show the stale
  // column for a frame.
  if (wasPanel !== panel) {
    setWasPanel(panel);
    setExpanded(null);
    if (panel) setShown(panel);
  }

  const columns = PANELS[shown];

  return (
    <motion.div
      id={id}
      className={`hm-mega${open ? ' is-open' : ''}`}
      inert={!open}
      aria-label="Shop"
      initial={false}
      animate={open ? 'open' : 'closed'}
      variants={sheet}
      data-lenis-prevent
      onMouseLeave={() => {
        if (hoverable) setExpanded(null);
      }}
    >
      <nav className="hm-mega__inner" aria-label="Shop">
        {/* Keyed on the panel so swapping bar words re-runs the stagger. */}
        <ul className="hm-mega__cols" key={shown}>
          {columns.map((column) => {
            const isOpen = expanded === column.key;
            const subId = `${id}-${column.key}`;
            // The photograph is the admin's, read off the menu the layout has
            // already built rather than hard-coded here.
            const feature = column.feature
              ? menu.features.find((item) => item.href === `/shop/${column.feature}`)
              : undefined;

            return (
              <motion.li
                key={column.key}
                className={[
                  'hm-mega__col',
                  isOpen ? 'is-open' : '',
                  column.label ? '' : 'hm-mega__col--figure',
                ]
                  .filter(Boolean)
                  .join(' ')}
                variants={rise}
                onMouseEnter={() => {
                  if (hoverable) setExpanded(column.links ? column.key : null);
                }}
              >
                {column.label ? (
                  <div className="hm-mega__head">
                    <Link
                      href={column.href}
                      className="hm-mega__item"
                      onClick={(event) => {
                        // Touch: the first tap reveals, the next one follows.
                        if (column.links && !hoverable && !isOpen) {
                          event.preventDefault();
                          setExpanded(column.key);
                          return;
                        }
                        onNavigate();
                      }}
                    >
                      <span>{column.label}</span>
                    </Link>

                    {column.links ? (
                      <button
                        type="button"
                        className="hm-mega__plus"
                        aria-expanded={isOpen}
                        aria-controls={subId}
                        onClick={() => setExpanded(isOpen ? null : column.key)}
                      >
                        <span className="hm-mega__sign" aria-hidden="true">
                          {isOpen ? '×' : '+'}
                        </span>
                        <span className="visually-hidden">
                          {isOpen
                            ? `Hide ${column.label} products`
                            : `Show ${column.label} products`}
                        </span>
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <AnimatePresence initial={false}>
                  {column.links && isOpen ? (
                    <motion.div
                      id={subId}
                      className="hm-mega__sub"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.45, ease: LAND }}
                    >
                      <ul className="hm-mega__sublist">
                        {column.links.map((link) => (
                          <li key={`${column.key}-${link.href}-${link.label}`}>
                            <Link href={link.href} className="hm-mega__sublink" onClick={onNavigate}>
                              {link.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                {feature ? (
                  <Link href={feature.href} className="hm-mega__figure" onClick={onNavigate}>
                    <span className="hm-mega__frame">
                      <SlotMedia
                        src={feature.image.url}
                        alt={feature.image.alt}
                        fill
                        loading="lazy"
                        sizes="(min-width: 62rem) 22vw, 0px"
                        className="hm-mega__photo"
                      />
                    </span>
                  </Link>
                ) : null}
              </motion.li>
            );
          })}
        </ul>
      </nav>
    </motion.div>
  );
}
