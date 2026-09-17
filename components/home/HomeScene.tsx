'use client';

import { useEffect, useRef, type ElementType, type ReactNode } from 'react';
import { gsap, ScrollTrigger, useGsap, MOTION_OK } from '@/components/home/gsap';
import './home-sections.css';

type Props = {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  [attribute: `aria-${string}`]: string | undefined;
  id?: string;
};

/**
 * A section whose children animate by attribute, so the section itself can
 * stay a server component and only this wrapper ships as JavaScript.
 *
 *   data-hm-rise       rises through its parent's mask, once
 *   data-hm-fade       lifts and fades in, once
 *   data-hm-widen      Archivo's width axis, narrow to full, with the scroll
 *   data-hm-reveal     a frame that opens from its foot; a [data-hm-zoom]
 *                      inside it settles from a scale as it does
 *   data-hm-parallax   drifts by the given percentage through the viewport
 *   data-hm-delay      seconds, for anything that enters with a neighbour
 *
 * Every attribute describes a movement *into* the element's CSS resting
 * state, so reduced motion — or a script that never runs — shows the finished
 * layout.
 */
export function HomeScene({ as: Tag = 'section', className, children, ...rest }: Props) {
  const root = useRef<HTMLElement>(null);

  useGsap(root, (mm) => {
    mm.add(MOTION_OK, () => {
      const scope = root.current!;
      const all = (selector: string) => gsap.utils.toArray<HTMLElement>(selector, scope);
      const delay = (node: HTMLElement) => Number(node.dataset.hmDelay ?? 0);

      all('[data-hm-rise]').forEach((node) => {
        gsap.from(node, {
          yPercent: 110,
          duration: 1.2,
          ease: 'expo.out',
          delay: delay(node),
          scrollTrigger: { trigger: node.parentElement ?? node, start: 'top 90%', once: true },
        });
      });

      all('[data-hm-fade]').forEach((node) => {
        gsap.from(node, {
          y: 28,
          opacity: 0,
          duration: 1.1,
          ease: 'expo.out',
          delay: delay(node),
          scrollTrigger: { trigger: node, start: 'top 92%', once: true },
        });
      });

      all('[data-hm-widen]').forEach((node) => {
        gsap.fromTo(
          node,
          { '--wdth': 62 },
          {
            '--wdth': 125,
            ease: 'none',
            scrollTrigger: { trigger: node, start: 'top 95%', end: 'top 40%', scrub: 0.8 },
          },
        );
      });

      all('[data-hm-reveal]').forEach((node) => {
        const zoom = node.querySelector('[data-hm-zoom]');
        const trigger = { trigger: node, start: 'top 88%', once: true };

        gsap.fromTo(
          node,
          { clipPath: 'inset(100% 0% 0% 0%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut', delay: delay(node), scrollTrigger: trigger },
        );

        if (zoom) {
          gsap.fromTo(
            zoom,
            { scale: 1.3 },
            { scale: 1, duration: 2.2, ease: 'expo.out', delay: delay(node), scrollTrigger: trigger },
          );
        }
      });

      all('[data-hm-parallax]').forEach((node) => {
        const amount = Number(node.dataset.hmParallax) || 8;
        gsap.fromTo(
          node,
          { yPercent: -amount },
          {
            yPercent: amount,
            ease: 'none',
            scrollTrigger: {
              trigger: node.parentElement ?? node,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          },
        );
      });
    });
  });

  return (
    <Tag ref={root} className={className} {...rest}>
      {children}
    </Tag>
  );
}

/**
 * Rendered once, last on the page. Triggers are made section by section as
 * each one mounts — so once everything is in, positions are sorted and measured
 * again, and again when late photographs and fonts change the page's height.
 */
export function HomeScrollSync() {
  useEffect(() => {
    const refresh = () => {
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
    };

    const frame = requestAnimationFrame(refresh);
    document.fonts?.ready.then(refresh);
    window.addEventListener('load', refresh);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('load', refresh);
    };
  }, []);

  return null;
}
