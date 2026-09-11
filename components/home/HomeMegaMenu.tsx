'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion, type Variants } from 'motion/react';
import type { ShopMenu } from '@/lib/shop/navigation';
import { ArrowIcon } from '@/components/site/icons';

type Props = {
  menu: ShopMenu;
  open: boolean;
  id: string;
  onNavigate: () => void;
};

const CURTAIN = [0.76, 0, 0.24, 1] as const;
const LAND = [0.16, 1, 0.3, 1] as const;

/* The sheet drops like a blind; its contents rise through their own masks a
   beat behind it, column by column, then row by row. Closing is quicker and
   unstaggered — leaving should never be the slow part. */
const sheet: Variants = {
  open: {
    clipPath: 'inset(0% 0% 0% 0%)',
    transition: { duration: 0.7, ease: CURTAIN, delayChildren: 0.18, staggerChildren: 0.06 },
  },
  closed: {
    clipPath: 'inset(0% 0% 100% 0%)',
    transition: { duration: 0.5, ease: CURTAIN, delay: 0.05 },
  },
};

const column: Variants = {
  open: { transition: { staggerChildren: 0.035 } },
  closed: {},
};

const rise: Variants = {
  open: { y: '0%', opacity: 1, transition: { duration: 0.8, ease: LAND } },
  closed: { y: '105%', opacity: 0, transition: { duration: 0.25 } },
};

const frame: Variants = {
  open: { clipPath: 'inset(0% 0% 0% 0%)', transition: { duration: 1, ease: CURTAIN } },
  closed: { clipPath: 'inset(100% 0% 0% 0%)', transition: { duration: 0.3 } },
};

const photo: Variants = {
  open: { scale: 1, transition: { duration: 1.4, ease: LAND } },
  closed: { scale: 1.25, transition: { duration: 0.3 } },
};

/**
 * The homepage's shop panel: an ink sheet under an ink bar.
 *
 * Mounted throughout so both directions animate, and `inert` while closed so
 * its links cannot be tabbed into. The header owns the open state.
 */
export function HomeMegaMenu({ menu, open, id, onNavigate }: Props) {
  return (
    <motion.div
      id={id}
      className={`hm-mega${open ? ' is-open' : ''}`}
      inert={!open}
      aria-label="Shop"
      initial={false}
      animate={open ? 'open' : 'closed'}
      variants={sheet}
      data-lenis-prevent
    >
      <div className="hm-mega__inner">
        <div className="hm-mega__cols">
          {menu.columns.map((col) => (
            <motion.nav key={col.title} className="hm-mega__col" aria-label={col.title} variants={column}>
              <div className="hm-mask">
                <motion.div variants={rise}>
                  {col.href ? (
                    <Link href={col.href} className="hm-mega__title" onClick={onNavigate}>
                      {col.title}
                    </Link>
                  ) : (
                    <p className="hm-mega__title">{col.title}</p>
                  )}
                </motion.div>
              </div>

              <ul className="hm-mega__links">
                {col.links.map((link) => (
                  <li key={`${col.title}-${link.href}-${link.label}`} className="hm-mask">
                    <motion.div variants={rise}>
                      <Link href={link.href} className="hm-mega__link" onClick={onNavigate}>
                        <ArrowIcon className="hm-mega__arrow" />
                        <span>{link.label}</span>
                      </Link>
                    </motion.div>
                  </li>
                ))}
              </ul>
            </motion.nav>
          ))}
        </div>

        <div className="hm-mega__features">
          {menu.features.map((feature) => (
            <Link
              key={feature.href}
              href={feature.href}
              className="hm-mega__feature"
              onClick={onNavigate}
            >
              <motion.div className="hm-mega__frame" variants={frame}>
                <motion.div className="hm-mega__photo" variants={photo}>
                  <Image
                    src={feature.image.url}
                    alt={feature.image.alt}
                    fill
                    loading="lazy"
                    sizes="(min-width: 62rem) 18vw, 0px"
                  />
                </motion.div>
              </motion.div>

              <div className="hm-mask">
                <motion.span className="hm-mega__featurefoot" variants={rise}>
                  <span className="hm-mega__featurelabel">{feature.label}</span>
                  <span className="hm-mega__caption">{feature.caption}</span>
                </motion.span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
