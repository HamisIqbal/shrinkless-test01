'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

/**
 * Spec §6: Lenis for smooth scroll on the storefront only — the admin is a
 * back office and gets none of it. Disabled outright under
 * prefers-reduced-motion rather than merely shortened.
 */
export function SmoothScroll() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) return;

    const lenis = new Lenis({ duration: 1.05, smoothWheel: true });

    let frame = 0;
    function raf(time: number) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    }
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return null;
}
