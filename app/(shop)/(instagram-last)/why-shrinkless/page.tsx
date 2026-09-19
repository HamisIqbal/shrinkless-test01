import { getMediaLayer, getSiteMedia, type SiteMedia } from '@/lib/services/site-media';
import { getContentLayer, getSiteContent, type SiteContent } from '@/lib/services/site-content';
import { ContentLayer } from '@/components/site/ContentLayer';
import { MediaLayer } from '@/components/site/MediaLayer';
import { homeFonts } from '@/components/home/fonts';
import { HomeScene } from '@/components/home/HomeScene';
import { PageOpener } from '@/components/pages/PageOpener';
import { ChapterBand, type Chapter } from '@/components/pages/ChapterBand';
import { StatementBand } from '@/components/pages/StatementBand';

export const metadata = {
  title: 'Why Shrinkless',
  description: 'Organic cotton, garment dyed, built to hold its fit. Made in USA.',
};

/* The photographs and the words are both the admin's to change, so they are
   data rather than constants. The keys are the ones the four points have
   always used — only the composition around them changed. */
const points = ({ editorial }: SiteMedia, copy: SiteContent): Chapter[] => [
  { index: copy['why.1.index'], title: copy['why.1.title'], body: copy['why.1.body'], image: editorial.fabric },
  { index: copy['why.2.index'], title: copy['why.2.title'], body: copy['why.2.body'], image: editorial.folded },
  { index: copy['why.3.index'], title: copy['why.3.title'], body: copy['why.3.body'], image: editorial.hanging },
  { index: copy['why.4.index'], title: copy['why.4.title'], body: copy['why.4.body'], image: editorial.craft },
];

/**
 * The four things that separate this tee from the one that stopped fitting.
 *
 * They were a four-across grid of tiles, which put four photographs and four
 * paragraphs on the screen at once and gave a shopper no order to read them
 * in. They are chapters now: one at a time, each with room, in the order they
 * are numbered.
 */
export default async function WhyShrinklessPage() {
  const [media, copy, layer, mediaLayer] = await Promise.all([
    getSiteMedia(),
    getSiteContent(),
    getContentLayer('why-shrinkless'),
    getMediaLayer('why-shrinkless'),
  ]);

  return (
    <>
      <PageOpener
        media={{ kind: 'image', image: media.editorial.fabric }}
        title={copy['why.title']}
        body={copy['why.lede']}
      />

      <ChapterBand chapters={points(media, copy)} label="The four points" />

      <HomeScene className={`pg-proof ${homeFonts}`} aria-label="Measured shrinkage">
        <div className="hm-wrap">
          <div className="hm-mask hm-mask--tall">
            <p className="pg-proof__figure" data-hm-rise>{copy['why.proof.figure']}</p>
          </div>
          <p className="pg-proof__caption" data-hm-fade data-hm-delay="0.15">
            {copy['why.proof.caption']}
          </p>
        </div>
      </HomeScene>

      <StatementBand
        image={media.editorial.craft}
        statement={copy['why.title']}
        cta={{ href: '/shop', label: copy['why.cta'] }}
      />

      <ContentLayer {...layer} />

      <MediaLayer {...mediaLayer} />
    </>
  );
}
