'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import { PRIMARY_NAV, type ShopMenu } from '@/lib/shop/navigation';
import { PANELS, PANEL_BY_HREF } from '@/components/home/HomeMegaMenu';
import { homeFonts } from '@/components/home/fonts';

type Props = {
  menu: ShopMenu;
  open: boolean;
  onClose: () => void;
  itemCount: number;
  signedIn: boolean;
  isAdmin: boolean;
  storeEmail: string;
  /** Closes the drawer and raises the cart sheet over it. */
  onOpenCart: () => void;
};

const CURTAIN = [0.76, 0, 0.24, 1] as const;
const LAND = [0.16, 1, 0.3, 1] as const;

const sheet: Variants = {
  open: {
    clipPath: 'inset(0% 0% 0% 0%)',
    transition: { duration: 0.75, ease: CURTAIN, delayChildren: 0.25, staggerChildren: 0.055 },
  },
  closed: {
    clipPath: 'inset(0% 0% 100% 0%)',
    transition: { duration: 0.55, ease: CURTAIN },
  },
};

const rise: Variants = {
  open: { y: '0%', transition: { duration: 0.9, ease: LAND } },
  closed: { y: '110%', transition: { duration: 0.2 } },
};

const fade: Variants = {
  open: { opacity: 1, y: 0, transition: { duration: 0.8, ease: LAND } },
  closed: { opacity: 0, y: 16, transition: { duration: 0.2 } },
};

/**
 * The homepage's phone menu: a full-screen paper sheet that drops from the top.
 *
 * Same contract as the shop drawer — accordions for the columns, a focus
 * trap, Escape to close, the page locked behind it — with the categories set
 * large and rising into place, and the two category frames at the foot.
 *
 * White with ink type rather than the ink sheet it was: it carries the same
 * five words and the same columns as the desktop bar and its sheet, and the
 * two should read as one menu rendered at two sizes. Each row that has a list
 * carries a plain plus that becomes a plain cross — no disc around it, the
 * same mark the desktop sheet uses.
 */
export function HomeDrawer({
  menu,
  open,
  onClose,
  itemCount,
  signedIn,
  isAdmin,
  storeEmail,
  onOpenCart,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    const previous = document.activeElement as HTMLElement | null;

    function focusable(): HTMLElement[] {
      if (!panel) return [];
      return [
        ...panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((node) => node.offsetParent !== null);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const nodes = focusable();
      if (!nodes.length) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const raf = requestAnimationFrame(() => focusable()[0]?.focus());

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      cancelAnimationFrame(raf);
      previous?.focus?.();
    };
  }, [open, onClose]);

  // Collapse the accordions behind the closing animation.
  useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => setExpanded(null), 500);
    return () => window.clearTimeout(timer);
  }, [open]);

  // The same five words as the desktop bar, opening the same columns the
  // desktop sheet opens. A phone should not be offered a different shop.
  const rows = PRIMARY_NAV.map((item) => {
    const key = PANEL_BY_HREF[item.href];
    const links = key
      ? PANELS[key]
          .filter((column) => column.label)
          .map((column) => ({ label: column.label as string, href: column.href }))
      : [];

    return { key: item.href, href: item.href, label: item.label, links };
  });

  return (
    <div className={`hm-drawer ${homeFonts}${open ? ' is-open' : ''}`}>
      <motion.div
        className="hm-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        inert={!open}
        initial={false}
        animate={open ? 'open' : 'closed'}
        variants={sheet}
        data-lenis-prevent
      >
        <div className="hm-drawer__bar">
          <p id={titleId} className="hm-drawer__title">Menu</p>

          <button type="button" className="hm-drawer__close" onClick={onClose}>
            Close
            <span className="hm-drawer__x" aria-hidden="true" />
          </button>
        </div>

        <div className="hm-drawer__scroll">
          <ul className="hm-drawer__list">
            {rows.map((row) => {
              const isOpen = expanded === row.key;

              return (
                <li key={row.key} className="hm-drawer__item">
                  <div className="hm-drawer__row">
                    <div className="hm-mask">
                      <motion.div variants={rise}>
                        <Link href={row.href} className="hm-drawer__link" onClick={onClose}>
                          {row.label}
                        </Link>
                      </motion.div>
                    </div>

                    {row.links.length ? (
                      <button
                        type="button"
                        className="hm-drawer__expand"
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${row.label}`}
                        onClick={() => setExpanded(isOpen ? null : row.key)}
                      >
                        <span className="hm-drawer__sign" aria-hidden="true">
                          {isOpen ? '×' : '+'}
                        </span>
                      </button>
                    ) : null}
                  </div>

                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <motion.div
                        className="hm-drawer__sub"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.5, ease: LAND }}
                      >
                        <ul className="hm-drawer__subinner">
                          {row.links.map((link) => (
                            <li key={`${row.key}-${link.href}-${link.label}`}>
                              <Link href={link.href} className="hm-drawer__sublink" onClick={onClose}>
                                {link.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>

          {menu.features.length ? (
            <motion.div className="hm-drawer__features" variants={fade}>
              {menu.features.map((feature) => (
                <Link key={feature.href} href={feature.href} className="hm-drawer__feature" onClick={onClose}>
                  <span className="hm-drawer__frame">
                    <Image
                      src={feature.image.url}
                      alt={feature.image.alt}
                      fill
                      loading="lazy"
                      sizes="(max-width: 61.9375rem) 45vw, 0px"
                    />
                  </span>
                  <span className="hm-drawer__featurefoot">
                    <span>{feature.label}</span>
                    <span className="hm-drawer__caption">{feature.caption}</span>
                  </span>
                </Link>
              ))}
            </motion.div>
          ) : null}

          <motion.div className="hm-drawer__foot" variants={fade}>
            {isAdmin ? (
              <Link href="/admin" className="hm-drawer__util" onClick={onClose}>Admin</Link>
            ) : null}
            <Link href={signedIn ? '/account' : '/login'} className="hm-drawer__util" onClick={onClose}>
              {signedIn ? 'Account' : 'Sign in'}
            </Link>
            <button type="button" className="hm-drawer__util" onClick={onOpenCart}>
              Bag<span className="tnum"> ({itemCount})</span>
            </button>
            <a href={`mailto:${storeEmail}`} className="hm-drawer__util">Contact</a>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
