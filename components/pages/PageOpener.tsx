import Image from 'next/image';
import { cropStyle } from '@/lib/media/crop';
import type { BrandImage } from '@/lib/brand/images';
import { homeFonts } from '@/components/home/fonts';
import { HomeScene } from '@/components/home/HomeScene';
import './pages.css';

export type OpenerMedia =
  | { kind: 'image'; image: BrandImage }
  | { kind: 'video'; src: string; label: string };

type Props = {
  media: OpenerMedia;
  title: string;
  body?: string;
  /** A class the Media tab targets for this section's height and ground. */
  sectionClass?: string;
};

/**
 * How a page that is not the homepage opens: full-bleed media, and the title
 * rising through a mask over it.
 *
 * Pairs with the transparent masthead — a page using this must be listed in
 * `lib/shop/chrome.ts`, or the bar will sit on paper above a photograph.
 */
export function PageOpener({ media, title, body, sectionClass = '' }: Props) {
  return (
    <HomeScene className={`${sectionClass} pg-open ${homeFonts}`} aria-label={title}>
      <div className="pg-open__stage" data-hm-parallax="6">
        {media.kind === 'video' ? (
          <video
            className="pg-open__video"
            src={media.src}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-label={media.label}
          />
        ) : (
          <Image
            src={media.image.url}
            alt={media.image.alt}
            fill
            priority
            sizes="100vw"
            className="pg-open__image"
            style={cropStyle(media.image)}
          />
        )}
      </div>

      <div className="pg-open__scrim" aria-hidden="true" />

      <div className="hm-wrap pg-open__inner">
        <div className="hm-mask hm-mask--tall">
          <h1 className="pg-open__title" data-hm-rise>{title}</h1>
        </div>

        {body ? <p className="pg-open__body" data-hm-fade data-hm-delay="0.15">{body}</p> : null}
      </div>
    </HomeScene>
  );
}
