'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Publishes the footer's height to CSS so the page above it can reserve
 * exactly that much room and slide away to reveal it.
 *
 * The footer is fixed to the bottom of the viewport and the page scrolls over
 * the top of it, so the reveal needs a real measurement — the footer's height
 * depends on the store email, the column contents and the viewport width, and
 * a hard-coded value would either clip the footer or leave a gap under the
 * page. A ResizeObserver keeps it right through a font swap or a rotate.
 *
 * The effect itself is gated to desktop in CSS. On a phone the footer is most
 * of a screen tall, and reserving that much space below every page would mean
 * scrolling through a hole to reach it.
 *
 * A pinned footer can only ever show its last viewport-worth of itself, so the
 * colophon is built to fit a short window rather than the reveal being given
 * up on one — see the viewport-relative block in storefront.css.
 */
export function FooterReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const publish = () => {
      document.documentElement.style.setProperty(
        '--footer-h',
        `${Math.round(node.getBoundingClientRect().height)}px`,
      );
    };

    publish();

    const observer = new ResizeObserver(publish);
    observer.observe(node);

    // The footer's height is viewport-relative now, so a resize that does not
    // reflow it can still change it.
    window.addEventListener('resize', publish);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', publish);
      document.documentElement.style.removeProperty('--footer-h');
    };
  }, []);

  return (
    <div className="footerdock" ref={ref}>
      {children}
    </div>
  );
}
