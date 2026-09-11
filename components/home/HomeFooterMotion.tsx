'use client';

import { useEffect, useRef } from 'react';
import { gsap, ScrollTrigger, useGsap, MOTION_OK } from '@/components/home/gsap';
import { ArrowIcon } from '@/components/site/icons';

const WORD = 'SHRINKLESS'.split('');

/** Archivo's width axis, narrowest and widest. */
const NARROW = 62;
const WIDE = 125;

/**
 * The wordmark along the foot of the colophon, fitted edge to edge.
 *
 * It is sized at its widest, so the finished state fills the measure
 * exactly, and it starts at its narrowest: as the page lifts off the footer
 * the letters rise and the word widens until it meets both margins.
 *
 * On a desk the footer is pinned under the page, so progress is read off the
 * last footer-height of scroll; on a phone the footer is in the flow and
 * progress is simply how much of it has come into view.
 */
export function HomeFooterMark() {
  const root = useRef<HTMLDivElement>(null);
  const word = useRef<HTMLParagraphElement>(null);

  // Fit to the measure at full width, keeping whatever width GSAP is holding.
  useEffect(() => {
    const box = root.current;
    const node = word.current;
    if (!box || !node) return;

    const fit = () => {
      const held = node.style.getPropertyValue('--wdth');
      node.style.setProperty('--wdth', String(WIDE));
      node.style.setProperty('--fit', '100px');
      const width = node.getBoundingClientRect().width;
      // Edge to edge, but never so tall that the pinned footer outgrows a
      // short laptop window and loses its signup off the top.
      const size = Math.min((box.clientWidth / width) * 100, window.innerHeight * 0.26);
      if (width > 0) node.style.setProperty('--fit', `${size}px`);
      if (held) node.style.setProperty('--wdth', held);
      else node.style.removeProperty('--wdth');
    };

    fit();
    document.fonts?.ready.then(() => {
      fit();
      ScrollTrigger.refresh();
    });

    const observer = new ResizeObserver(fit);
    observer.observe(box);
    window.addEventListener('resize', fit);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, []);

  useGsap(root, (mm) => {
    mm.add(
      { motion: MOTION_OK, desk: '(min-width: 62rem)' },
      (context) => {
        const { motion, desk } = context.conditions as { motion: boolean; desk: boolean };
        if (!motion) return;

        const node = word.current!;
        const footer = root.current!.closest('footer') as HTMLElement;
        const dock = (footer.closest('.footerdock') as HTMLElement | null) ?? footer;

        const tl = gsap.timeline({ defaults: { ease: 'none' } });
        tl.fromTo(node, { '--wdth': NARROW }, { '--wdth': WIDE, duration: 1 }, 0);
        tl.from(
          node.querySelectorAll('.hm-foot__char'),
          { yPercent: 105, duration: 0.55, ease: 'power3.out', stagger: 0.045 },
          0,
        );

        ScrollTrigger.create(
          desk
            ? {
                animation: tl,
                scrub: 0.7,
                start: () => ScrollTrigger.maxScroll(window) - dock.offsetHeight,
                end: () => ScrollTrigger.maxScroll(window) - dock.offsetHeight * 0.08,
                invalidateOnRefresh: true,
              }
            : {
                animation: tl,
                scrub: 0.7,
                trigger: footer,
                start: 'top bottom',
                end: 'bottom bottom',
                invalidateOnRefresh: true,
              },
        );
      },
    );
  });

  return (
    <div className="hm-foot__mark" ref={root} aria-hidden="true">
      <p className="hm-foot__word" ref={word}>
        {WORD.map((char, index) => (
          <span key={index} className="hm-foot__charmask">
            <span className="hm-foot__char">{char}</span>
          </span>
        ))}
      </p>
    </div>
  );
}

export function BackToTop() {
  return (
    <button
      type="button"
      className="hm-foot__top-btn"
      onClick={() => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      }}
    >
      <span className="hm-roll">
        <span className="hm-roll__a">Back to top</span>
        <span className="hm-roll__b" aria-hidden="true">Back to top</span>
      </span>
      <span className="hm-foot__up" aria-hidden="true">
        <ArrowIcon />
      </span>
    </button>
  );
}
