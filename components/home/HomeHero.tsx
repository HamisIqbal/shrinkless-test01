'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { cropStyle } from '@/lib/media/crop';
import type { HeroSlide } from '@/components/site/HeroSlider';
import { homeFonts } from '@/components/home/fonts';
import { gsap, useGsap, MOTION_OK } from '@/components/home/gsap';
import './home-sections.css';

type Props = {
  slides: HeroSlide[];
  /** Milliseconds each frame holds before the next wipes over it. */
  interval?: number;
};

/**
 * The homepage campaign: the photography, and nothing else.
 *
 * Frames are stacked rather than railed — the next one wipes across the last
 * from the right while it settles out of a slow zoom — and the page lifts off
 * them as it scrolls. There is no type, no call to action and no carousel
 * furniture on it: the frame is the whole statement, so the hold is a timer
 * rather than a progress bar, and the only heading is one for the document
 * outline that is never drawn.
 *
 * The timer is read from `prefers-reduced-motion` inside an effect, which is
 * the one place that preference can be read without a hydration mismatch (see
 * components/ui/Motion.tsx): under reduced motion the first frame simply
 * stands, and a hidden tab holds whatever frame it was on.
 */
export function HomeHero({ slides, interval = 6000 }: Props) {
  const root = useRef<HTMLElement>(null);
  const count = slides.length;

  const [frame, setFrame] = useState<{ active: number; previous: number | null }>({
    active: 0,
    previous: null,
  });

  useEffect(() => {
    if (count < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      setFrame(({ active }) => ({ active: (active + 1) % count, previous: active }));
    }, interval);

    return () => window.clearInterval(timer);
  }, [count, interval]);

  // The page lifts off the campaign: the frames sink a little slower than the
  // scroll does.
  useGsap(root, (mm) => {
    mm.add(MOTION_OK, () => {
      const section = root.current!;

      gsap.to(section.querySelector('.hm-hero__stage'), {
        yPercent: 14,
        ease: 'none',
        scrollTrigger: { trigger: section, start: 'top top', end: 'bottom top', scrub: true },
      });
    });
  });

  return (
    <section
      ref={root}
      className={`hero hm-hero ${homeFonts}`}
      aria-labelledby="hero-heading"
      aria-roledescription="carousel"
      aria-label="Shrinkless campaign"
    >
      {/* The page's heading, for the outline and for a screen reader. Nothing
          is drawn in the hero. */}
      <h1 id="hero-heading" className="visually-hidden">
        Shrinkless
      </h1>

      <div className="hm-hero__stage">
        {slides.map((slide, index) => {
          const state =
            index === frame.active
              ? frame.previous === null
                ? ' is-active is-first'
                : ' is-active'
              : index === frame.previous
                ? ' is-prev'
                : '';

          return (
            <div
              className={`hm-hero__slide${state}`}
              key={index}
              aria-hidden={index !== frame.active || undefined}
            >
              <div className="hm-hero__zoom">
                {/* Every frame loads up front: the next one has to be there
                    the moment it wipes in. The first is the LCP. */}
                <Image
                  src={slide.image.url}
                  alt={slide.image.alt}
                  fill
                  priority={index === 0}
                  loading="eager"
                  fetchPriority={index === 0 ? 'high' : 'low'}
                  sizes="100vw"
                  className="hero__image hm-hero__image"
                  style={cropStyle(slide.image)}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div id="hero-sentinel" className="hero__sentinel" aria-hidden="true" />
    </section>
  );
}
