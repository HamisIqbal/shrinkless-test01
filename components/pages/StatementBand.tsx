import Image from 'next/image';
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
 * `HomePromise`'s shape with its scrubbed parallax traded for the once-only
 * reveal in `HomeScene`: the homepage can afford a scrubbed band because it
 * has one, and these pages would each add another.
 */
export function StatementBand({ image, statement, cta, sectionClass = '' }: Props) {
  return (
    <HomeScene className={`${sectionClass} pg-statement ${homeFonts}`} aria-label={statement}>
      <div className="pg-statement__media" data-hm-parallax="8">
        <Image
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
