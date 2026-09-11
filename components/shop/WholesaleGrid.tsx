'use client';

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { ProductCard } from '@/components/shop/ProductCard';
import { formatCents } from '@/lib/money';
import type { ProductDTO, WholesaleProductDTO } from '@/types/dto';

type Props = { styles: WholesaleProductDTO[] };

/**
 * The line sheet's contents, drawn with the shop's own card.
 *
 * The trade page used to carry a card of its own, which meant two card designs
 * to keep in step for no gain — the frame, the caption and the hover are the
 * same job on both sides of the store. So this maps a style onto the shape the
 * retail card already reads and hands it over, with the two things trade
 * differs on passed as props: the card points at the style's own page, and the
 * price line quotes the opening rung of the ladder rather than a shelf price.
 *
 * No quick view. There is nothing to add to a cart at 150 units, so the eye
 * would open a dialog with no purpose behind it.
 */
export function WholesaleGrid({ styles }: Props) {
  const cards = useMemo(
    () =>
      styles.map((style) => {
        const opening = style.tiers[0];

        const product: ProductDTO = {
          id: style.id,
          title: style.title,
          slug: style.slug,
          description: style.description,
          category: style.category,
          status: 'published',
          featured: false,
          badge: 'none',
          rating: 0,
          images: style.image ? [style.image] : [],
          sizes: style.sizes,
          /* Left empty on purpose: colour dots switch between photographs the
             sheet does not carry, and a colourway with no variants behind it
             would read as sold out. */
          colors: [],
          variants: [],
          minPriceCents: opening?.unitPriceCents ?? style.retailCents,
          tags: [],
          baseSku: '',
          seo: { title: '', description: '', keywords: [] },
          quantityRule: { min: 1, step: 1, max: null },
          archived: false,
        };

        // Short on purpose: the caption sits on one line beside the title, and
        // the minimum is already stated in the sheet's header.
        const price = opening
          ? `From ${formatCents(opening.unitPriceCents)}`
          : 'On request';

        return { product, price };
      }),
    [styles],
  );

  return (
    <ul className="pgrid pgrid--3">
      {cards.map(({ product, price }, index) => (
        <motion.li
          key={product.id}
          className="pgrid__cell"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{
            duration: 0.5,
            ease: [0.16, 0.84, 0.44, 1],
            delay: Math.min(index % 3, 3) * 0.07,
          }}
        >
          <ProductCard
            product={product}
            index={index}
            href={`/wholesale/${product.slug}`}
            priceLabel={price}
          />
        </motion.li>
      ))}
    </ul>
  );
}
