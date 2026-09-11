'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

export type FaqItem = { q: string; a: string };

/**
 * A flat, continuous question list. Each row opens independently — there is
 * no accordion-group exclusivity here, unlike the spec-sheet `<details>`
 * version on product pages, so several answers can stay open at once.
 */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set());

  function toggle(index: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <ul className="faqlist">
      {items.map((item, index) => {
        const isOpen = open.has(index);
        const panelId = `faq-panel-${index}`;

        return (
          <li key={item.q} className="faqlist__item">
            <button
              type="button"
              className="faqlist__row"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggle(index)}
            >
              <span>{item.q}</span>
              <span className="faqlist__mark" data-open={isOpen} aria-hidden="true" />
            </button>

            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  id={panelId}
                  className="faqlist__panel"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.32, ease: [0.16, 0.84, 0.44, 1] }}
                >
                  <p className="faqlist__answer">{item.a}</p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
