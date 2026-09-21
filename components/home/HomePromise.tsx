'use client';

import { useRef } from 'react';
import { SlotMedia } from '@/components/site/SlotMedia';
import { cropStyle } from '@/lib/media/crop';
import type { BrandImage } from '@/lib/brand/images';
import { homeFonts } from '@/components/home/fonts';
import { gsap, useGsap, MOTION_OK } from '@/components/home/gsap';

type Props = {
  image: BrandImage;
  eyebrow: string;
  headline: string;
  body: string;
};

/** "Wash it. Dry it. Wear it." → one line per sentence. Falls back to the
 *  whole headline when it is not written as sentences. */
function sentences(text: string): string[] {
  const found = text.match(/[^.!?]+[.!?]+/g)?.map((part) => part.trim()).filter(Boolean);
  return found?.length ? found : [text];
}

/**
 * The promise, as the page's full-bleed statement.
 *
 * Each sentence of the headline takes a line of its own, alternating Archivo
 * and the accent face and stepping across the frame, and slides in from its own side
 * as the band comes up. The body sits in a care-label box — the one place on
 * the page the garment's own paperwork is quoted. Keeps the `imageband` class
 * for the Media tab's "Promise band" height and ground.
 */
export function HomePromise({ image, eyebrow, headline, body }: Props) {
  const root = useRef<HTMLElement>(null);
  const lines = sentences(headline);

  useGsap(root, (mm) => {
    mm.add(MOTION_OK, () => {
      const section = root.current!;

      gsap.fromTo(
        section.querySelector('.hm-promise__media'),
        { yPercent: -10, scale: 1.12 },
        {
          yPercent: 10,
          scale: 1,
          ease: 'none',
          scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true },
        },
      );

      section.querySelectorAll<HTMLElement>('.hm-promise__line').forEach((line, index) => {
        gsap.fromTo(
          line,
          { xPercent: index % 2 ? 18 : -18, opacity: 0 },
          {
            xPercent: 0,
            opacity: 1,
            ease: 'none',
            scrollTrigger: { trigger: section, start: `top ${85 - index * 8}%`, end: `top ${35 - index * 8}%`, scrub: 0.8 },
          },
        );
      });

      gsap.from(section.querySelectorAll('.hm-promise__eyebrow, .hm-promise__label'), {
        y: 24,
        opacity: 0,
        duration: 1.1,
        ease: 'expo.out',
        stagger: 0.12,
        scrollTrigger: { trigger: section, start: 'top 45%', once: true },
      });
    });
  }, [headline]);

  return (
    <section ref={root} className={`imageband hm-promise ${homeFonts}`} aria-labelledby="promise-heading">
      <div className="hm-promise__media">
        <SlotMedia
          src={image.url}
          alt={image.alt}
          fill
          sizes="100vw"
          className="imageband__image hm-promise__image"
          style={cropStyle(image)}
        />
      </div>
      <div className="hm-promise__scrim" aria-hidden="true" />

      <div className="hm-wrap hm-promise__inner">
        <p className="hm-promise__eyebrow">
          <span className="hm-promise__rule" aria-hidden="true" />
          <span>{eyebrow}</span>
        </p>

        <h2 id="promise-heading" className="hm-promise__head">
          {lines.map((line, index) => (
            <span key={index}>
              {index > 0 ? ' ' : null}
              <span className={`hm-promise__line hm-promise__line--${index % 2 ? 'serif' : 'sans'}`}>{line}</span>
            </span>
          ))}
        </h2>

        {body ? (
          <div className="hm-promise__label">
            <span className="hm-promise__labelhead" aria-hidden="true">Care</span>
            <p className="hm-promise__body">{body}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
