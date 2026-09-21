import { describe, expect, it } from 'vitest';
import {
  HERO_MAX,
  HERO_MIN,
  heroFramesInputSchema,
  mediaFrameSchema,
  mediaPublishSchema,
} from '@/lib/validation/media';

const frame = (over: Partial<{ url: string; alt: string; focus: string }> = {}) => ({
  url: 'https://example.com/a.jpg',
  alt: 'A tee on a concrete wall',
  focus: '',
  ...over,
});

describe('mediaFrameSchema', () => {
  it('accepts an https URL', () => {
    expect(mediaFrameSchema.safeParse(frame()).success).toBe(true);
  });

  it('accepts a Cloudinary public id', () => {
    expect(mediaFrameSchema.safeParse(frame({ url: 'shrinkless/site/hero_ab12' })).success).toBe(
      true,
    );
  });

  it('refuses a plain http address', () => {
    expect(mediaFrameSchema.safeParse(frame({ url: 'http://example.com/a.jpg' })).success).toBe(
      false,
    );
  });

  it('refuses anything that could smuggle a scheme into a public id', () => {
    for (const url of ['../../etc/passwd', 'javascript:alert(1)', 'a b', '//evil.example']) {
      expect(mediaFrameSchema.safeParse(frame({ url })).success).toBe(false);
    }
  });

  it('requires alt text', () => {
    expect(mediaFrameSchema.safeParse(frame({ alt: '' })).success).toBe(false);
    expect(mediaFrameSchema.safeParse(frame({ alt: '   ' })).success).toBe(false);
  });

  it('accepts a well-formed focus point, and no focus at all', () => {
    expect(mediaFrameSchema.safeParse(frame({ focus: '50% 30%' })).success).toBe(true);
    expect(mediaFrameSchema.safeParse(frame({ focus: '' })).success).toBe(true);
  });

  it('refuses a focus point that is not two percentages', () => {
    for (const focus of ['centre', '50%', '50 30', 'top left', '50%30%']) {
      expect(mediaFrameSchema.safeParse(frame({ focus })).success).toBe(false);
    }
  });

  it('refuses percentages outside 0-100', () => {
    expect(mediaFrameSchema.safeParse(frame({ focus: '150% 30%' })).success).toBe(false);
  });

  it('trims what it stores', () => {
    const parsed = mediaFrameSchema.parse(frame({ alt: '  A tee  ' }));
    expect(parsed.alt).toBe('A tee');
  });
});

describe('heroFramesInputSchema', () => {
  const frames = (count: number) => ({ frames: Array.from({ length: count }, () => frame()) });

  it(`accepts between ${HERO_MIN} and ${HERO_MAX} frames`, () => {
    expect(heroFramesInputSchema.safeParse(frames(HERO_MIN)).success).toBe(true);
    expect(heroFramesInputSchema.safeParse(frames(HERO_MAX)).success).toBe(true);
  });

  it('accepts a single frame, which simply stands', () => {
    expect(heroFramesInputSchema.safeParse(frames(1)).success).toBe(true);
  });

  it('refuses none at all', () => {
    expect(heroFramesInputSchema.safeParse(frames(0)).success).toBe(false);
  });

  it('refuses more than the maximum', () => {
    expect(heroFramesInputSchema.safeParse(frames(HERO_MAX + 1)).success).toBe(false);
  });

  it('refuses a set where one frame is missing its alt text', () => {
    const input = { frames: [frame(), frame({ alt: '' })] };
    expect(heroFramesInputSchema.safeParse(input).success).toBe(false);
  });
});

describe('mediaPublishSchema — a section', () => {
  const publish = (section: Record<string, unknown>) =>
    mediaPublishSchema.safeParse({ slots: [], sections: [section] });

  it('accepts a colour the site uses', () => {
    const result = publish({ sectionId: 'doors', height: 0, background: 'warm' });

    expect(result.success).toBe(true);
    expect(result.success && result.data.sections[0].background).toBe('warm');
  });

  /* A colour the palette has no name for is kept as a hex — in the one form,
     so the same colour written two ways is one stored value. */
  it('accepts any colour as a hex, in one form', () => {
    const result = publish({ sectionId: 'doors', height: 0, background: '#A1B2C3' });

    expect(result.success).toBe(true);
    expect(result.success && result.data.sections[0].background).toBe('#a1b2c3');

    const short = publish({ sectionId: 'doors', height: 0, background: '#abc' });

    expect(short.success && short.data.sections[0].background).toBe('#aabbcc');
  });

  /* What must never reach a stylesheet: anything that is not a colour. */
  it('refuses what is not a colour at all', () => {
    expect(publish({ sectionId: 'doors', height: 0, background: 'hotpink' }).success).toBe(false);
    expect(
      publish({ sectionId: 'doors', height: 0, background: 'red; background: url(x)' }).success,
    ).toBe(false);
  });

  it('reads a missing colour as the ground the page already gives it', () => {
    const result = publish({ sectionId: 'doors', height: 400 });

    expect(result.success).toBe(true);
    expect(result.success && result.data.sections[0].background).toBe('');
  });

  it('still bounds the height', () => {
    expect(publish({ sectionId: 'doors', height: 4001 }).success).toBe(false);
    expect(publish({ sectionId: 'doors', height: -1 }).success).toBe(false);
  });
});
