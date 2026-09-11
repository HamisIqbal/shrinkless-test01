import { Archivo, Bodoni_Moda, Geist_Mono } from 'next/font/google';

/**
 * The homepage chrome's three faces. Scoped: each home component puts
 * `homeFonts` on its own root, so the variables exist only inside the
 * announcement bar, header, menus, category doors and footer on `/`.
 *
 * Archivo is loaded with its width axis because the width is the idea — a
 * brand that sells tees that do not shrink sets its biggest words in a face
 * that visibly widens rather than narrows. Bodoni is an italic accent and
 * Geist Mono is the care-label voice for counts and small print.
 */
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-hm-display',
  display: 'swap',
});

const bodoni = Bodoni_Moda({
  subsets: ['latin'],
  style: ['italic'],
  axes: ['opsz'],
  variable: '--font-hm-serif',
  display: 'swap',
  preload: false,
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-hm-mono',
  display: 'swap',
  preload: false,
});

export const homeFonts = `${archivo.variable} ${bodoni.variable} ${geistMono.variable}`;
