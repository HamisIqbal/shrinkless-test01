'use client';

import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import '@/components/shop/shop.css';

export type FaqItem = { q: string; a: string };

/**
 * The questions, with an index of them standing alongside.
 *
 * This was one flat column of eight identical rows. You could not see what was
 * in the list without reading all of it, and on a wide screen each answer ran
 * the full width of the page.
 *
 * The index is the questions themselves rather than invented topic headings.
 * All eight are the admin's to rewrite on the Content tab, so a grouping baked
 * in here — Sizing, Care, Shipping — would be wrong the first time one of them
 * changed into a question about something else.
 *
 * Picking one from the index opens it and takes you to it; the row itself
 * still toggles. Several answers can be open at once, which is the point of a
 * page somebody is comparing facts on — unlike the spec sheet on a product
 * page, where only one thing is being read at a time.
 */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set());
  const rows = useRef<(HTMLLIElement | null)[]>([]);

  function toggle(index: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function jump(index: number) {
    setOpen((prev) => new Set(prev).add(index));

    rows.current[index]?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
      block: 'start',
    });
  }

  return (
    <div className="sh-faq__layout">
      {/* Hidden below the column breakpoint, where the list of answers is
          already the whole width and an index of it would just be the same
          eight lines twice. */}
      <nav className="sh-faq__index" aria-label="Questions on this page">
        <p className="sh-label sh-faq__indexlabel">On this page</p>
        {items.map((item, index) => (
          <button
            key={item.q}
            type="button"
            className={`sh-faq__jump${open.has(index) ? ' sh-faq__jump--on' : ''}`}
            onClick={() => jump(index)}
          >
            {item.q}
          </button>
        ))}
      </nav>

      <ul className="sh-faq__list">
        {items.map((item, index) => {
          const isOpen = open.has(index);
          const panelId = `faq-panel-${index}`;

          return (
            <li
              key={item.q}
              className="sh-faq__item"
              ref={(node) => {
                rows.current[index] = node;
              }}
            >
              <button
                type="button"
                className="sh-faq__row"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(index)}
              >
                <span>{item.q}</span>
                <span className="sh-faq__mark" data-open={isOpen} aria-hidden="true" />
              </button>

              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    id={panelId}
                    className="sh-faq__panel"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.32, ease: [0.16, 0.84, 0.44, 1] }}
                  >
                    <p className="sh-faq__answer">{item.a}</p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
