'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import './home.css';

/**
 * Picks the homepage's own chrome on `/` and the shop's standard chrome on
 * every other route.
 *
 * The shell layout renders the announcement bar, header and footer for every
 * shop page and a layout cannot know which route it is drawing — so both
 * versions are handed over, already rendered, and the pathname decides. The
 * rest of the store keeps exactly the components it had.
 */
export function HomeSwitch({ home, rest }: { home: ReactNode; rest: ReactNode }) {
  return usePathname() === '/' ? home : rest;
}
