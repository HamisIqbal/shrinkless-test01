'use client';

import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  /** The element the page's own purchase actions live in. The bar is the
   *  stand-in for that element and appears only once it is above the fold. */
  anchor: RefObject<HTMLElement | null>;
  title: string;
  price: ReactNode;
  /** The same buttons, wired to the same handlers as the ones in `anchor`. */
  children: ReactNode;
};

/**
 * The purchase actions, kept within reach after they have scrolled away.
 *
 * It owns no purchasing logic of its own: the caller passes the buttons it
 * already renders, bound to the handlers it already has, so there is exactly
 * one add-to-cart path on the page.
 *
 * Visibility is a fact about the anchor rather than a scroll threshold — the
 * bar shows while the real actions are out of view *above* the viewport, and
 * hides the moment they are back on screen. It portals to `body` so the fixed
 * footer's stacking context cannot clip it.
 */
export function StickyBuyBar({ anchor, title, price, children }: Props) {
  // One piece of state, written only from the observer's own callback: the
  // element to portal into, and whether the bar is up. `host` stays null until
  // the observer has reported once, which is also what keeps this off the
  // server-rendered markup.
  const [{ host, shown }, setState] = useState<{
    host: HTMLElement | null;
    shown: boolean;
  }>({ host: null, shown: false });

  useEffect(() => {
    const node = anchor.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // `top < 0` keeps the bar away on the way *down* to the actions —
        // otherwise it would be up before the shopper had seen the real ones.
        setState({
          host: document.body,
          shown: !entry.isIntersecting && entry.boundingClientRect.top < 0,
        });
      },
      { threshold: 0 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [anchor]);

  if (!host) return null;

  return createPortal(
    <div className={`buybar${shown ? ' buybar--on' : ''}`} inert={!shown}>
      <div className="buybar__inner">
        <div className="buybar__id">
          <p className="buybar__title">{title}</p>
          <p className="buybar__price tnum">{price}</p>
        </div>
        <div className="buybar__actions">{children}</div>
      </div>
    </div>,
    host,
  );
}
