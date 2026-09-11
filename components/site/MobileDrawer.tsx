'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import type { ShopMenu } from '@/lib/shop/navigation';

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

/**
 * Full-height drawer, entering from the right over a dimmed page.
 *
 * Deliberately not the desktop menu at a smaller size: the columns become
 * accordions, the categories get thumb-sized rows, and the whole thing scrolls
 * inside itself so a long catalogue never pushes the close button off screen.
 *
 * Focus is trapped while it is open, because a drawer that covers the page but
 * still lets Tab wander behind it is worse than no drawer.
 */
export function MobileDrawer({
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

    // Wait a frame: the panel is still translated off-screen on the tick the
    // class lands, and focusing a node with no layout box does nothing.
    const raf = requestAnimationFrame(() => focusable()[0]?.focus());

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      cancelAnimationFrame(raf);
      previous?.focus?.();
    };
  }, [open, onClose]);

  // Collapse the accordions behind the closing animation, so reopening the
  // drawer always starts from the same place.
  useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => setExpanded(null), 400);
    return () => window.clearTimeout(timer);
  }, [open]);

  return (
    <div className={`drawer${open ? ' drawer--open' : ''}`}>
      <button
        type="button"
        className="drawer__scrim"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
      />

      <div
        className="drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        inert={!open}
      >
        <div className="drawer__bar">
          <p id={titleId} className="meta drawer__title">Menu</p>

          <button type="button" className="drawer__close" onClick={onClose}>
            <span className="drawer__closemark" aria-hidden="true" />
            Close
          </button>
        </div>

        <div className="drawer__scroll">
          <ul className="drawer__list">
            {menu.columns.map((column) => {
              const isOpen = expanded === column.title;

              return (
                <li key={column.title} className="drawer__item">
                  <div className="drawer__row">
                    <Link
                      href={column.href ?? '/shop'}
                      className="drawer__link"
                      onClick={onClose}
                    >
                      {column.title}
                    </Link>

                    <button
                      type="button"
                      className="drawer__expand"
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${column.title}`}
                      onClick={() => setExpanded(isOpen ? null : column.title)}
                    >
                      <span className="drawer__plus" aria-hidden="true" />
                    </button>
                  </div>

                  <div className={`drawer__sub${isOpen ? ' drawer__sub--open' : ''}`}>
                    <ul className="drawer__subinner">
                      {column.links.map((link) => (
                        <li key={`${column.title}-${link.href}-${link.label}`}>
                          <Link href={link.href} className="drawer__sublink" onClick={onClose}>
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              );
            })}

            <li className="drawer__item">
              <div className="drawer__row">
                <Link href="/wholesale" className="drawer__link" onClick={onClose}>
                  Wholesale
                </Link>
              </div>
            </li>

            <li className="drawer__item">
              <div className="drawer__row">
                <Link href="/our-story" className="drawer__link" onClick={onClose}>
                  About Us
                </Link>
              </div>
            </li>
          </ul>

          <div className="drawer__foot">
            {isAdmin ? (
              <Link href="/admin" className="adminlink" onClick={onClose}>
                Admin
              </Link>
            ) : null}
            <Link
              href={signedIn ? '/account' : '/login'}
              className="ulink"
              onClick={onClose}
            >
              {signedIn ? 'Account' : 'Sign in'}
            </Link>
            <button type="button" className="ulink drawer__cart" onClick={onOpenCart}>
              Cart<span className="tnum"> ({itemCount})</span>
            </button>
            <a href={`mailto:${storeEmail}`} className="ulink">Contact</a>
          </div>
        </div>
      </div>
    </div>
  );
}
