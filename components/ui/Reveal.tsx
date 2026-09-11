'use client';

import type { ReactNode } from 'react';
import { motion } from 'motion/react';

type Props = {
  children: ReactNode;
  /** Position in a stagger group. Delay is capped so long grids never crawl. */
  index?: number;
  className?: string;
};

/**
 * Short, once-only entrance reveal for section headers and grid items.
 *
 * Deliberately does NOT branch on `useReducedMotion()`: that hook returns
 * `false` during server rendering, so swapping the element type on it produced
 * a structural hydration mismatch. `components/ui/Motion` sets the policy
 * globally instead, and this renders one tree either way.
 */
export function Reveal({ children, index = 0, className }: Props) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-64px' }}
      transition={{
        duration: 0.42,
        ease: [0.16, 0.84, 0.44, 1],
        delay: Math.min(index, 5) * 0.04,
      }}
    >
      {children}
    </motion.div>
  );
}
