import { HomeInstagram } from '@/components/home/HomeInstagram';

/**
 * Every shop page except the homepage.
 *
 * The Instagram band used to hang off the shell, after `<main>`, so it was the
 * last thing on every page including the home one. On the homepage it now sits
 * up in the run of bands, above New arrivals — and a layout cannot know which
 * route it is rendering, so the group is the answer: these routes keep the
 * band at the bottom, `app/(shop)/page.tsx` places its own.
 *
 * It is the homepage's own band, not a second one set in a different voice:
 * these routes used to render `InstagramStrip`, which drew the same posts
 * under an eyebrow, a handle and a scrolling instruction. One band, one
 * heading, every page.
 *
 * The parentheses keep the folder out of the URL — /cart is still /cart.
 */
export default function InstagramLastLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      {children}
      <HomeInstagram />
    </>
  );
}
