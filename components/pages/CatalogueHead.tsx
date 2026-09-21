import { SlotMedia } from '@/components/site/SlotMedia';
import { cropStyle } from '@/lib/media/crop';
import type { BrandImage } from '@/lib/brand/images';
import { homeFonts } from '@/components/home/fonts';
import { HomeScene } from '@/components/home/HomeScene';
import './pages.css';

type Props = {
  title: string;
  eyebrow?: string;
  lede?: string;
  /** Shown as a two-digit count beside the title. */
  count?: number;
  /** When the collection has photography of its own. Without it the head is
   *  type on paper — a stand-in photograph would be a lie about the page. */
  image?: BrandImage;
};

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * What a collection opens on.
 *
 * A band rather than a hero: a grid of products is the point of these pages,
 * and a full screen of photography above it is a door the shopper has already
 * come through. The masthead stays on paper over it — these routes are not in
 * `lib/shop/chrome.ts`.
 */
export function CatalogueHead({ title, eyebrow, lede, count, image }: Props) {
  const lit = Boolean(image);

  return (
    <HomeScene
      className={`pg-head${lit ? ' pg-head--lit' : ''} ${homeFonts}`}
      aria-label={title}
    >
      {image ? (
        <>
          <div className="pg-head__media" data-hm-parallax="5">
            <SlotMedia
              src={image.url}
              alt=""
              fill
              priority
              sizes="100vw"
              className="pg-head__image"
              style={cropStyle(image)}
            />
          </div>
          <div className="pg-head__scrim" aria-hidden="true" />
        </>
      ) : null}

      <div className="hm-wrap pg-head__inner">
        {eyebrow ? <p className="hm-eyebrow" data-hm-fade>{eyebrow}</p> : null}

        <div className="pg-head__line">
          <div className="hm-mask hm-mask--tall">
            <h1 className="pg-head__title" data-hm-rise data-hm-delay="0.08">{title}</h1>
          </div>

          {typeof count === 'number' && count > 0 ? (
            <p className="pg-head__count tnum" data-hm-fade data-hm-delay="0.2">
              {pad(count)} {count === 1 ? 'style' : 'styles'}
            </p>
          ) : null}
        </div>

        {lede ? <p className="pg-head__lede" data-hm-fade data-hm-delay="0.25">{lede}</p> : null}
      </div>
    </HomeScene>
  );
}
