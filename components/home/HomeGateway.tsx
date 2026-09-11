'use client';

import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { cropStyle } from '@/lib/media/crop';
import { ArrowIcon } from '@/components/site/icons';
import type { Gateway } from '@/components/shop/CategoryGateway';
import { homeFonts } from '@/components/home/fonts';
import { gsap, useGsap, MOTION_OK } from '@/components/home/gsap';

type Props = {
  gateways: Gateway[];
};

/**
 * Men and Women, the homepage's two shopping doors.
 *
 * Two tall frames on an ink ground, the second set lower than the first so
 * the pair reads as a spread rather than a pair of cards. Each name is set in
 * Archivo at its narrowest and widens to full width as its frame comes up the
 * screen — the brand's promise, drawn in type: nothing here shrinks.
 *
 * Everything that moves has a finished resting state in CSS, so reduced
 * motion and a failed script both land on the complete layout.
 */
export function HomeGateway({ gateways }: Props) {
  const root = useRef<HTMLElement>(null);

  useGsap(root, (mm) => {
    mm.add(
      { motion: MOTION_OK, wide: '(min-width: 48rem)' },
      (context) => {
        const { motion, wide } = context.conditions as { motion: boolean; wide: boolean };
        if (!motion) return;

        const section = root.current!;
        const tiles = gsap.utils.toArray<HTMLElement>('.hm-gw__cell', section);

        gsap.from(section.querySelectorAll('.hm-gw__head > *'), {
          yPercent: 100,
          opacity: 0,
          duration: 1.1,
          ease: 'expo.out',
          stagger: 0.08,
          scrollTrigger: { trigger: section, start: 'top 80%', once: true },
        });

        tiles.forEach((tile, index) => {
          const frame = tile.querySelector('.hm-gw__frame');
          const photo = tile.querySelector('.hm-gw__photo');
          const label = tile.querySelector('.hm-gw__label');
          const chars = tile.querySelectorAll('.hm-gw__char');
          const foot = tile.querySelectorAll('.hm-gw__foot > *');

          // The frame opens from a narrow window to full bleed.
          gsap.fromTo(
            frame,
            { clipPath: 'inset(14% 10% 14% 10%)' },
            {
              clipPath: 'inset(0% 0% 0% 0%)',
              duration: 1.6,
              ease: 'expo.out',
              delay: wide ? index * 0.12 : 0,
              scrollTrigger: { trigger: tile, start: 'top 88%', once: true },
            },
          );

          gsap.fromTo(
            photo,
            { scale: 1.3 },
            {
              scale: 1,
              duration: 2,
              ease: 'expo.out',
              delay: wide ? index * 0.12 : 0,
              scrollTrigger: { trigger: tile, start: 'top 88%', once: true },
            },
          );

          // Parallax inside the frame, the whole way through the viewport.
          gsap.fromTo(
            photo,
            { yPercent: -7 },
            {
              yPercent: 7,
              ease: 'none',
              scrollTrigger: { trigger: tile, start: 'top bottom', end: 'bottom top', scrub: true },
            },
          );

          // The letters rise once...
          gsap.from(chars, {
            yPercent: 110,
            duration: 1.2,
            ease: 'expo.out',
            stagger: 0.045,
            scrollTrigger: { trigger: tile, start: 'top 70%', once: true },
          });

          // ...and the word widens with the scroll, narrow to full.
          gsap.fromTo(
            label,
            { '--wdth': 62 },
            {
              '--wdth': 125,
              ease: 'none',
              scrollTrigger: { trigger: tile, start: 'top 85%', end: 'center 45%', scrub: 0.8 },
            },
          );

          gsap.from(foot, {
            y: 18,
            opacity: 0,
            duration: 1,
            ease: 'expo.out',
            stagger: 0.08,
            scrollTrigger: { trigger: tile, start: 'top 60%', once: true },
          });
        });

        // The spread: the lower door drifts against the upper one.
        if (wide && tiles[1]) {
          gsap.fromTo(
            tiles[1],
            { y: 70 },
            {
              y: -70,
              ease: 'none',
              scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true },
            },
          );
        }
      },
    );
  }, [gateways]);

  return (
    <section className={`hm-gw ${homeFonts}`} aria-labelledby="gateway-heading" ref={root}>
      <div className="hm-gw__wrap">
        <div className="hm-gw__head">
          <h2 id="gateway-heading" className="hm-gw__eyebrow">Shop by category</h2>
          <p className="hm-gw__note">
            <span className="hm-gw__serif">Cut for</span> {gateways.map((g) => g.label).join(' & ')}
          </p>
        </div>

        <ul className="hm-gw__grid">
          {gateways.map((gateway) => {
            const image = gateway.image;
            const styles = `${gateway.count} ${gateway.count === 1 ? 'style' : 'styles'}`;

            return (
              <li key={gateway.slug} className="hm-gw__cell">
                <Link href={`/shop/${gateway.slug}`} className="hm-gw__tile">
                  <div className="hm-gw__frame">
                    <div className="hm-gw__photo">
                      <Image
                        src={image.url}
                        alt={image.alt}
                        fill
                        loading="lazy"
                        sizes="(min-width: 48rem) 50vw, 100vw"
                        className="gateway__image hm-gw__image"
                        style={cropStyle(image)}
                      />
                    </div>
                    <span className="hm-gw__wash" aria-hidden="true" />

                    <span className="hm-gw__count tnum">{styles}</span>

                    <span className="hm-gw__label" aria-hidden="true">
                      {gateway.label.split('').map((char, index) => (
                        <span key={index} className="hm-gw__charmask">
                          <span className="hm-gw__char">{char}</span>
                        </span>
                      ))}
                    </span>
                    <span className="visually-hidden">{gateway.label}</span>
                  </div>

                  <span className="hm-gw__foot">
                    <span className="hm-gw__cta">
                      <span className="hm-gw__ctatext">Shop {gateway.label}</span>
                      <span className="hm-gw__ctaline" aria-hidden="true" />
                    </span>
                    <span className="hm-gw__arrow" aria-hidden="true">
                      <ArrowIcon />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
