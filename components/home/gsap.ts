'use client';

import { useLayoutEffect, useEffect, type DependencyList, type RefObject } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

export { gsap, ScrollTrigger, SplitText };

/** One curve for the homepage chrome: leaves fast, lands slowly. */
export const HM_EASE = 'expo.out';

/** Motion is opt-in: everything animated has a finished resting state in CSS. */
export const MOTION_OK = '(prefers-reduced-motion: no-preference)';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Runs GSAP setup against a scoped `matchMedia`, and reverts every tween,
 * ScrollTrigger and SplitText it made when the component unmounts or the
 * deps change. Nothing leaks into the next route.
 */
export function useGsap(
  scope: RefObject<HTMLElement | null>,
  setup: (mm: gsap.MatchMedia) => void,
  deps: DependencyList = [],
) {
  useIsoLayoutEffect(() => {
    if (!scope.current) return;
    const mm = gsap.matchMedia(scope.current);
    setup(mm);
    return () => mm.revert();
  }, deps);
}
