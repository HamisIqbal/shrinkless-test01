'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useReducedMotion } from 'motion/react';
import { InstagramIcon } from '@/components/site/icons';
import type { InstagramPost } from '@/lib/brand/instagram';

/**
 * The Instagram rail: a band you can push around yourself, that also drifts
 * along on its own when you leave it alone.
 *
 * This used to be a CSS marquee — `animation: iglane-roll` translating the
 * rail by half its own width. A transform and a scrollbar cannot share an
 * element: the animation owns the position, so a drag or a trackpad swipe
 * either did nothing or fought the keyframes for the same pixels. So the
 * movement moved from `transform` to `scrollLeft`. The browser owns the
 * position now, which is what makes touch swipes, trackpad gestures, drag and
 * tabbing to a tile all work without a line of code each.
 *
 * The endlessness is three copies of the set and a parking rule. The scroll
 * position is kept inside the middle copy, so there is always a whole set of
 * posts either side of you — run off the end and the position steps back by
 * exactly one set, onto identical pixels. Two copies are enough going
 * forwards but leave nothing behind you: drag left on a two-copy rail and it
 * slams into `scrollLeft: 0` after a few tiles.
 *
 * Copies 2 and 3 are `aria-hidden` and their links `tabIndex={-1}`, so a
 * screen reader and the keyboard meet each post exactly once. They are NOT
 * `inert` — inert kills pointer events too, and since every copy scrolls
 * through view, that is what made most of the visible tiles unclickable.
 */

/** Pixels per second. Slow enough to read a photograph as it goes past. */
const SPEED = 26;

/** How long the rail waits after you touch it before drifting again. */
const IDLE_MS = 2000;

/** A press that travels further than this was a drag, not a click. */
const DRAG_SLOP = 6;

/**
 * Copies of the post set on the rail. Three is the fewest that scrolls
 * endlessly in both directions — see the note above.
 */
const COPIES = [0, 1, 2];

export function InstagramRail({ posts }: { posts: InstagramPost[] }) {
  const reduced = useReducedMotion();
  const portRef = useRef<HTMLDivElement>(null);

  // The only thing the markup depends on: the grabbing cursor.
  const [dragging, setDragging] = useState(false);

  // Everything else changes every frame or every pointer move, so it lives in
  // refs. Putting any of it in state would re-render the rail sixty times a
  // second to draw exactly the same tiles.
  const holdUntil = useRef(0);
  const hovering = useRef(false);
  const focused = useRef(false);
  const drag = useRef<{ id: number; x: number; from: number; travelled: number } | null>(null);
  const swallowClick = useRef(false);

  /** Postpone the drift. Called by every gesture that moves the rail. */
  const hold = () => {
    holdUntil.current = performance.now() + IDLE_MS;
  };

  useEffect(() => {
    const port = portRef.current;
    if (!port) return;

    let frame = 0;
    let last = 0;
    let onScreen = true;

    /**
     * Keep the scroll position inside the middle copy. Returns the shift it
     * applied, because a drag in progress measures from an origin that the
     * shift has just invalidated.
     */
    const park = (): number => {
      const unit = port.scrollWidth / COPIES.length;
      // A rail no wider than its own port cannot loop: the browser clamps
      // `scrollLeft` before it ever reaches the far parking line.
      if (unit <= 0 || unit < port.clientWidth) return 0;

      let shift = 0;
      if (port.scrollLeft >= unit * 2) shift = -unit;
      else if (port.scrollLeft < unit) shift = unit;

      if (shift !== 0) port.scrollLeft += shift;
      return shift;
    };

    const step = (now: number) => {
      frame = requestAnimationFrame(step);

      const elapsed = last === 0 ? 0 : now - last;
      last = now;

      const shift = park();
      if (shift !== 0 && drag.current) drag.current.from += shift;

      if (reduced || !onScreen) return;
      if (drag.current || hovering.current || focused.current) return;
      if (now < holdUntil.current) return;
      // A tab that has been in the background hands back one enormous delta
      // on its first frame. Drop it rather than lurching the rail forward.
      if (elapsed <= 0 || elapsed > 100) return;

      port.scrollLeft += (SPEED * elapsed) / 1000;
    };

    // Off-screen rails do no work. The drift is decoration; it is not worth a
    // wakeup sixty times a second for a band nobody has scrolled to yet.
    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
      },
      { rootMargin: '200px' },
    );
    observer.observe(port);

    // Coming back from a background tab, restart the clock so the first frame
    // measures a sane delta rather than the length of the absence.
    const onVisibility = () => {
      last = 0;
    };
    document.addEventListener('visibilitychange', onVisibility);

    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reduced]);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    // Touch and pen already pan this element natively, with momentum and
    // rubber-banding the browser does better than we would. Mouse only.
    if (event.pointerType !== 'mouse' || event.button !== 0) return;

    const port = portRef.current;
    if (!port) return;

    drag.current = { id: event.pointerId, x: event.clientX, from: port.scrollLeft, travelled: 0 };
    swallowClick.current = false;
    port.setPointerCapture(event.pointerId);
    setDragging(true);
    hold();
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    const port = portRef.current;
    if (!current || !port || current.id !== event.pointerId) return;

    const travelled = event.clientX - current.x;
    current.travelled = Math.max(current.travelled, Math.abs(travelled));
    port.scrollLeft = current.from - travelled;
    hold();
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;

    // A drag that happens to end over a tile must not also open that post.
    swallowClick.current = current.travelled > DRAG_SLOP;
    drag.current = null;
    setDragging(false);
    hold();

    const port = portRef.current;
    if (port?.hasPointerCapture(event.pointerId)) port.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      ref={portRef}
      className={dragging ? 'iglane__port is-dragging' : 'iglane__port'}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerEnter={() => {
        hovering.current = true;
      }}
      onPointerLeave={() => {
        hovering.current = false;
      }}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
      }}
      onWheel={hold}
      onTouchStart={hold}
      onTouchMove={hold}
      onClickCapture={(event) => {
        if (!swallowClick.current) return;
        swallowClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div className="iglane__track">
        {COPIES.map((copy) => (
          <div className="iglane__set" key={copy} aria-hidden={copy > 0 || undefined}>
            {posts.map((post) => (
              <a
                key={`${copy}-${post.id}`}
                href={post.permalink}
                className="iglane__tile"
                rel="noreferrer"
                target="_blank"
                tabIndex={copy > 0 ? -1 : undefined}
                /* A link is draggable by default, and a browser that starts
                   dragging one cancels the pointer stream mid-gesture — the
                   rail would stick the moment you pressed on a tile. */
                draggable={false}
              >
                <Image
                  src={post.imageUrl}
                  alt={copy > 0 ? '' : post.alt}
                  width={640}
                  height={640}
                  loading="lazy"
                  draggable={false}
                  className="iglane__image"
                />
                <span className="iglane__mark" aria-hidden="true">
                  <InstagramIcon />
                </span>
              </a>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
