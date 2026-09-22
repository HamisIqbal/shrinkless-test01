import { SlotMedia } from '@/components/site/SlotMedia';
import { cropStyle } from '@/lib/media/crop';
import type { BrandImage } from '@/lib/brand/images';
import { homeFonts } from '@/components/home/fonts';
import { HomeScene } from '@/components/home/HomeScene';
import './pages.css';

type Props = {
  /** A Media slot — a photograph, or a film if that is what the admin gave
   *  it. `SlotMedia` decides which from the address. */
  media: BrandImage;
  /** Not drawn over the media — the opener is the film alone — but still the
   *  page's heading for screen readers and search. */
  title: string;
  /** A class the Media tab targets for this section's height and ground. */
  sectionClass?: string;
};

/**
 * How a page that is not the homepage opens: full-bleed media and nothing over
 * it. The title is kept as a visually hidden heading. On a phone the frame
 * keeps the desk's landscape shape rather than growing tall, so the whole film
 * shows instead of a cropped middle strip.
 *
 * Pairs with the transparent masthead — a page using this must be listed in
 * `lib/shop/chrome.ts`, or the bar will sit on paper above a photograph.
 */
export function PageOpener({ media, title, sectionClass = '' }: Props) {
  return (
    <HomeScene className={`${sectionClass} pg-open ${homeFonts}`} aria-label={title}>
      <div className="pg-open__stage" data-hm-parallax="6">
        <SlotMedia
          src={media.url}
          alt={media.alt}
          fill
          priority
          sizes="100vw"
          className="pg-open__image"
          style={cropStyle(media)}
        />
      </div>

      <h1 className="visually-hidden">{title}</h1>
    </HomeScene>
  );
}
