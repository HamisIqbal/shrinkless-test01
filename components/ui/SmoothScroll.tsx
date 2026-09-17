'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

/**
 * Spec §6: Lenis for smooth scroll on the storefront only — the admin is a
 * back office and gets none of it. Disabled outright under
 * prefers-reduced-motion rather than merely shortened.
 *
 * Lenis and GSAP's ScrollTrigger each want to drive their own animation frame.
 * Left to themselves they run two loops against one scroll: Lenis moves the
 * page on its frame, ScrollTrigger reads the position on its own, and every
 * scrubbed or revealed section on the homepage lands a frame behind the
 * photograph it belongs to — which is the stutter. So GSAP's ticker drives
 * Lenis, and Lenis's own scroll event updates ScrollTrigger: one loop, one
 * order, everything on the same frame. Lag smoothing is off because it lets
 * GSAP skip time after a long frame, which under a scrubbed scroll shows up
 * as a jump rather than a catch-up.
 *
 * GSAP is only loaded where it is already on the page, so the import is
 * dynamic and Lenis falls back to its own loop if it never resolves.
 */
export function SmoothScroll() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) return;

    const lenis = new Lenis({ duration: 1.05, smoothWheel: true });

    let frame = 0;
    let handOver: (() => void) | undefined;
    let dead = false;

    function raf(time: number) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    }

    // Its own loop until GSAP arrives, so the very first wheel is already smooth.
    frame = requestAnimationFrame(raf);

    Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
      .then(([{ gsap }, { ScrollTrigger }]) => {
        if (dead) return;

        gsap.registerPlugin(ScrollTrigger);
        cancelAnimationFrame(frame);
        frame = 0;

        // GSAP's ticker is in seconds; Lenis wants milliseconds.
        const tick = (time: number) => lenis.raf(time * 1000);
        const update = () => ScrollTrigger.update();

        lenis.on('scroll', update);
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);

        handOver = () => {
          lenis.off('scroll', update);
          gsap.ticker.remove(tick);
        };
      })
      .catch(() => {
        /* No GSAP on this route: Lenis keeps its own loop. */
      });

    return () => {
      dead = true;
      handOver?.();
      if (frame) cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return null;
}
