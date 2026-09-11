import { FaqAccordion, type FaqItem } from '@/components/site/FaqAccordion';
import { getContentLayer, getSiteContent, type SiteContent } from '@/lib/services/site-content';
import { ContentLayer } from '@/components/site/ContentLayer';
import { getMediaLayer } from '@/lib/services/site-media';
import { MediaLayer } from '@/components/site/MediaLayer';

export const metadata = {
  title: 'FAQ',
  description: 'Sizing, care, shipping and returns.',
};

/**
 * Anything factual that has not been confirmed is marked [TBC] rather than
 * invented — spec §11.2. A guessed return window is a promise the business
 * then has to keep. The wording is the admin's to correct once the answer is
 * known, so it is read from the content registry rather than set here; the
 * registry owns the count, and this list follows it.
 */
const items = (copy: SiteContent): FaqItem[] =>
  [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
    q: copy[`faq.${n}.q`],
    a: copy[`faq.${n}.a`],
  }));

/* No <InstagramStrip /> here — app/(shop)/(instagram-last)/layout.tsx already
   renders it after every page's content, right where the brief wants it. */
export default async function FaqPage() {
  const [copy, layer, mediaLayer] = await Promise.all([
    getSiteContent(),
    getContentLayer('faq'),
    getMediaLayer('faq'),
  ]);

  return (
    <div className="band band--tight wrap">
      <header className="pagehead pagehead--center">
        <h1 className="display pagehead__title">{copy['faq.title']}</h1>
      </header>

      <FaqAccordion items={items(copy)} />

      <ContentLayer {...layer} />

      <MediaLayer {...mediaLayer} />
    </div>
  );
}
