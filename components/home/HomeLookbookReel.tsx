'use client';

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { cropStyle } from '@/lib/media/crop';
import type { BrandImage } from '@/lib/brand/images';
import { homeFonts } from '@/components/home/fonts';
import { gsap, useGsap, MOTION_OK } from '@/components/home/gsap';

type Frame = { href: string; label: string; image: BrandImage };

/**
 * The gallery.
 *
 * One word over the pictures — Gallery, centred and bold — and then nothing
 * but the pictures. The eyebrow, the headline, the frame count, the shop
 * link and the per-frame captions are all gone: a gallery labels itself.
 *
 * On a desk it is a single large photograph in the middle of the section
 * with a small arrow either side of it, every frame cut to the same window so
 * stepping through never resizes anything or leaves a gap at an edge. Below
 * that breakpoint it is exactly what it was — a horizontal reel of alternating
 * tall and wide frames that a thumb swipes, with snap points.
 *
 * Both are the same list: the desk stacks it into one window in CSS rather
 * than rendering a second copy of the photographs.
 *
 * Keeps the `lookbook` class for the Media tab.
 */
export function HomeLookbookReel({ frames }: { frames: Frame[] }) {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const count = frames.length;

  const step = useCallback(
    (delta: number) => setActive((index) => (index + delta + count) % count),
    [count],
  );

  useGsap(root, (mm) => {
    mm.add(
      { motion: MOTION_OK, desk: '(min-width: 62rem)' },
      (context) => {
        const { motion, desk } = context.conditions as { motion: boolean; desk: boolean };
        if (!motion) return;

        const section = root.current!;

        gsap.from(section.querySelectorAll('[data-hm-rise]'), {
          yPercent: 110,
          duration: 1.2,
          ease: 'expo.out',
          scrollTrigger: { trigger: section, start: 'top 75%', once: true },
        });

        // The reel is only a reel below the desk breakpoint; above it the list
        // is stacked into one window and the stylesheet owns each frame's
        // opacity, so a tween that wrote its own would fight the arrows.
        if (desk) return;

        gsap.from(section.querySelectorAll('.hm-look__item'), {
          x: 60,
          opacity: 0,
          duration: 1.2,
          ease: 'expo.out',
          stagger: 0.06,
          scrollTrigger: { trigger: section.querySelector('.hm-look__viewport'), start: 'top 85%', once: true },
        });
      },
    );
  }, [count]);

  return (
    <section ref={root} className={`lookbook hm-look ${homeFonts}`} aria-labelledby="lookbook-heading">
      <div className="hm-wrap hm-look__head">
        <div className="hm-mask hm-mask--tall">
          <h2 id="lookbook-heading" className="hm-look__title" data-hm-rise>
            Gallery
          </h2>
        </div>
      </div>

      <div className="hm-look__stage">
        <button
          type="button"
          className="hm-look__arrow hm-look__arrow--prev"
          onClick={() => step(-1)}
          disabled={count < 2}
        >
          <span className="hm-look__chev" aria-hidden="true" />
          <span className="visually-hidden">Previous frame</span>
        </button>

        <div className="hm-look__viewport">
          <ul className="hm-look__track">
            {frames.map((frame, index) => (
              <li
                key={`${frame.href}-${frame.label}`}
                className={`hm-look__item hm-look__item--${index % 2 ? 'wide' : 'tall'}`}
                data-active={index === active ? '' : undefined}
              >
                {/* Above the breakpoint the frames off-stage are hidden with
                    `visibility`, which takes them out of the tab order too —
                    so the one on show is the only one a keyboard reaches, and
                    below the breakpoint all of them stay reachable. */}
                <Link href={frame.href} className="hm-look__tile">
                  <span className="visually-hidden">{frame.label}</span>
                  <span className="hm-look__frame">
                    <span className="hm-look__photo">
                      <Image
                        src={frame.image.url}
                        alt={frame.image.alt}
                        fill
                        loading={index < 2 ? 'eager' : 'lazy'}
                        sizes="(min-width: 62rem) 46rem, 80vw"
                        className="lookbook__image hm-look__image"
                        style={cropStyle(frame.image)}
                      />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          className="hm-look__arrow hm-look__arrow--next"
          onClick={() => step(1)}
          disabled={count < 2}
        >
          <span className="hm-look__chev" aria-hidden="true" />
          <span className="visually-hidden">Next frame</span>
        </button>
      </div>
    </section>
  );
}
