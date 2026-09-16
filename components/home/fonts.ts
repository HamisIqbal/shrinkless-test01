import { Archivo, Space_Grotesk, Geist_Mono } from 'next/font/google';

/**
 * The homepage chrome's three faces. Scoped: each home component puts
 * `homeFonts` on its own root, so the variables exist only inside the
 * header, menus, category doors and footer on `/`.
 *
 * Archivo is loaded with its width axis because the width is the idea — a
 * brand that sells tees that do not shrink sets its biggest words in a face
 * that visibly widens rather than narrows. Space Grotesk is the accent: a
 * modern grotesk with enough character in its letterforms to read as a second
 * voice beside Archivo's uppercase, which is what the old Bodoni italic was
 * for. Geist Mono is the care-label voice for counts and small print.
 */
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-hm-display',
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

export const homeFonts = `${archivo.variable} ${spaceGrotesk.variable} ${geistMono.variable}`;
