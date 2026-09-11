'use client';

import { useRef } from 'react';
import { homeFonts } from '@/components/home/fonts';
import { gsap, ScrollTrigger, useGsap, MOTION_OK } from '@/components/home/gsap';

const PLACEHOLDER =
  'Future announcements will appear here — restocks, new releases and Shrinkless news.';

/** Pixels per second at rest. Slow enough to read without chasing it. */
const SPEED = 38;

/**
 * A wash-tub care symbol, drawn as the separator. Small, and in the subject's
 * own vocabulary rather than a bullet.
 */
function TubMark() {
  return (
    <svg className="hm-announce__mark" viewBox="0 0 16 12" aria-hidden="true" focusable="false">
      <path
        d="M1.5 2.5 3.2 10.5h9.6l1.7-8M2.4 4.6c1.2-.9 2.4-.9 3.6 0s2.4.9 3.6 0 2.4-.9 3.6 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The homepage's announcement line.
 *
 * Same seamless-loop construction as the shop ticker — the track holds the
 * message twice and travels half its width — but driven by GSAP so it can
 * answer the page: a scroll kicks it forward, scrolling back runs it in
 * reverse for a beat, and a pointer resting on it brings it to a stop so the
 * line can be read. Under reduced motion it is a single still line.
 */
export function HomeAnnounce({ message }: { message?: string }) {
  const text = message?.trim() || PLACEHOLDER;
  const root = useRef<HTMLDivElement>(null);
  const copies = [0, 1, 2, 3];

  useGsap(root, (mm) => {
    mm.add(MOTION_OK, () => {
      const node = root.current!;
      const track = node.querySelector<HTMLElement>('.hm-announce__track')!;
      const half = track.firstElementChild as HTMLElement;

      // The entrance is a CSS animation, so it runs from first paint rather
      // than after hydration. GSAP only takes the loop.
      const loop = gsap.to(track, {
        x: () => -half.offsetWidth,
        duration: () => half.offsetWidth / SPEED,
        ease: 'none',
        repeat: -1,
        invalidateOnRefresh: true,
      });

      // Far enough into an endless loop that running it backwards never
      // reaches the beginning and stops.
      loop.totalTime(loop.duration() * 400);

      // Scroll velocity nudges the loop and then lets it settle back.
      let direction = 1;
      let holding = false;

      ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate(self) {
          const velocity = self.getVelocity();
          if (holding || Math.abs(velocity) < 40) return;
          direction = velocity < 0 ? -1 : 1;
          const boost = gsap.utils.clamp(1, 5, Math.abs(velocity) / 320);
          loop.timeScale(direction * boost);
          gsap.to(loop, { timeScale: direction, duration: 1.4, ease: 'power2.out', overwrite: true });
        },
      });

      const hold = () => {
        holding = true;
        gsap.to(loop, { timeScale: 0, duration: 0.6, ease: 'power2.out', overwrite: true });
      };
      const release = () => {
        holding = false;
        gsap.to(loop, { timeScale: direction, duration: 0.9, ease: 'power2.in', overwrite: true });
      };

      node.addEventListener('pointerenter', hold);
      node.addEventListener('pointerleave', release);

      return () => {
        node.removeEventListener('pointerenter', hold);
        node.removeEventListener('pointerleave', release);
      };
    });
  }, [text]);

  return (
    <div className={`hm-announce ${homeFonts}`} role="status" ref={root}>
      <div className="hm-announce__inner">
        <div className="hm-announce__track">
          {[0, 1].map((half) => (
            <div className="hm-announce__half" key={half} aria-hidden={half === 1 || undefined}>
              {copies.map((i) => (
                <span className="hm-announce__item" key={i} aria-hidden={i > 0 || undefined}>
                  <span>{text}</span>
                  <TubMark />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
