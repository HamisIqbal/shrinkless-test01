import { describe, expect, it } from 'vitest';
import { imageUrl, isRemoteImage } from '@/lib/images';
import {
  BRAND_IMAGES,
  CATEGORY_IMAGES,
  HERO_SLIDES,
  PRODUCT_IMAGES,
} from '@/lib/brand/images';
import type { BrandImage } from '@/lib/brand/images';

describe('imageUrl', () => {
  it('passes an absolute URL through untouched', () => {
    const url = 'https://images.unsplash.com/photo-123?w=800';

    expect(imageUrl(url)).toBe(url);
    expect(imageUrl(url, 'c_fill,w_400')).toBe(url);
  });

  it('sends a Cloudinary public ID to Cloudinary', () => {
    const result = imageUrl('shrinkless/tee-black', 'c_fill,w_800');

    expect(result).toContain('res.cloudinary.com');
    expect(result).toContain('c_fill,w_800');
    expect(result).toContain('shrinkless/tee-black');
  });

  it('recognises which is which', () => {
    expect(isRemoteImage('https://example.com/a.jpg')).toBe(true);
    expect(isRemoteImage('http://example.com/a.jpg')).toBe(true);
    expect(isRemoteImage('shrinkless/tee-black')).toBe(false);
  });
});

describe('brand image manifest', () => {
  const every: [string, BrandImage][] = [
    ...HERO_SLIDES.map((image, i): [string, BrandImage] => [`hero[${i}]`, image]),
    ...Object.entries(CATEGORY_IMAGES),
    ...Object.entries(BRAND_IMAGES),
    ...Object.entries(PRODUCT_IMAGES).flatMap(([slug, frames]) =>
      frames.map((image, i): [string, BrandImage] => [`${slug}[${i}]`, image]),
    ),
  ];

  it.each(every)('%s has a usable URL', (_slot, image) => {
    expect(image.url).toMatch(/^https:\/\//);
  });

  // An empty alt on editorial photography is a real accessibility defect, and
  // it is the kind that survives review because nothing looks wrong.
  it.each(every)('%s has real alt text', (_slot, image) => {
    expect(image.alt.trim().length).toBeGreaterThan(10);
  });

  // The site used to force every frame monochrome with `sat=-100`. Removing it
  // was a deliberate brand decision, so it gets a test rather than a comment:
  // reintroducing the filter anywhere in the manifest fails the build.
  it('never desaturates a frame', () => {
    for (const [slot, image] of every) {
      expect(image.url, `${slot} is desaturated`).not.toContain('sat=-100');
      expect(image.url, `${slot} is desaturated`).not.toMatch(/[?&]sat=/);
    }
  });

  it('has four hero slides, so the campaign cycles rather than blinks', () => {
    expect(HERO_SLIDES).toHaveLength(4);
  });

  it('covers every shoppable category with a gateway frame', () => {
    expect(Object.keys(CATEGORY_IMAGES).sort()).toEqual(['men', 'women']);
  });

  it('gives all six products at least one frame', () => {
    const slugs = Object.keys(PRODUCT_IMAGES);

    expect(slugs).toHaveLength(6);
    for (const slug of slugs) {
      expect(PRODUCT_IMAGES[slug as keyof typeof PRODUCT_IMAGES].length).toBeGreaterThan(0);
    }
  });
});
