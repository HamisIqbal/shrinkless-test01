'use client';

import { useRef, useState } from 'react';
import { motion, type Variants } from 'motion/react';
import type { Quote } from '@/components/editorial/QuoteRow';
import { ArrowIcon } from '@/components/site/icons';
import { homeFonts } from '@/components/home/fonts';
import { gsap, useGsap, MOTION_OK } from '@/components/home/gsap';

type Props = {
  eyebrow: string;
  heading: string;
  quotes: Quote[];
};

const LAND = [0.16, 1, 0.3, 1] as const;

const quoteVariants: Variants = {
  on: { transition: { staggerChildren: 0.035, delayChildren: 0.1 } },
  off: { transition: { staggerChildren: 0.01, staggerDirection: -1 } },
};

const wordVariants: Variants = {
  on: { y: '0%', opacity: 1, transition: { duration: 0.9, ease: LAND } },
  off: { y: '105%', opacity: 0, transition: { duration: 0.35, ease: [0.7, 0, 0.84, 0] } },
};

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * One review at a time, set large in Bodoni italic, with the others a click
 * away.
 *
 * Every quote stays in the page — stacked in one cell, the resting ones
 * hidden — so a screen reader can reach each of them and the Content tab can
 * still find all three by their words. Moving between them drops the words of
 * the last one away and raises the next one's in, word by word. Keeps the
 * `quotes` class for the Media tab.
 */
export function HomeReviews({ eyebrow, heading, quotes }: Props) {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const count = quotes.length;

  const go = (step: number) => setActive((current) => (current + step + count) % count);

  useGsap(root, (mm) => {
    mm.add(MOTION_OK, () => {
      const section = root.current!;

      gsap.from(section.querySelectorAll('[data-hm-rise]'), {
        yPercent: 110,
        duration: 1.2,
        ease: 'expo.out',
        stagger: 0.08,
        scrollTrigger: { trigger: section, start: 'top 75%', once: true },
      });

      gsap.from(section.querySelectorAll('.hm-quotes__controls, .hm-quotes__mark'), {
        y: 24,
        opacity: 0,
        duration: 1.1,
        ease: 'expo.out',
        stagger: 0.1,
        scrollTrigger: { trigger: section, start: 'top 70%', once: true },
      });
    });
  });

  return (
    <section ref={root} className={`quotes hm-quotes ${homeFonts}`} aria-labelledby="quotes-heading">
      <div className="hm-wrap hm-quotes__grid">
        <div className="hm-quotes__head">
          <div className="hm-mask">
            <p className="hm-eyebrow" data-hm-rise>{eyebrow}</p>
          </div>
          <div className="hm-mask hm-mask--tall">
            <h2 id="quotes-heading" className="hm-quotes__title" data-hm-rise>{heading}</h2>
          </div>

          {count > 1 ? (
            <div className="hm-quotes__controls">
              <button type="button" className="hm-quotes__btn hm-quotes__btn--prev" onClick={() => go(-1)}>
                <ArrowIcon />
                <span className="visually-hidden">Previous review</span>
              </button>
              <p className="hm-quotes__count tnum" aria-live="polite">
                <span className="visually-hidden">Review </span>
                {pad(active + 1)}
                <span className="hm-quotes__of"> / {pad(count)}</span>
              </p>
              <button type="button" className="hm-quotes__btn" onClick={() => go(1)}>
                <ArrowIcon />
                <span className="visually-hidden">Next review</span>
              </button>
            </div>
          ) : null}
        </div>

        <div className="hm-quotes__stage">
          <span className="hm-quotes__mark" aria-hidden="true">&ldquo;</span>

          <div className="hm-quotes__stack">
            {quotes.map((quote, index) => {
              const on = index === active;

              return (
                <motion.figure
                  key={`${quote.name}-${index}`}
                  className={`hm-quotes__item${on ? ' is-on' : ''}`}
                  aria-hidden={!on || undefined}
                  initial={false}
                  animate={on ? 'on' : 'off'}
                  variants={quoteVariants}
                >
                  <blockquote className="hm-quotes__text">
                    {quote.text.trim().split(/\s+/).map((word, w) => (
                      <span key={w}>
                        {w > 0 ? ' ' : null}
                        <span className="hm-wordmask">
                          <motion.span className="hm-word" variants={wordVariants}>{word}</motion.span>
                        </span>
                      </span>
                    ))}
                  </blockquote>
                  <motion.figcaption className="hm-quotes__name" variants={wordVariants}>
                    {quote.name}
                  </motion.figcaption>
                </motion.figure>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
