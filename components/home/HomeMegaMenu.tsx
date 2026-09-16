'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import type { ShopMenu } from '@/lib/shop/navigation';

type Props = {
  menu: ShopMenu;
  open: boolean;
  id: string;
  onNavigate: () => void;
};

type Group = {
  key: string;
  label: string;
  href: string;
  /** A group with links carries the plus and can be opened; Wholesale cannot. */
  links?: { label: string; href: string }[];
  /** Men and Women carry their own photograph inside their column. */
  feature?: string;
};

/**
 * Four destinations, and only four — the panel is a way in, not the shop's
 * index. The lists under the first three are a single entry today because a
 * single entry is what the store sells; they are data rather than markup so
 * the day there are more is an edit here.
 */
const GROUPS: Group[] = [
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
];

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
 * The homepage's shop panel: a white sheet under the masthead, run the whole
 * width of the screen with its four destinations set out as columns — Shop
 * all, Men, Women, Wholesale — and the Men and Women columns each carrying
 * their own photograph beneath the name.
 *
 * Shop all, Men and Women each carry a plus and a list. Where hovering is a
 * real gesture the list opens on hover and the label stays a plain link. Where
 * it is not — a touchscreen wide enough for this panel — the first tap on a
 * column opens its list and the second follows the link, so nothing becomes
 * unreachable in exchange for the reveal. The plus toggles either way, and it
 * is a plain plus that becomes a plain cross: no disc, no ornament.
 *
 * Mounted throughout so both directions animate, and `inert` while closed so
 * its links cannot be tabbed into. The header owns the open state.
 */
export function HomeMegaMenu({ menu, open, id, onNavigate }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [hoverable, setHoverable] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);

  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine)');
    const read = () => setHoverable(query.matches);

    read();
    query.addEventListener('change', read);
    return () => query.removeEventListener('change', read);
  }, []);

  // A panel that reopens should reopen shut, not on whatever was last read.
  // Adjusted during render rather than in an effect: the collapse belongs to
  // the same paint that closes the sheet, and an effect would show the stale
  // column for a frame on the way back in.
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setExpanded(null);
  }

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
        <ul className="hm-mega__cols">
          {GROUPS.map((group) => {
            const isOpen = expanded === group.key;
            const subId = `${id}-${group.key}`;
            // The photograph is the admin's, read off the menu the layout has
            // already built rather than hard-coded here.
            const feature = group.feature
              ? menu.features.find((item) => item.href === `/shop/${group.feature}`)
              : undefined;

            return (
              <motion.li
                key={group.key}
                className={`hm-mega__col${isOpen ? ' is-open' : ''}`}
                variants={rise}
                onMouseEnter={() => {
                  if (hoverable) setExpanded(group.links ? group.key : null);
                }}
              >
                <div className="hm-mega__head">
                  <Link
                    href={group.href}
                    className="hm-mega__item"
                    onClick={(event) => {
                      // Touch: the first tap reveals, the next one follows.
                      if (group.links && !hoverable && !isOpen) {
                        event.preventDefault();
                        setExpanded(group.key);
                        return;
                      }
                      onNavigate();
                    }}
                  >
                    <span>{group.label}</span>
                  </Link>

                  {group.links ? (
                    <button
                      type="button"
                      className="hm-mega__plus"
                      aria-expanded={isOpen}
                      aria-controls={subId}
                      onClick={() => setExpanded(isOpen ? null : group.key)}
                    >
                      <span className="hm-mega__sign" aria-hidden="true">
                        {isOpen ? '×' : '+'}
                      </span>
                      <span className="visually-hidden">
                        {isOpen ? `Hide ${group.label} products` : `Show ${group.label} products`}
                      </span>
                    </button>
                  ) : null}
                </div>

                <AnimatePresence initial={false}>
                  {group.links && isOpen ? (
                    <motion.div
                      id={subId}
                      className="hm-mega__sub"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.45, ease: LAND }}
                    >
                      <ul className="hm-mega__sublist">
                        {group.links.map((link) => (
                          <li key={`${group.key}-${link.href}-${link.label}`}>
                            <Link
                              href={link.href}
                              className="hm-mega__sublink"
                              onClick={onNavigate}
                            >
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
                      <Image
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
