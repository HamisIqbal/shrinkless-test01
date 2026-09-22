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
  title: string;
  body?: string;
  /** A class the Media tab targets for this section's height and ground. */
  sectionClass?: string;
};

/**
 * How a page that is not the homepage opens: full-bleed media with nothing
 * over it, then the title and lede centred in a band of their own beneath it.
 * On a phone the frame keeps the desk's landscape shape rather than growing
 * tall, so the whole film shows instead of a cropped middle strip.
 *
 * Pairs with the transparent masthead — a page using this must be listed in
 * `lib/shop/chrome.ts`, or the bar will sit on paper above a photograph.
 */
export function PageOpener({ media, title, body, sectionClass = '' }: Props) {
  return (
    <>
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
      </HomeScene>

      <HomeScene className={`pg-intro ${homeFonts}`}>
        <div className="hm-wrap pg-intro__inner">
          <div className="hm-mask hm-mask--tall">
            <h1 className="pg-intro__title" data-hm-rise>{title}</h1>
          </div>

          {body ? <p className="pg-intro__body" data-hm-fade data-hm-delay="0.15">{body}</p> : null}
        </div>
      </HomeScene>
    </>
  );
}
