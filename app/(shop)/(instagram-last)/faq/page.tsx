import { FaqAccordion, type FaqItem } from '@/components/site/FaqAccordion';
import { getContentLayer, getSiteContent, type SiteContent } from '@/lib/services/site-content';
import { ContentLayer } from '@/components/site/ContentLayer';
import { getMediaLayer } from '@/lib/services/site-media';
import { MediaLayer } from '@/components/site/MediaLayer';
import { getStoreSettings } from '@/lib/services/settings';
import { homeFonts } from '@/components/home/fonts';
import '@/components/shop/shop.css';

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

/* No Instagram band here — app/(shop)/(instagram-last)/layout.tsx already
   renders the homepage's one after every page's content. */
export default async function FaqPage() {
  const [copy, layer, mediaLayer, settings] = await Promise.all([
    getSiteContent(),
    getContentLayer('faq'),
    getMediaLayer('faq'),
    getStoreSettings(),
  ]);

  return (
    <div className={`sh-faq ${homeFonts}`}>
      <div className="sh-wrap">
        <header className="sh-faq__head">
          <p className="sh-label">Help</p>
          <h1 className="sh-title">{copy['faq.title']}</h1>
        </header>

        <FaqAccordion items={items(copy)} />

        {/* An eight-question page that answers none of somebody's question is
            a dead end unless it says where to go next. */}
        <section className="sh-faq__ask" aria-labelledby="faq-ask-heading">
          <p className="sh-label">Still stuck</p>
          <h2 id="faq-ask-heading" className="sh-sub">Ask us directly</h2>
          <a href={`mailto:${settings.storeEmail}`} className="sh-btn">
            Email {settings.storeEmail}
          </a>
        </section>

        <ContentLayer {...layer} />

        <MediaLayer {...mediaLayer} />
      </div>
    </div>
  );
}
