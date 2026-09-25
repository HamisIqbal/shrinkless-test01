'use client';

import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { homeFonts } from '@/components/home/fonts';
import { CloseIcon } from '@/components/site/icons';
import './shop.css';

/** "Are we on the client yet?" — see the same three lines in CartSheet. */
const subscribeToNothing = () => () => {};
const onClient = () => true;
const onServer = () => false;

type Props = {
  id: string;
  open: boolean;
  onClose: () => void;
  /** Styles the current filters leave, for the button that closes the drawer. */
  total: number;
  /** How many filters are on, for the title and Clear all. */
  applied: number;
  onClear: () => void;
  /** A filter is on its way to the server; the count is about to change. */
  pending: boolean;
  children: ReactNode;
};

/**
 * The collection's filters, as a drawer from the left edge — the cart's
 * drawer, mirrored, so the two surfaces a shopper opens over the grid behave
 * the same way: a scrim, Escape, a cross, focus held inside while it is open
 * and handed back when it closes.
 *
 * Every choice applies as it is made, and the grid behind updates under the
 * scrim, so the button at the foot is "show me", not "apply": it states how
 * many styles are left and closes the drawer on them.
 *
 * Rendered into `document.body` for the reason CartSheet gives: its natural
 * home is inside the page slab, which clips on desktop.
 */
export function FilterDrawer({ id, open, onClose, total, applied, onClear, pending, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const mounted = useSyncExternalStore(subscribeToNothing, onClient, onServer);

  useEffect(() => {
    // The portal does not exist until the client has rendered once, and a
    // drawer can be asked for open on that first render (the header's search).
    if (!open || !mounted) return;

    const panel = panelRef.current;
    const previous = document.activeElement as HTMLElement | null;

    function focusable(): HTMLElement[] {
      if (!panel) return [];
      return [
        ...panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select, [tabindex]:not([tabindex="-1"])',
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

    // The close button, not the search field: landing in a text field would
    // put a keyboard over half a phone's screen before anything was asked.
    // Unless something inside already has it — the search field, when the
    // header's search is what opened the drawer.
    const raf = requestAnimationFrame(() => {
      if (panel?.contains(document.activeElement)) return;
      panel?.querySelector<HTMLElement>('.sh-drawer__close')?.focus();
    });

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      cancelAnimationFrame(raf);
      previous?.focus?.();
    };
  }, [open, onClose, mounted]);

  if (!mounted) return null;

  return createPortal(
    <div className={`sh-drawer ${homeFonts}${open ? ' sh-drawer--open' : ''}`}>
      <button
        type="button"
        className="sh-drawer__scrim"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
      />

      <div
        id={id}
        ref={panelRef}
        className="sh-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        inert={!open}
      >
        <header className="sh-drawer__bar">
          <h2 id={titleId} className="sh-drawer__title">
            Filters
            {applied ? <span className="sh-drawer__badge tnum">{applied}</span> : null}
          </h2>

          <button type="button" className="sh-drawer__close" onClick={onClose}>
            <CloseIcon />
            <span className="visually-hidden">Close filters</span>
          </button>
        </header>

        {/* Lenis owns the wheel globally; without this the drawer's own list
            cannot be scrolled with a trackpad. */}
        <div className="sh-drawer__body" data-lenis-prevent aria-busy={pending}>
          {children}
        </div>

        <footer className="sh-drawer__foot">
          <button
            type="button"
            className="sh-btn sh-btn--ghost"
            onClick={onClear}
            disabled={!applied || pending}
          >
            Clear all
          </button>

          <button type="button" className="sh-btn" onClick={onClose}>
            <span className="tnum" aria-live="polite">
              {pending ? 'Updating' : `Show ${total} ${total === 1 ? 'style' : 'styles'}`}
            </span>
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
