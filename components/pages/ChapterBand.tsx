import Image from 'next/image';
import { cropStyle } from '@/lib/media/crop';
import type { BrandImage } from '@/lib/brand/images';
import { homeFonts } from '@/components/home/fonts';
import { HomeScene } from '@/components/home/HomeScene';
import './pages.css';

export type Chapter = {
  title: string;
  body: string;
  image: BrandImage;
  /** A numeral set as a mono label, where the chapters are counted points. */
  index?: string;
};

type Props = {
  chapters: Chapter[];
  /** Names the section for a screen reader. */
  label: string;
  sectionClass?: string;
};

/**
 * Chapters, each a photograph beside its own words, sides alternating down the
 * page.
 *
 * The homepage's `HomeStory` pins one frame and wipes photographs over it,
 * which needs three scrubbed ScrollTriggers per section. This is the same
 * composition without the pinning: each frame opens from its foot once, as it
 * arrives, and settles from a scale while it does. Everything here is the
 * attribute set `HomeScene` already implements, so the section costs one
 * trigger per element and nothing is measured on every scrolled frame.
 */
export function ChapterBand({ chapters, label, sectionClass = '' }: Props) {
  return (
    <HomeScene className={`${sectionClass} pg-chapters ${homeFonts}`} aria-label={label}>
      <div className="hm-wrap">
        {chapters.map((chapter, index) => (
          <article
            key={chapter.title}
            className={`pg-chapter pg-chapter--${index % 2 ? 'right' : 'left'}`}
          >
            <div className="pg-chapter__frame" data-hm-reveal>
              <Image
                src={chapter.image.url}
                alt={chapter.image.alt}
                fill
                loading="lazy"
                sizes="(min-width: 62rem) 50vw, 100vw"
                className="pg-chapter__image"
                style={cropStyle(chapter.image)}
                data-hm-zoom
              />
            </div>

            <div className="pg-chapter__type">
              {chapter.index ? (
                <p className="hm-eyebrow pg-chapter__index" data-hm-fade>{chapter.index}</p>
              ) : null}

              <div className="hm-mask hm-mask--tall">
                <h2 className="pg-chapter__title" data-hm-rise data-hm-delay="0.1">{chapter.title}</h2>
              </div>

              <p className="pg-chapter__body" data-hm-fade data-hm-delay="0.2">{chapter.body}</p>
            </div>
          </article>
        ))}
      </div>
    </HomeScene>
  );
}
