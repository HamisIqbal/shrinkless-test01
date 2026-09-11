'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ProductCard } from '@/components/shop/ProductCard';
import { QuickView } from '@/components/shop/QuickView';
import type { ProductDTO } from '@/types/dto';

type Props = {
  products: ProductDTO[];
  /** Two per row on phones, three up on desktop, unless told otherwise. */
  columns?: 2 | 3 | 4;
};

/**
 * The grid, and the single owner of quick-view state.
 *
 * One dialog for the whole grid rather than one per card: mounting a modal
 * beside every product would put the same twenty focusable nodes into the page
 * over and over for a panel only one of which can ever be open.
 *
 * Cards rise into place on a short stagger, capped so a long collection does
 * not take a visible age to finish arriving (spec §22).
 */
export function ProductGrid({ products, columns = 3 }: Props) {
  const [quick, setQuick] = useState<ProductDTO | null>(null);

  return (
    <>
      <ul className={`pgrid pgrid--${columns}`}>
        {products.map((product, index) => (
          <motion.li
            key={product.id}
            className="pgrid__cell"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{
              duration: 0.5,
              ease: [0.16, 0.84, 0.44, 1],
              delay: Math.min(index % columns, 3) * 0.07,
            }}
          >
            <ProductCard product={product} index={index} onQuickView={setQuick} />
          </motion.li>
        ))}
      </ul>

      {/* Keyed by product, so opening a different card mounts a fresh dialog
          rather than inheriting the last one's chosen size. AnimatePresence
          lives here because this is what unmounts it. */}
      <AnimatePresence>
        {quick ? (
          <QuickView key={quick.id} product={quick} onClose={() => setQuick(null)} />
        ) : null}
      </AnimatePresence>
    </>
  );
}
