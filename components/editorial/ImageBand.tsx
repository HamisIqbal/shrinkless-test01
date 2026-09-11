import Image from 'next/image';
import type { BrandImage } from '@/lib/brand/images';
import { cropStyle } from '@/lib/media/crop';

type Props = {
  image: BrandImage;
  eyebrow?: string;
  headline: string;
  body?: string;
  /** A single small glyph beside the eyebrow. Used once, for the flag. */
  glyph?: string;
  /** Drops the headline off the display scale — used where the band is a
   *  supporting note rather than the page's statement. */
  compact?: boolean;
};

/**
 * Full-bleed photograph with type laid over it. Used for MADE IN USA.
 *
 * The flag is a 12px glyph next to the eyebrow and appears exactly once on the
 * site — the message is craftsmanship, and decoration would undercut it.
 */
export function ImageBand({ image, eyebrow, headline, body, glyph, compact }: Props) {
  return (
    <section className={`imageband${compact ? ' imageband--compact' : ''}`}>
      <Image
        src={image.url}
        alt={image.alt}
        fill
        sizes="100vw"
        className="imageband__image"
        style={cropStyle(image)}
      />

      <div className="imageband__scrim" aria-hidden="true" />

      <div className="wrap imageband__inner">
        {eyebrow ? (
          <p className="eyebrow imageband__eyebrow">
            {glyph ? <span className="imageband__glyph" aria-hidden="true">{glyph}</span> : null}
            {eyebrow}
          </p>
        ) : null}

        <h2 className={`imageband__head ${compact ? 'head' : 'display'}`}>{headline}</h2>

        {body ? <p className="lede imageband__lede">{body}</p> : null}
      </div>
    </section>
  );
}
