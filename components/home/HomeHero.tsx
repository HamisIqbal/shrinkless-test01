'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { cropStyle } from '@/lib/media/crop';
import type { HeroSlide } from '@/components/site/HeroSlider';
import { homeFonts } from '@/components/home/fonts';
import { HomePill, Words } from '@/components/home/HomePill';
import { gsap, useGsap, MOTION_OK } from '@/components/home/gsap';
import './home-sections.css';

type Props = {
  slides: HeroSlide[];
  eyebrow: string;
  headline: string[];
  lede: string;
  primary: { href: string; label: string };
  secondary: { href: string; label: string };
  /** Milliseconds each frame holds before the next wipes over it. */
  interval?: number;
};

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * The homepage campaign.
 *
 * Frames are stacked rather than railed: the next one wipes across the last
 * from the right while it settles out of a slow zoom. The hold timer is the
 * progress bar itself — the frame advances when its bar's CSS animation ends —
 * so hovering, a hidden tab and reduced motion all pause the carousel by
 * pausing (or never starting) one animation, and the bar and the frame can
 * never disagree about how long is left.
 *
 * The headline is set in two voices — Archivo widening out of its narrowest
 * cut, then Bodoni italic — and rises in on first paint from CSS alone, so
 * the largest thing on the page does not wait on hydration.
 */
export function HomeHero({
  slides,
  eyebrow,
  headline,
  lede,
  primary,
  secondary,
  interval = 6000,
}: Props) {
  const root = useRef<HTMLElement>(null);
  const count = slides.length;

  const [active, setActive] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const [hovering, setHovering] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  function go(next: number) {
    if (next === active || count < 2) return;
    setPrevious(active);
    setActive((next + count) % count);
  }

  // The page lifts off the campaign: the frames sink a little slower than the
  // scroll and the type drifts up and out ahead of them.
  useGsap(root, (mm) => {
    mm.add(MOTION_OK, () => {
      const section = root.current!;
      const trigger = { trigger: section, start: 'top top', end: 'bottom top', scrub: true };

      gsap.to(section.querySelector('.hm-hero__stage'), { yPercent: 14, ease: 'none', scrollTrigger: trigger });
      gsap.to(section.querySelector('.hm-hero__inner'), { y: -90, opacity: 0.25, ease: 'none', scrollTrigger: trigger });
    });
  });

  const [first = '', second = ''] = headline;
  const paused = hovering || hidden;

  return (
    <section
      ref={root}
      className={`hero hm-hero ${homeFonts}${paused ? ' is-paused' : ''}`}
      aria-labelledby="hero-heading"
      aria-roledescription="carousel"
      aria-label="Shrinkless campaign"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="hm-hero__stage">
        {slides.map((slide, index) => {
          const state =
            index === active ? (previous === null ? ' is-active is-first' : ' is-active') : index === previous ? ' is-prev' : '';

          return (
            <div className={`hm-hero__slide${state}`} key={index} aria-hidden={index !== active || undefined}>
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

      <div className="hm-hero__scrim" aria-hidden="true" />

      <div className="hm-hero__inner">
        <p className="hm-hero__eyebrow">
          <span className="hm-hero__rule" aria-hidden="true" />
          <span>{eyebrow}</span>
        </p>

        <h1 id="hero-heading" className="hm-hero__head">
          <span className="hm-hero__line hm-hero__line--sans">
            <Words text={first} />
          </span>{' '}
          <span className="hm-hero__line hm-hero__line--serif">
            <Words text={second} />
          </span>
        </h1>

        <div className="hm-hero__foot">
          <div className="hm-hero__copy">
            <p className="hm-hero__lede">{lede}</p>

            <div className="hm-hero__actions">
              <HomePill href={primary.href} tone="light">{primary.label}</HomePill>
              <HomePill href={secondary.href} tone="ghost">{secondary.label}</HomePill>
            </div>
          </div>

          {count > 1 ? (
            <div className="hm-hero__meta">
              <p className="hm-hero__count tnum" aria-live="polite">
                <span className="visually-hidden">Frame </span>
                <span className="hm-hero__now">{pad(active + 1)}</span>
                <span className="hm-hero__of"> / {pad(count)}</span>
              </p>

              <div className="hm-hero__bars">
                {slides.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`hm-hero__bar${index === active ? ' is-on' : ''}`}
                    aria-label={`Show frame ${index + 1}`}
                    aria-current={index === active || undefined}
                    onClick={() => go(index)}
                  >
                    <span
                      className="hm-hero__fill"
                      style={{ animationDuration: `${interval}ms` }}
                      onAnimationEnd={() => {
                        if (index === active) go(active + 1);
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div id="hero-sentinel" className="hero__sentinel" aria-hidden="true" />
    </section>
  );
}
