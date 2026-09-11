'use client';

import type { ReactNode } from 'react';
import { MotionConfig } from 'motion/react';

/**
 * One motion policy for the whole storefront.
 *
 * `reducedMotion="user"` makes Motion itself honour the OS setting, which is
 * the only correct place to make that decision. Branching on
 * `useReducedMotion()` inside a component looks equivalent and is not: the
 * hook cannot know the user's preference during server rendering, so it
 * returns `false` on the server and the real value on the client. Any markup
 * that depends on it therefore hydrates mismatched — and a component that
 * renders `<div>` in one branch and `<motion.div>` in the other mismatches
 * structurally, which React cannot patch up.
 *
 * The rule downstream: render the same tree either way and let this decide how
 * much of it is allowed to move. `useReducedMotion()` is still fine inside
 * effects, which never run on the server — that is how the hero suppresses its
 * auto-advance.
 */
export function Motion({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
