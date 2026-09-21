import { SlotMedia } from '@/components/site/SlotMedia';
import { cropStyle } from '@/lib/media/crop';
import type { BrandImage } from '@/lib/brand/images';
import { homeFonts } from '@/components/home/fonts';
import { HomeScene } from '@/components/home/HomeScene';
import { HomePill } from '@/components/home/HomePill';
import './pages.css';

type Props = {
  image: BrandImage;
  statement: string;
  cta?: { href: string; label: string };
  sectionClass?: string;
};

/**
 * The full-bleed line a page closes on.
 *
 * `HomePromise`'s shape: the photograph still drifts on a scrubbed
 * `data-hm-parallax`, tied to scroll position throughout. The statement and
 * its button are different — they enter once, via `HomeScene`'s
 * `data-hm-rise` and `data-hm-fade`, and stay put after that.
 */
export function StatementBand({ image, statement, cta, sectionClass = '' }: Props) {
  return (
    <HomeScene className={`${sectionClass} pg-statement ${homeFonts}`} aria-label={statement}>
      <div className="pg-statement__media" data-hm-parallax="8">
        <SlotMedia
          src={image.url}
          alt={image.alt}
          fill
          loading="lazy"
          sizes="100vw"
          className="pg-statement__image"
          style={cropStyle(image)}
        />
      </div>

      <div className="pg-statement__scrim" aria-hidden="true" />

      <div className="hm-wrap pg-statement__inner">
        <div className="hm-mask hm-mask--tall">
          <p className="pg-statement__line" data-hm-rise>{statement}</p>
        </div>

        {cta ? (
          <div data-hm-fade data-hm-delay="0.2">
            <HomePill href={cta.href} tone="light">{cta.label}</HomePill>
          </div>
        ) : null}
      </div>
    </HomeScene>
  );
}
