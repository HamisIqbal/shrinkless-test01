import { getContentLayer, getSiteContent, type SiteContent } from '@/lib/services/site-content';
import { ContentLayer } from '@/components/site/ContentLayer';
import { getMediaLayer, getSiteMedia, type SiteMedia } from '@/lib/services/site-media';
import { MediaLayer } from '@/components/site/MediaLayer';
import { PageOpener } from '@/components/pages/PageOpener';
import { ChapterBand, type Chapter } from '@/components/pages/ChapterBand';
import { SpecStrip } from '@/components/pages/SpecStrip';
import { StatementBand } from '@/components/pages/StatementBand';
import { HomeScrollSync } from '@/components/home/HomeScene';

export const metadata = {
  title: 'Our Story',
  description: 'Why Shrinkless makes one tee, and makes it in the United States.',
};

/* The words and the photographs are both the admin's to change, so both are
   data here rather than anything this file holds. */
const chapters = ({ editorial }: SiteMedia, copy: SiteContent): Chapter[] => [
  { title: copy['story.ch1.title'], body: copy['story.ch1.body'], image: editorial.storyOne },
  { title: copy['story.ch2.title'], body: copy['story.ch2.body'], image: editorial.storyTwo },
  { title: copy['story.ch3.title'], body: copy['story.ch3.body'], image: editorial.storyThree },
];

const specs = (copy: SiteContent): string[] => [
  copy['story.spec.1'],
  copy['story.spec.2'],
  copy['story.spec.3'],
  copy['story.spec.4'],
];

/**
 * The page the brand is explained on.
 *
 * It opens the way Why Shrinkless does — a full-bleed photograph with the
 * title rising over it — and that photograph is a Media slot of its own, so
 * the admin can change it. Three chapters run under it, then the care label,
 * then the line the page closes on.
 *
 * No Instagram band here — app/(shop)/(instagram-last)/layout.tsx renders
 * it after every page's content.
 */
export default async function OurStoryPage() {
  const [media, copy, layer, mediaLayer] = await Promise.all([
    getSiteMedia(),
    getSiteContent(),
    getContentLayer('our-story'),
    getMediaLayer('our-story'),
  ]);

  return (
    <>
      <PageOpener
        media={media.editorial.storyHero}
        title={copy['story.title']}
        body={copy['story.body']}
      />

      <ChapterBand chapters={chapters(media, copy)} label="How the tee is made" />

      <SpecStrip items={specs(copy)} label="What it is" />

      <StatementBand
        image={media.editorial.storyStatement}
        statement={copy['story.statement']}
        cta={{ href: '/shop', label: copy['story.cta'] }}
      />

      <ContentLayer {...layer} />

      <MediaLayer {...mediaLayer} />

      <HomeScrollSync />
    </>
  );
}
