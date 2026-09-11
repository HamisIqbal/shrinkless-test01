import Image from 'next/image';
import Link from 'next/link';
import type { BrandImage } from '@/lib/brand/images';
import { Reveal } from '@/components/ui/Reveal';
import { cropStyle } from '@/lib/media/crop';

export type Tile = {
  image: BrandImage;
  /** Small figure above the title. Reads as a series when every tile has one. */
  index?: string;
  title: string;
  body?: string;
  href?: string;
};

type Props = {
  eyebrow?: string;
  heading?: string;
  tiles: Tile[];
  columns?: 2 | 3 | 4;
  /** Taller frames, for the two-up statement treatment. */
  tall?: boolean;
  /** Constrains the grid to the page's wrap measure instead of full-bleed. */
  contained?: boolean;
};

/**
 * Photographs carrying their own text.
 *
 * This replaced two bands that said everything in type on an empty ground —
 * a big statement over paper, and four numbered paragraphs beside two pictures.
 * Both read as a lot of air around a little writing. Here each claim sits on
 * the frame that evidences it, which is both denser and more convincing:
 * "organic cotton" over a photograph of the cotton.
 *
 * The wash under the text is weighted to the foot of the frame for the same
 * reason the hero's is — white type has to survive a pale photograph, and a
 * flat tint strong enough to guarantee that would grey out the whole picture.
 */
export function OverlayTiles({ eyebrow, heading, tiles, columns = 2, tall = false, contained = false }: Props) {
  const headingId = heading ? `tiles-${heading.replace(/\W+/g, '-').toLowerCase()}` : undefined;

  const grid = (
    <ul className={`tiles__grid tiles__grid--${columns}${tall ? ' tiles__grid--tall' : ''}`}>
        {tiles.map((tile, index) => {
          const inner = (
            <>
              <div className="tiles__frame">
                <Image
                  src={tile.image.url}
                  alt={tile.image.alt}
                  fill
                  loading="lazy"
                  sizes={columns >= 3 ? '(min-width: 48rem) 25vw, 50vw' : '(min-width: 48rem) 50vw, 100vw'}
                  className="tiles__image"
                  style={cropStyle(tile.image)}
                />
                <span className="tiles__wash" aria-hidden="true" />
              </div>

              <span className="tiles__body">
                {tile.index ? <span className="tiles__index tnum">{tile.index}</span> : null}
                <span className="tiles__label">{tile.title}</span>
                {tile.body ? <span className="tiles__copy">{tile.body}</span> : null}
              </span>
            </>
          );

          return (
            <li key={tile.title} className="tiles__cell">
              <Reveal index={index}>
                {tile.href ? (
                  <Link href={tile.href} className="tiles__tile tiles__tile--link">{inner}</Link>
                ) : (
                  <div className="tiles__tile">{inner}</div>
                )}
              </Reveal>
            </li>
          );
        })}
    </ul>
  );

  return (
    <section
      className="tiles"
      aria-labelledby={headingId}
      aria-label={headingId ? undefined : eyebrow}
    >
      {heading ? (
        <div className="wrap">
          <Reveal>
            <div className="tiles__head">
              {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
              <h2 id={headingId} className="head tiles__title">{heading}</h2>
            </div>
          </Reveal>
        </div>
      ) : null}

      {contained ? <div className="wrap">{grid}</div> : grid}
    </section>
  );
}
