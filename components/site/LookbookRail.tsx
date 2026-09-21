import { SlotMedia } from '@/components/site/SlotMedia';
import Link from 'next/link';
import { getSiteMedia, type SiteMedia } from '@/lib/services/site-media';
import { cropStyle } from '@/lib/media/crop';
import type { BrandImage } from '@/lib/brand/images';

type Frame = {
  href: string;
  label: string;
  /** The whole frame, crop included — these tiles are wider than the sources
   *  they are cut from, so where they crop is not incidental. */
  image: BrandImage;
};

/**
 * Landscape frames on an endless rail, wider than they are tall.
 *
 * These tiles used to be the Instagram strip, where they were brand
 * photography passed off as posts. Here they are simply the lookbook, which is
 * what they always were — and being honest about that also let them grow. A
 * square Instagram tile has to stay square; a lookbook frame can be as wide as
 * the photograph deserves, which is what makes this read as a campaign reel
 * rather than a contact sheet.
 *
 * The loop is the same seam-free trick as the ticker: the rail carries the set
 * twice and travels exactly half its own width, so copy two arrives where copy
 * one began. The second copy is `aria-hidden` and `inert` so each frame is
 * reachable exactly once.
 */
/**
 * One tile per media slot, and no photograph on the rail twice.
 *
 * These tiles share their slots with the editorial bands elsewhere on the
 * site, which is deliberate: changing the fabric frame changes it everywhere
 * it appears. Two of them used to have duplicate slots of their own holding
 * the very same photograph — the rail then ran the same frame twice and the
 * media panel listed it twice — so they now read the slot that already owned
 * the picture. Only the Organic Tee frame, which appears nowhere else, still
 * has a slot to itself.
 */
export const frames = ({ editorial }: SiteMedia): Frame[] => [
  {
    href: '/product/mens-heavyweight-tee',
    label: 'Heavyweight Tee',
    image: editorial.torso,
  },
  { href: '/why-shrinkless', label: 'The cotton', image: editorial.fabric },
  {
    href: '/product/womens-boxy-tee',
    label: 'Boxy Tee',
    image: editorial.folded,
  },
  { href: '/our-story', label: 'Cut and sewn', image: editorial.craft },
  {
    href: '/product/womens-organic-tee',
    label: 'Organic Tee',
    image: editorial.lookbookOrganic,
  },
  { href: '/why-shrinkless', label: "Doesn't shrink", image: editorial.hanging },
  { href: '/shop', label: 'The collection', image: editorial.heather },
];

export async function LookbookRail() {
  const tiles = frames(await getSiteMedia());

  return (
    <section className="lookbook" aria-labelledby="lookbook-heading">
      <div className="wrap lookbook__head">
        <div>
          <p className="eyebrow">Lookbook</p>
          <h2 id="lookbook-heading" className="head lookbook__title">
            On the body.
          </h2>
        </div>

        <Link href="/shop" className="ulink lookbook__more">Shop all</Link>
      </div>

      <div className="lookbook__rail">
        {[0, 1].map((half) => (
          <div
            className="lookbook__half"
            key={half}
            aria-hidden={half === 1 || undefined}
            inert={half === 1 || undefined}
          >
            {tiles.map((frame, index) => (
              <Link key={`${half}-${index}`} href={frame.href} className="lookbook__tile">
                <SlotMedia
                  src={frame.image.url}
                  alt={frame.image.alt}
                  fill
                  loading="lazy"
                  sizes="(min-width: 62rem) 38rem, 80vw"
                  className="lookbook__image"
                  style={cropStyle(frame.image)}
                />
                <span className="lookbook__label">{frame.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
