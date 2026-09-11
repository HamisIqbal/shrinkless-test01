'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useReducedMotion } from 'motion/react';
import type { BrandImage } from '@/lib/brand/images';
import { cropStyle } from '@/lib/media/crop';

export type HeroSlide = {
  image: BrandImage;
};

type Props = {
  slides: HeroSlide[];
  eyebrow: string;
  headline: string[];
  lede: string;
  primary: { href: string; label: string };
  secondary: { href: string; label: string };
  /** Milliseconds each frame holds before the next one takes over. */
  interval?: number;
};

/** Must match `--hero-slide` in storefront.css. */
const SLIDE_MS = 700;

/**
 * The campaign hero: frames on a rail that slides sideways, the way a phone
 * carousel does, advancing on its own and never reaching an end.
 *
 * The seamlessness is the whole trick. The rail carries one extra copy of the
 * first frame after the last one, so advancing off the end slides onto that
 * clone rather than rewinding through every frame. The instant that slide
 * finishes, the rail jumps back to the real first frame with transitions
 * switched off — same picture, same position, no visible move. Take the clone
 * away and the loop becomes a long backwards scroll every fourth beat.
 *
 * `#hero-sentinel` at the foot is what the header watches. Moving or renaming
 * it silently breaks the header's overlay state.
 */
export function HeroSlider({
  slides,
  eyebrow,
  headline,
  lede,
  primary,
  secondary,
  interval = 5200,
}: Props) {
  const reduced = useReducedMotion();
  const count = slides.length;

  // 0..count. `count` is the clone of slide 0 sitting past the end of the rail.
  const [position, setPosition] = useState(0);
  // While true the rail moves with no transition — used for the jump home.
  const [silent, setSilent] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [hovering, setHovering] = useState(false);

  const paused = hidden || hovering;
  const active = position % count;

  // Reduced motion gets a single still frame and no timer at all — an
  // auto-advancing carousel is exactly the vestibular trigger the media query
  // exists to suppress.
  useEffect(() => {
    if (reduced || paused || count < 2) return;

    const timer = window.setInterval(() => {
      setSilent(false);
      setPosition((current) => current + 1);
    }, interval);

    return () => window.clearInterval(timer);
  }, [reduced, paused, count, interval]);

  // Landed on the clone: wait for the slide to finish, then swap to the real
  // first frame without a transition. Both show the same photograph in the
  // same place, so the swap is invisible.
  useEffect(() => {
    if (position !== count) return;

    const timer = window.setTimeout(() => {
      setSilent(true);
      setPosition(0);
    }, SLIDE_MS);

    return () => window.clearTimeout(timer);
  }, [position, count]);

  // Re-arm transitions once the browser has painted the silent jump. Two
  // frames, because a single one can be coalesced with the state change that
  // caused it and the rail would animate the jump after all.
  useEffect(() => {
    if (!silent) return;

    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setSilent(false));
    });

    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [silent]);

  // A carousel animating in a hidden tab is pure battery cost.
  useEffect(() => {
    function onVisibility() {
      setHidden(document.visibilityState === 'hidden');
    }

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const rail = [...slides, slides[0]];

  return (
    <section
      className="hero"
      aria-labelledby="hero-heading"
      aria-roledescription="carousel"
      aria-label="Shrinkless campaign"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="hero__stack">
        <div
          className={`hero__rail${silent ? ' hero__rail--silent' : ''}`}
          style={{ transform: `translate3d(-${position * 100}%, 0, 0)` }}
        >
          {rail.map((slide, index) => (
            <div
              className="hero__slide"
              key={index}
              aria-hidden={index !== active || undefined}
            >
              {/* Every frame loads up front, and that is deliberate.
                  Lazy-loading them was the reason slides two onward arrived
                  blank and then snapped in: the rail is `overflow: hidden` and
                  the frames sit off to the side of it, so the intersection
                  observer never fired until the slide had already moved into
                  view — the fetch started at the moment the shopper needed the
                  picture. Four frames is a small enough set to simply fetch.
                  The first is `priority` so it competes for bandwidth as LCP;
                  the rest are eager but low priority, so they fill in behind
                  it rather than racing it. */}
              <Image
                src={slide.image.url}
                alt={index === count ? '' : slide.image.alt}
                fill
                priority={index === 0}
                loading="eager"
                fetchPriority={index === 0 ? 'high' : 'low'}
                sizes="100vw"
                className="hero__image"
                style={cropStyle(slide.image)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="hero__scrim" aria-hidden="true" />

      <div className="wrap hero__inner">
        <p className="eyebrow hero__eyebrow">{eyebrow}</p>

        <h1 id="hero-heading" className="display hero__head">
          {headline.map((line, index) => (
            <span key={line} className="hero__line">
              {line}
              {index < headline.length - 1 ? <br /> : null}
            </span>
          ))}
        </h1>

        <p className="lede hero__lede">{lede}</p>

        <div className="hero__actions">
          <Link href={primary.href} className="btn btn--light btn--lg">{primary.label}</Link>
          <Link href={secondary.href} className="btn btn--ghost btn--lg">{secondary.label}</Link>
        </div>
      </div>

      <div id="hero-sentinel" className="hero__sentinel" aria-hidden="true" />
    </section>
  );
}
