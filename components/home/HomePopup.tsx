'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import { homeFonts } from '@/components/home/fonts';
import './home.css';

/**
 * Shown once per load of the site, not once per mount.
 *
 * A module-level flag rather than state: the homepage can be mounted again
 * without the document reloading — a client-side navigation away and back,
 * or React remounting the tree in development — and the announcement should
 * not return each time. A reload clears the module, which is exactly the
 * "once per website load" the brief asks for. Nothing is persisted, so it is
 * deliberately not "once per visitor" either.
 */
let shown = false;

/** A beat after paint, so the pop-up arrives over a page, not over nothing. */
const DELAY = 650;

const CURTAIN = [0.76, 0, 0.24, 1] as const;
const LAND = [0.16, 1, 0.3, 1] as const;

const veil: Variants = {
  open: { opacity: 1, transition: { duration: 0.5, ease: 'linear' } },
  closed: { opacity: 0, transition: { duration: 0.4, ease: 'linear' } },
};

/* The card lands from slightly below and under-scale; leaving is quicker and
   drops rather than rises, so opening and closing never read as the same
   gesture played backwards. */
const card: Variants = {
  open: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.85, ease: LAND, delayChildren: 0.2, staggerChildren: 0.07 },
  },
  closed: {
    opacity: 0,
    y: 18,
    scale: 0.965,
    transition: { duration: 0.35, ease: CURTAIN },
  },
};

const rise: Variants = {
  open: { y: '0%', opacity: 1, transition: { duration: 0.9, ease: LAND } },
  closed: { y: '60%', opacity: 0, transition: { duration: 0.2 } },
};

const grow: Variants = {
  open: { scaleX: 1, transition: { duration: 1.1, ease: LAND } },
  closed: { scaleX: 0, transition: { duration: 0.2 } },
};

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M3 3l10 10M13 3L3 13" fill="none" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

/**
 * The homepage announcement, as a pop-up rather than a bar.
 *
 * Ink card on a blurred page, one screen only, and never taller than the
 * window: the card is a column of three slots — a photograph, a heading and a
 * body — each of which gives up height before the card does, so announcement
 * art and copy can be dropped in later without the card ever gaining a
 * scrollbar of its own. The picture takes what is left after the type and
 * crops to fit; the type is clamped against viewport height.
 *
 * Only the close button is focusable, so the trap below is short: focus goes
 * to it on open, Tab cannot leave the card, Escape and the page behind both
 * close it, and focus returns to wherever it was.
 */
export function HomePopup() {
  const [open, setOpen] = useState(false);

  const closeButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  const close = useCallback(() => setOpen(false), []);

  // The flag is raised when the pop-up actually goes up, not when the timer is
  // set: Strict Mode mounts, unmounts and mounts again, and raising it on the
  // way in would leave the second mount looking at an announcement that had
  // already "been shown" without anyone having seen it.
  useEffect(() => {
    if (shown) return;

    const timer = window.setTimeout(() => {
      shown = true;
      setOpen(true);
    }, DELAY);

    return () => window.clearTimeout(timer);
  }, []);

  // Scroll is locked on the document rather than the body: Lenis drives the
  // window, and an `overflow: hidden` root is what stops it.
  useEffect(() => {
    if (!open) return;

    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';

    opener.current = document.activeElement;
    closeButton.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = panel.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !panel.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);

    return () => {
      root.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open, close]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={`hm-pop ${homeFonts}`}
          initial="closed"
          animate="open"
          exit="closed"
          variants={veil}
          onClick={close}
          data-lenis-prevent
        >
          <motion.div
            ref={panel}
            className="hm-pop__card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hm-pop-title"
            variants={card}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="hm-pop__bar">
              <button
                type="button"
                ref={closeButton}
                className="hm-pop__close"
                onClick={close}
              >
                <CloseIcon />
                <span className="visually-hidden">Close announcement</span>
              </button>
            </div>

            {/* The picture slot. Empty until there is art to put in it, and
                sized off what the type leaves behind so adding one can never
                push the card past the window. */}
            <div className="hm-pop__media" aria-hidden="true" />

            <div className="hm-pop__body">
              <div className="hm-mask">
                <motion.h2 id="hm-pop-title" className="hm-pop__title" variants={rise}>
                  Coming Soon
                </motion.h2>
              </div>

              <motion.span className="hm-pop__rule" aria-hidden="true" variants={grow} />

              {/* Copy goes here. The slot is clamped, so a paragraph or two
                  lands without the card growing a scrollbar. */}
              <div className="hm-pop__copy" />
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
