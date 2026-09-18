'use client';

import { useState, type ReactNode } from 'react';
import { ANNOUNCE_COOKIE, ANNOUNCE_MAX_AGE, announcementTag } from '@/lib/shop/announcement';
import { homeMono } from '@/components/home/fonts';

/**
 * The bar's close button, and the only part of the bar that is client-side.
 *
 * Unmounting the whole bar from here is what keeps the page arithmetic honest:
 * `hm-core.css` gives `--hm-announce` a real height only while a `.announce`
 * is actually in the shell, so the campaign's fold follows the bar down
 * without a line of JavaScript knowing about the campaign.
 */
export function AnnounceDismiss({ message, children }: { message: string; children: ReactNode }) {
  const [shown, setShown] = useState(true);

  if (!shown) return null;

  const close = () => {
    // Written here rather than by a server action: the value is not a secret,
    // nothing else depends on it, and a round trip to put a bar away would be
    // a network request the shopper can see.
    document.cookie = [
      `${ANNOUNCE_COOKIE}=${announcementTag(message)}`,
      'path=/',
      `max-age=${ANNOUNCE_MAX_AGE}`,
      'samesite=lax',
    ].join('; ');

    setShown(false);
  };

  return (
    <div className={`announce ${homeMono}`}>
      {children}

      <button type="button" className="announce__close" onClick={close}>
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="announce__x">
          <path d="M3 3 13 13M13 3 3 13" stroke="currentColor" strokeWidth="1.4" fill="none" />
        </svg>
        <span className="visually-hidden">Close announcement</span>
      </button>
    </div>
  );
}
