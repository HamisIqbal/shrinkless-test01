'use client';

import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { cropStyle } from '@/lib/media/crop';
import type { BrandImage } from '@/lib/brand/images';
import { homeFonts } from '@/components/home/fonts';
import { HomePill } from '@/components/home/HomePill';
import { gsap, useGsap, MOTION_OK } from '@/components/home/gsap';

type Frame = { href: string; label: string; image: BrandImage };

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * The lookbook as a reel of film on an ink ground.
 *
 * On a desk with motion allowed, the section pins and the vertical scroll
 * runs the reel sideways — frames alternating tall and wide, each drifting
 * inside its own window, a hairline along the foot counting the way through.
 * Everywhere else the reel is simply a horizontal scroller with snap points,
 * so a phone swipes it and reduced motion never pins anything.
 *
 * Frame numbers are the reel's own vocabulary: a contact sheet counts its
 * frames. Keeps the `lookbook` class for the Media tab.
 */
export function HomeLookbookReel({ frames }: { frames: Frame[] }) {
  const root = useRef<HTMLElement>(null);

  useGsap(root, (mm) => {
    mm.add(
      { motion: MOTION_OK, desk: '(min-width: 62rem)' },
      (context) => {
        const { motion, desk } = context.conditions as { motion: boolean; desk: boolean };
        if (!motion) return;

        const section = root.current!;
        const viewport = section.querySelector<HTMLElement>('.hm-look__viewport')!;
        const track = section.querySelector<HTMLElement>('.hm-look__track')!;

        gsap.from(section.querySelectorAll('[data-hm-rise]'), {
          yPercent: 110,
          duration: 1.2,
          ease: 'expo.out',
          stagger: 0.08,
          scrollTrigger: { trigger: section, start: 'top 75%', once: true },
        });

        if (!desk) {
          gsap.from(section.querySelectorAll('.hm-look__item'), {
            x: 60,
            opacity: 0,
            duration: 1.2,
            ease: 'expo.out',
            stagger: 0.06,
            scrollTrigger: { trigger: viewport, start: 'top 85%', once: true },
          });
          return;
        }

        const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);

        const reel = gsap.to(track, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 0.9,
            invalidateOnRefresh: true,
            anticipatePin: 1,
          },
        });

        gsap.fromTo(
          section.querySelector('.hm-look__bar'),
          { scaleX: 0 },
          { scaleX: 1, ease: 'none', scrollTrigger: { containerAnimation: reel, trigger: track, start: 'left left', end: 'right right', scrub: true } },
        );

        // Each photograph slides against its window as the reel carries it.
        section.querySelectorAll<HTMLElement>('.hm-look__item').forEach((item) => {
          const photo = item.querySelector('.hm-look__photo');
          if (!photo) return;

          gsap.fromTo(
            photo,
            { xPercent: -8 },
            {
              xPercent: 8,
              ease: 'none',
              scrollTrigger: { containerAnimation: reel, trigger: item, start: 'left right', end: 'right left', scrub: true },
            },
          );
        });
      },
    );
  }, [frames.length]);

  return (
    <section ref={root} className={`lookbook hm-look ${homeFonts}`} aria-labelledby="lookbook-heading">
      <div className="hm-wrap hm-look__head">
        <div>
          <div className="hm-mask">
            <p className="hm-eyebrow" data-hm-rise>Lookbook</p>
          </div>
          <div className="hm-mask hm-mask--tall">
            <h2 id="lookbook-heading" className="hm-look__title" data-hm-rise>
              <span className="hm-look__serif">On the</span> body.
            </h2>
          </div>
        </div>

        <div className="hm-look__aside">
          <p className="hm-look__count tnum">{pad(frames.length)} frames</p>
          <HomePill href="/shop" tone="ghost">Shop all</HomePill>
        </div>
      </div>

      <div className="hm-look__viewport">
        <ul className="hm-look__track">
          {frames.map((frame, index) => (
            <li key={`${frame.href}-${frame.label}`} className={`hm-look__item hm-look__item--${index % 2 ? 'wide' : 'tall'}`}>
              <Link href={frame.href} className="hm-look__tile">
                <span className="hm-look__frame">
                  <span className="hm-look__photo">
                    <Image
                      src={frame.image.url}
                      alt={frame.image.alt}
                      fill
                      loading="lazy"
                      sizes="(min-width: 62rem) 40vw, 80vw"
                      className="lookbook__image hm-look__image"
                      style={cropStyle(frame.image)}
                    />
                  </span>
                </span>
                <span className="hm-look__cap">
                  <span className="hm-look__num tnum">{pad(index + 1)}</span>
                  <span className="hm-look__label">{frame.label}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="hm-wrap hm-look__foot" aria-hidden="true">
        <span className="hm-look__progress"><span className="hm-look__bar" /></span>
      </div>
    </section>
  );
}
