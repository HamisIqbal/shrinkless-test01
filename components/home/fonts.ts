import { Archivo, Bebas_Neue, Space_Grotesk, Geist_Mono } from 'next/font/google';

/**
 * The homepage chrome's four faces. Scoped per component by class: each home
 * component puts `homeFonts` on its own root, so the display, Bebas and
 * accent variables exist only inside the header, menus, category doors and
 * footer on `/`. The mono face travels further on its own — see `homeMono`
 * below — because the announcement bar wears it across the whole storefront.
 *
 * Bebas Neue is the voice of the page itself: the navigation, the campaign's
 * one button, and every section heading down to the category doors. It is a
 * single-weight, caps-only condensed face — no bold, no width axis — so the
 * rules that set it also reset the weight and tracking Archivo wanted.
 *
 * Archivo is loaded with its width axis and kept for the wordmark and the
 * footer, where the width is still the idea — a brand that sells tees that do
 * not shrink signs off in a face that visibly widens rather than narrows.
 * Space Grotesk is the accent, a second voice for running copy and pull
 * quotes. Geist Mono is the care-label voice for counts and small print.
 */
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-hm-display',
  display: 'swap',
});

const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-hm-bebas',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-hm-accent',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-hm-mono',
  display: 'swap',
  preload: false,
});

export const homeFonts = `${archivo.variable} ${bebasNeue.variable} ${spaceGrotesk.variable} ${geistMono.variable}`;

/** For chrome that only ever sets small print — the announcement bar, say —
 *  so it gets `--font-hm-mono` without also pulling in the three display
 *  faces it never renders. */
export const homeMono = geistMono.variable;
