'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence } from 'motion/react';
import { ProductCard } from '@/components/shop/ProductCard';
import { QuickView } from '@/components/shop/QuickView';
import { formatCents } from '@/lib/money';
import type { ProductDTO } from '@/types/dto';
import { homeFonts } from '@/components/home/fonts';
import { HomePill } from '@/components/home/HomePill';
import { gsap, useGsap, MOTION_OK } from '@/components/home/gsap';

type Props = {
  /** `new-heading` or `featured-heading` — the Media tab finds each shelf by it. */
  headingId: string;
  eyebrow: string;
  heading: string;
  link: { href: string; label: string };
  products: ProductDTO[];
  /**
   * `index`: the head and a running list of the products stay pinned in the
   * left column while the cards pass on the right.
   * `spread`: one large card and two beside it, like a magazine spread.
   */
  layout: 'index' | 'spread';
  /** Shown when there are no products at all. */
  empty?: React.ReactNode;
};

const pad = (value: number) => String(value).padStart(2, '0');

/** What a product costs from, for the index list — the figure the card
 *  itself falls back to. */
function priceFrom(product: ProductDTO): string | null {
  return product.minPriceCents > 0 ? formatCents(product.minPriceCents) : null;
}

/**
 * A homepage shelf of product cards.
 *
 * The cards are the shop's own `ProductCard`, untouched — swipe, colours,
 * quick view and all — and quick view is owned here exactly as `ProductGrid`
 * owns it. What changes is the composition around them and, scoped to this
 * shelf in CSS, how their captions are set.
 */
export function HomeShelf({ headingId, eyebrow, heading, link, products, layout, empty }: Props) {
  const root = useRef<HTMLElement>(null);
  const [quick, setQuick] = useState<ProductDTO | null>(null);
  const [spot, setSpot] = useState<number | null>(null);

  useGsap(root, (mm) => {
    mm.add(MOTION_OK, () => {
      const section = root.current!;

      gsap.from(section.querySelectorAll('[data-hm-rise]'), {
        yPercent: 110,
        duration: 1.2,
        ease: 'expo.out',
        stagger: 0.08,
        scrollTrigger: { trigger: section, start: 'top 80%', once: true },
      });

      gsap.fromTo(
        section.querySelector('.hm-shelf__title'),
        { '--wdth': 62 },
        {
          '--wdth': 125,
          ease: 'none',
          scrollTrigger: { trigger: section, start: 'top 90%', end: 'top 30%', scrub: 0.8 },
        },
      );

      gsap.from(section.querySelectorAll('.hm-shelf__index li, .hm-shelf__aside > *'), {
        y: 20,
        opacity: 0,
        duration: 1,
        ease: 'expo.out',
        stagger: 0.05,
        scrollTrigger: { trigger: section, start: 'top 70%', once: true },
      });

      // Each card's photograph opens from its foot as the card arrives.
      gsap.utils.toArray<HTMLElement>('.hm-shelf__cell', section).forEach((cell, index) => {
        const media = cell.querySelector('.pcard__media');
        const trigger = { trigger: cell, start: 'top 90%', once: true };
        const offset = layout === 'spread' ? index * 0.1 : (index % 2) * 0.12;

        if (media) {
          gsap.fromTo(
            media,
            { clipPath: 'inset(100% 0% 0% 0%)' },
            { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut', delay: offset, scrollTrigger: trigger },
          );
        }

        gsap.from(cell.querySelectorAll('.pcard__foot, .pcard__colors'), {
          y: 16,
          opacity: 0,
          duration: 1,
          ease: 'expo.out',
          delay: offset + 0.5,
          scrollTrigger: trigger,
        });
      });
    });
  }, [products.length]);

  const spreadClass = layout === 'spread' ? ` hm-shelf__grid--${Math.min(products.length, 3)}` : '';

  return (
    <section
      ref={root}
      className={`hm-shelf hm-shelf--${layout} ${homeFonts}`}
      aria-labelledby={headingId}
    >
      <div className="hm-wrap hm-shelf__wrap">
        <header className="hm-shelf__head">
          <div className="hm-shelf__titles">
            <div className="hm-mask">
              <p className="hm-eyebrow" data-hm-rise>{eyebrow}</p>
            </div>
            <div className="hm-mask hm-mask--tall">
              <h2 id={headingId} className="hm-shelf__title" data-hm-rise>{heading}</h2>
            </div>
          </div>

          <div className="hm-shelf__aside">
            {products.length ? (
              <p className="hm-shelf__count tnum">
                {pad(products.length)} {products.length === 1 ? 'style' : 'styles'}
              </p>
            ) : null}
            <HomePill href={link.href} tone="outline">{link.label}</HomePill>
          </div>

          {layout === 'index' && products.length ? (
            <ol className="hm-shelf__index" onMouseLeave={() => setSpot(null)}>
              {products.map((product, index) => {
                const price = priceFrom(product);

                return (
                  <li key={product.id}>
                    <Link
                      href={`/product/${product.slug}`}
                      className={`hm-shelf__row${spot === index ? ' is-on' : ''}`}
                      onMouseEnter={() => setSpot(index)}
                      onFocus={() => setSpot(index)}
                      onBlur={() => setSpot(null)}
                    >
                      <span className="hm-shelf__num tnum">{pad(index + 1)}</span>
                      <span className="hm-shelf__name">{product.title}</span>
                      {price ? <span className="hm-shelf__price tnum">{price}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : null}
        </header>

        {products.length ? (
          <ul className={`hm-shelf__grid${spreadClass}${spot !== null ? ' is-spotlit' : ''}`}>
            {products.map((product, index) => (
              <li
                key={product.id}
                className={`hm-shelf__cell${spot === index ? ' is-spot' : ''}`}
              >
                <ProductCard product={product} index={index} onQuickView={setQuick} />
              </li>
            ))}
          </ul>
        ) : (
          empty ?? null
        )}
      </div>

      <AnimatePresence>
        {quick ? <QuickView key={quick.id} product={quick} onClose={() => setQuick(null)} /> : null}
      </AnimatePresence>
    </section>
  );
}
