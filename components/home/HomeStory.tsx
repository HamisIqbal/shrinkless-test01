'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { cropStyle } from '@/lib/media/crop';
import type { BrandImage } from '@/lib/brand/images';
import { homeFonts } from '@/components/home/fonts';
import { HomePill } from '@/components/home/HomePill';
import { gsap, useGsap, MOTION_OK } from '@/components/home/gsap';

export type Chapter = {
  title: string;
  body: string;
  image: BrandImage;
  href: string;
  /** The destination, named — the pill's label. */
  label: string;
};

/**
 * The two brand statements as chapters beside one pinned photograph.
 *
 * On a desk the frame holds in the left column while the chapters scroll past
 * on the right, and each chapter wipes its own photograph up over the last as
 * it arrives — the picture always belongs to the words beside it. On a phone
 * each chapter simply carries its own frame. Keeps the `tiles` class so the
 * Media tab's "Story tiles" settings still land.
 */
export function HomeStory({ chapters }: { chapters: Chapter[] }) {
  const root = useRef<HTMLElement>(null);

  useGsap(root, (mm) => {
    mm.add(
      { motion: MOTION_OK, desk: '(min-width: 62rem)' },
      (context) => {
        const { motion, desk } = context.conditions as { motion: boolean; desk: boolean };
        if (!motion) return;

        const section = root.current!;
        const articles = gsap.utils.toArray<HTMLElement>('.hm-story__chapter', section);

        articles.forEach((article) => {
          gsap.from(article.querySelectorAll('[data-hm-rise]'), {
            yPercent: 110,
            duration: 1.2,
            ease: 'expo.out',
            stagger: 0.08,
            scrollTrigger: { trigger: article, start: desk ? 'top 65%' : 'top 85%', once: true },
          });

          gsap.from(article.querySelectorAll('[data-hm-fade]'), {
            y: 24,
            opacity: 0,
            duration: 1.1,
            ease: 'expo.out',
            stagger: 0.08,
            delay: 0.2,
            scrollTrigger: { trigger: article, start: desk ? 'top 65%' : 'top 85%', once: true },
          });
        });

        if (!desk) {
          section.querySelectorAll<HTMLElement>('.hm-story__own').forEach((frame) => {
            gsap.fromTo(
              frame,
              { clipPath: 'inset(100% 0% 0% 0%)' },
              { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut', scrollTrigger: { trigger: frame, start: 'top 88%', once: true } },
            );
          });
          return;
        }

        const shots = gsap.utils.toArray<HTMLElement>('.hm-story__shot', section);

        // The first frame settles as the section arrives...
        gsap.fromTo(
          shots[0]?.querySelector('img') ?? null,
          { scale: 1.2 },
          { scale: 1, ease: 'none', scrollTrigger: { trigger: section, start: 'top bottom', end: 'top top', scrub: true } },
        );

        // ...and each later one wipes up over it with its own chapter.
        shots.slice(1).forEach((shot, index) => {
          const article = articles[index + 1];
          if (!article) return;

          gsap.fromTo(
            shot,
            { clipPath: 'inset(100% 0% 0% 0%)' },
            {
              clipPath: 'inset(0% 0% 0% 0%)',
              ease: 'none',
              scrollTrigger: { trigger: article, start: 'top bottom', end: 'top 35%', scrub: 0.6 },
            },
          );

          gsap.fromTo(
            shot.querySelector('img'),
            { scale: 1.25 },
            { scale: 1, ease: 'none', scrollTrigger: { trigger: article, start: 'top bottom', end: 'top 35%', scrub: 0.6 } },
          );
        });

        // The running count on the frame follows whichever chapter is reading.
        const now = section.querySelector('.hm-story__now');
        articles.forEach((article, index) => {
          gsap.timeline({
            scrollTrigger: {
              trigger: article,
              start: 'top 50%',
              end: 'bottom 50%',
              onToggle: (self) => {
                if (self.isActive && now) now.textContent = String(index + 1).padStart(2, '0');
              },
            },
          });
        });
      },
    );
  }, [chapters.length]);

  return (
    <section ref={root} className={`tiles hm-story ${homeFonts}`} aria-label="Why Shrinkless">
      <div className="hm-wrap hm-story__grid">
        <div className="hm-story__media" aria-hidden="true">
          <div className="hm-story__frame">
            {chapters.map((chapter, index) => (
              <div key={chapter.title} className="hm-story__shot" style={{ zIndex: index + 1 }}>
                <Image
                  src={chapter.image.url}
                  alt=""
                  fill
                  loading="lazy"
                  sizes="(min-width: 62rem) 45vw, 0px"
                  className="tiles__image hm-story__image"
                  style={cropStyle(chapter.image)}
                />
              </div>
            ))}

            <p className="hm-story__counter tnum">
              <span className="hm-story__now">01</span> / {String(chapters.length).padStart(2, '0')}
            </p>
          </div>
        </div>

        <div className="hm-story__chapters">
          {chapters.map((chapter) => (
            <article key={chapter.title} className="hm-story__chapter">
              <div className="hm-story__own">
                <Image
                  src={chapter.image.url}
                  alt={chapter.image.alt}
                  fill
                  loading="lazy"
                  sizes="(max-width: 61.9375rem) 100vw, 0px"
                  className="tiles__image hm-story__image"
                  style={cropStyle(chapter.image)}
                />
              </div>

              <div className="hm-mask hm-mask--tall">
                <h2 className="hm-story__title" data-hm-rise>{chapter.title}</h2>
              </div>
              <p className="hm-story__body" data-hm-fade>{chapter.body}</p>
              <div data-hm-fade>
                <HomePill href={chapter.href} tone="outline">{chapter.label}</HomePill>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
