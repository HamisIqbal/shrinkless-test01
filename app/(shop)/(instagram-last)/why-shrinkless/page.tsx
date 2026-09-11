import Link from 'next/link';
import { getMediaLayer, getSiteMedia, type SiteMedia } from '@/lib/services/site-media';
import { getContentLayer, getSiteContent, type SiteContent } from '@/lib/services/site-content';
import { ContentLayer } from '@/components/site/ContentLayer';
import { MediaLayer } from '@/components/site/MediaLayer';
import { OverlayTiles, type Tile } from '@/components/editorial/OverlayTiles';

export const metadata = {
  title: 'Why Shrinkless',
  description: 'Organic cotton, garment dyed, built to hold its fit. Made in USA.',
};

/* Built per request rather than at module scope: the photographs and the
   words are both the admin's to change, so they are data now, not constants. */
const points = ({ editorial }: SiteMedia, copy: SiteContent): Tile[] => [
  {
    index: copy['why.1.index'],
    title: copy['why.1.title'],
    body: copy['why.1.body'],
    image: editorial.fabric,
  },
  {
    index: copy['why.2.index'],
    title: copy['why.2.title'],
    body: copy['why.2.body'],
    image: editorial.folded,
  },
  {
    index: copy['why.3.index'],
    title: copy['why.3.title'],
    body: copy['why.3.body'],
    image: editorial.hanging,
  },
  {
    index: copy['why.4.index'],
    title: copy['why.4.title'],
    body: copy['why.4.body'],
    image: editorial.craft,
  },
];

/* No <InstagramStrip /> here — app/(shop)/(instagram-last)/layout.tsx already
   renders it after every page's content, right where the brief wants it. */
export default async function WhyShrinklessPage() {
  const [media, copy, layer, mediaLayer] = await Promise.all([
    getSiteMedia(),
    getSiteContent(),
    getContentLayer('why-shrinkless'),
    getMediaLayer('why-shrinkless'),
  ]);

  return (
    <>
      <header className="band band--tight wrap pagehead pagehead--center">
        <h1 className="display pagehead__title">{copy['why.title']}</h1>
        <p className="lede pagehead__lede">{copy['why.lede']}</p>
      </header>

      <OverlayTiles tiles={points(media, copy)} columns={4} contained />

      <div className="band band--tight wrap shopcta">
        <Link href="/shop" className="btn">{copy['why.cta']}</Link>
      </div>

      <ContentLayer {...layer} />

      <MediaLayer {...mediaLayer} />
    </>
  );
}
