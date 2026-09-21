'use client';

import { ArrowIcon } from '@/components/site/icons';

export function BackToTop() {
  return (
    <button
      type="button"
      className="hm-foot__totop"
      onClick={() => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      }}
    >
      Back to top
      <span className="hm-foot__up" aria-hidden="true">
        <ArrowIcon />
      </span>
    </button>
  );
}
