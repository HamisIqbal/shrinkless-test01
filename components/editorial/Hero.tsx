import Image from 'next/image';
import Link from 'next/link';
import type { BrandImage } from '@/lib/brand/images';

type Props = {
  image: BrandImage;
  eyebrow: string;
  headline: string[];
  lede: string;
  primary: { href: string; label: string };
  secondary: { href: string; label: string };
};

/**
 * Full-bleed photograph, type sitting on it bottom-left.
 *
 * The wash over the image is a flat tint, not a gradient — white type has to
 * stay legible over light frames, and a constant alpha is the least visible
 * way to buy that contrast.
 *
 * `#hero-sentinel` at the foot is what the header watches to decide whether it
 * is overlaid or solid. Moving or renaming it silently breaks the header.
 */
export function Hero({ image, eyebrow, headline, lede, primary, secondary }: Props) {
  return (
    <section className="hero" aria-labelledby="hero-heading">
      <Image
        src={image.url}
        alt={image.alt}
        fill
        priority
        sizes="100vw"
        className="hero__image"
      />

      <div className="hero__scrim" aria-hidden="true" />

      <div className="wrap hero__inner">
        <p className="eyebrow hero__eyebrow">{eyebrow}</p>

        <h1 id="hero-heading" className="display hero__head">
          {headline.map((line, index) => (
            <span key={line} className="hero__line">
              {line}
              {index < headline.length - 1 ? <br /> : null}
            </span>
          ))}
        </h1>

        <p className="lede hero__lede">{lede}</p>

        <div className="hero__actions">
          <Link href={primary.href} className="btn btn--light">{primary.label}</Link>
          <Link href={secondary.href} className="ulink hero__secondary">{secondary.label}</Link>
        </div>
      </div>

      <div id="hero-sentinel" className="hero__sentinel" aria-hidden="true" />
    </section>
  );
}
