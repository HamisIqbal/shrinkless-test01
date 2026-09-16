import Image from 'next/image';
import Link from 'next/link';
import { cropStyle } from '@/lib/media/crop';
import type { Gateway } from '@/components/shop/CategoryGateway';
import { homeFonts } from '@/components/home/fonts';

type Props = {
  gateways: Gateway[];
};

/**
 * Men and Women, the homepage's two shopping doors.
 *
 * Two photographs edge to edge across the screen — half each from tablet
 * width up, stacked with nothing between them on a phone — each carrying its
 * own name in the middle of it. No heading over them and no entrance: the
 * section is two doors, and a door does not need to announce itself or arrive.
 *
 * The photographs are softened rather than sharp so the names stay legible
 * over them, and the blur is applied to a wrapper inset past the tile's edges:
 * the tile clips the feathered border away, and the image itself is left free
 * for the `transform` the admin's crop zoom puts on it.
 *
 * No client JavaScript — there is nothing here to hydrate.
 */
export function HomeGateway({ gateways }: Props) {
  return (
    <section className={`hm-gw ${homeFonts}`} aria-label="Shop by category">
      <ul className="hm-gw__grid">
        {gateways.map((gateway) => (
          <li key={gateway.slug} className="hm-gw__cell">
            <Link href={`/shop/${gateway.slug}`} className="hm-gw__tile">
              <span className="hm-gw__photo" aria-hidden="true">
                <Image
                  src={gateway.image.url}
                  alt=""
                  fill
                  loading="lazy"
                  sizes="(min-width: 48rem) 50vw, 100vw"
                  className="gateway__image hm-gw__image"
                  style={cropStyle(gateway.image)}
                />
              </span>

              <span className="hm-gw__wash" aria-hidden="true" />

              <span className="hm-gw__name">{gateway.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
