import { InstagramStrip } from '@/components/site/InstagramStrip';

/**
 * Every shop page except the homepage.
 *
 * The Instagram band used to hang off the shell, after `<main>`, so it was the
 * last thing on every page including the home one. On the homepage it now sits
 * up in the run of bands, above New arrivals — and a layout cannot know which
 * route it is rendering, so the group is the answer: these routes keep the
 * band at the bottom, `app/(shop)/page.tsx` places its own.
 *
 * The parentheses keep the folder out of the URL — /cart is still /cart.
 */
export default function InstagramLastLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      {children}
      <InstagramStrip />
    </>
  );
}
