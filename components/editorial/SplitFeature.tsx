import Image from 'next/image';
import Link from 'next/link';
import type { BrandImage } from '@/lib/brand/images';
import { Reveal } from '@/components/ui/Reveal';

type Props = {
  image: BrandImage;
  eyebrow?: string;
  headline: string;
  body: string;
  cta?: { href: string; label: string };
  /** Image on the right instead of the left. */
  flip?: boolean;
};

/**
 * A 60/40 split where the photograph bleeds off the page edge and the text is
 * held to a readable measure. Alternating `flip` down a page is what keeps a
 * sequence of these from reading as a stack of cards.
 */
export function SplitFeature({ image, eyebrow, headline, body, cta, flip = false }: Props) {
  return (
    <section className={`split${flip ? ' split--flip' : ''}`}>
      <div className="split__media">
        <div className="frame frame--45">
          <Image
            src={image.url}
            alt={image.alt}
            fill
            sizes="(min-width: 56.25rem) 60vw, 100vw"
          />
        </div>
      </div>

      <div className="split__body">
        <Reveal>
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2 className="head split__head">{headline}</h2>
            <p className="lede split__lede">{body}</p>
            {cta ? (
              <Link href={cta.href} className="btn btn--outline split__cta">{cta.label}</Link>
            ) : null}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
