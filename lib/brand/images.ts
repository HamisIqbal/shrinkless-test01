/**
 * Editorial and product photography slots.
 *
 * These are PLACEHOLDERS. Real Shrinkless photography has not been supplied;
 * every frame here is licensed Unsplash stock and shows someone else's
 * garment. Replace the `url` values before launch — nothing else needs to
 * change, because components only ever read this manifest.
 *
 * Frames are served in their NATURAL COLOUR. An earlier revision appended
 * `sat=-100` to every URL to force the whole site black and white; that is
 * gone deliberately, and `tests/unit/images.test.ts` now guards against it
 * coming back. Restraint comes from the palette and the layout, not from
 * desaturating the photography.
 *
 * Every frame below has been opened and checked: no competitor wordmarks on
 * the garment, no graphic prints that would read as Shrinkless product, and
 * alt text that describes what is actually in the picture.
 */

export type BrandImage = {
  /** Absolute URL, or a Cloudinary public ID once real assets land. */
  url: string;
  /** Never empty. Screen readers get a real description of the frame. */
  alt: string;
  aspect: '3:2' | '4:5' | '2:3' | '1:1';
  /**
   * `object-position` for this frame. A wide hero crops a portrait source to a
   * narrow horizontal band, and the default 50% 50% lands that band on the
   * model's face as often as on the garment — so where to crop is a property
   * of the photograph, not of the component.
   */
  focus?: string;
  /**
   * How far the frame is scaled up about `focus`. 1 — the default everywhere
   * in this manifest — is the photograph as `object-fit: cover` gives it; the
   * admin's crop stage is what sets anything else. See `lib/media/crop.ts`.
   */
  zoom?: number;
  /** The same pair for the phone. Absent means it follows the desktop crop,
   *  which is what every frame in this manifest does. */
  mobileFocus?: string;
  mobileZoom?: number;
};

const UNSPLASH = 'https://images.unsplash.com';

/**
 * Shared transform: cropped, sensibly sized, colour left alone.
 *
 * Keep these close to the largest size the frame is actually displayed at.
 * Unsplash generates each width on demand, and a cold transform of a 1600px
 * crop can take twenty seconds — long enough for Next's image optimizer to
 * time out and serve a 500 instead of a photograph.
 */
function frame(id: string, width: number): string {
  return `${UNSPLASH}/${id}?auto=format&fit=crop&w=${width}&q=80`;
}

/* --------------------------------------------------------------------------
   Hero campaign
   Four frames, cycled infinitely by components/site/HeroSlider. Ordered so
   consecutive slides differ in tone and crop — two similar frames back to
   back make the transition look like a glitch rather than a campaign.
   -------------------------------------------------------------------------- */

export const HERO_SLIDES = [
  {
    url: 'https://res.cloudinary.com/dcsewsmhd/image/upload/v1787938928/website-image-2_if057g.jpg',
    alt: 'A man in a black tee leaning against a bare concrete wall in daylight.',
    aspect: '4:5',
    focus: '50% 30%',
  },
  {
    url: 'https://res.cloudinary.com/dcsewsmhd/image/upload/v1787940856/website-image-1_zhdjtm.jpg',
    alt: 'A woman in an oversized olive tee against a weathered concrete wall.',
    aspect: '2:3',
    focus: '50% 48%',
  },
  {
    url: frame('photo-1611178206041-54d5e075be45', 1800),
    alt: 'A man in a black crew neck tee against a white plaster wall.',
    aspect: '4:5',
    focus: '50% 55%',
  },
  {
    url: frame('photo-1586790170083-2f9ceadc732d', 1800),
    alt: 'A man in a plain white crew neck tee against an off-white wall.',
    aspect: '2:3',
    focus: '50% 45%',
  },
] as const satisfies readonly BrandImage[];

/* --------------------------------------------------------------------------
   Category gateways
   One frame per shoppable category. Keys must match the `category` field on
   the product documents, or the homepage gateway falls back to no image.
   -------------------------------------------------------------------------- */

export const CATEGORY_IMAGES = {
  men: {
    url: frame('photo-1615903040611-e599dfaa6752', 1200),
    alt: 'A man in an oversized black tee crossing a street at dusk.',
    aspect: '4:5',
    focus: '50% 40%',
  },
  women: {
    url: frame('photo-1546578623-d1d3af878403', 1200),
    alt: 'A woman in a plain white tee standing on an open road.',
    aspect: '2:3',
    focus: '50% 58%',
  },
} as const satisfies Record<string, BrandImage>;

export type CategorySlug = keyof typeof CATEGORY_IMAGES;

/* --------------------------------------------------------------------------
   Editorial
   -------------------------------------------------------------------------- */

export const BRAND_IMAGES = {
  /** Fabric macro. Carries the "organic cotton" claim visually. */
  fabric: {
    url: 'https://res.cloudinary.com/dcsewsmhd/image/upload/v1787938928/website-image-3_tzrf0p.jpg',
    alt: 'A close view of soft grey cotton jersey, folded and catching the light.',
    aspect: '4:5',
  },

  /** Cut-and-sew bench. Carries the "Made in USA" claim visually. */
  craft: {
    url: 'https://res.cloudinary.com/dcsewsmhd/image/upload/v1787939781/619261957_18086525564126700_3470738337226757288_n_kvri2r.jpg',
    alt: 'A view of wardrobe',
    aspect: '4:5',
  },

  /** The garment alone, no model. Used for the "doesn't shrink" band. */
  hanging: {
    url: frame('photo-1581655353564-df123a1eb820', 1200),
    alt: 'A white tee on a wooden hanger against a poured concrete wall.',
    aspect: '2:3',
  },

  /** Flat lay. Used where the composition needs to sit down and be quiet. */
  folded: {
    url: frame('photo-1693443687750-611ad77f3aba', 1200),
    alt: 'A white tee and a black tee folded side by side on a white surface.',
    aspect: '3:2',
  },

  /** Heather grey tee, soft daylight. The calmest frame in the set. */
  heather: {
    url: 'https://res.cloudinary.com/dcsewsmhd/image/upload/v1787940222/620442161_18124810468539123_6117677647169915015_n_eifssz.jpg',
    alt: 'A heather grey tee hanging on a white wall in soft afternoon light.',
    aspect: '3:2',
  },

  /** Studio torso crop. Reads as product, not as portrait. */
  torso: {
    url: frame('photo-1571455786673-9d9d6c194f90', 1200),
    alt: 'A plain black tee photographed close on the body, shoulders to waist.',
    aspect: '3:2',
  },
} as const satisfies Record<string, BrandImage>;

export type BrandImageSlot = keyof typeof BRAND_IMAGES;

/* --------------------------------------------------------------------------
   Product photography
   Keyed by product slug, in gallery order — the first frame is the one the
   grid shows. `scripts/seed-shrinkless.ts` reads this straight into the
   catalogue, so adding a product means adding a key here first.
   -------------------------------------------------------------------------- */

export const PRODUCT_IMAGES = {
  'mens-organic-tee': [
    {
      url: frame('photo-1586790170083-2f9ceadc732d', 1200),
      alt: 'A man in a plain white crew neck tee against an off-white wall.',
      aspect: '2:3',
      focus: '50% 62%',
    },
    {
      url: frame('photo-1611178206041-54d5e075be45', 1200),
      alt: 'A man in a black crew neck tee against a white plaster wall.',
      aspect: '4:5',
      focus: '50% 66%',
    },
    {
      url: frame('photo-1581655353564-df123a1eb820', 1200),
      alt: 'A white tee on a wooden hanger against a poured concrete wall.',
      aspect: '2:3',
    },
  ],

  'mens-heavyweight-tee': [
    {
      url: frame('photo-1615903040611-e599dfaa6752', 1200),
      alt: 'A man in an oversized black tee crossing a street at dusk.',
      aspect: '4:5',
      focus: '50% 42%',
    },
    {
      url: frame('photo-1571455786673-9d9d6c194f90', 1200),
      alt: 'A plain black tee photographed close on the body, shoulders to waist.',
      aspect: '3:2',
    },
  ],

  'mens-long-sleeve-tee': [
    {
      url: frame('photo-1624286922676-24e42c1ceff0', 1200),
      alt: 'A man in a plain deep teal long sleeve tee, photographed outdoors at dusk.',
      aspect: '2:3',
    },
    {
      url: frame('photo-1622445275463-afa2ab738c34', 1200),
      alt: 'A man in a loose blank white tee standing outdoors.',
      aspect: '2:3',
    },
  ],

  'womens-organic-tee': [
    {
      url: frame('photo-1546578623-d1d3af878403', 1200),
      alt: 'A woman in a plain white tee standing on an open road.',
      aspect: '2:3',
      focus: '50% 46%',
    },
    {
      url: frame('photo-1564584217132-2271feaeb3c5', 1200),
      alt: 'A heather grey tee hanging on a white wall in soft afternoon light.',
      aspect: '3:2',
    },
  ],

  'womens-boxy-tee': [
    {
      url: frame('photo-1629137525253-739adcd9c774', 1200),
      alt: 'A woman in an oversized olive tee against a weathered concrete wall.',
      aspect: '2:3',
      focus: '50% 48%',
    },
    {
      url: frame('photo-1693443687750-611ad77f3aba', 1200),
      alt: 'A white tee and a black tee folded side by side on a white surface.',
      aspect: '3:2',
    },
  ],

  'womens-everyday-tee': [
    {
      url: frame('photo-1604342681413-6954ddca1e6f', 1200),
      alt: 'A woman in a plain black crew neck tee standing among dark pines.',
      aspect: '2:3',
    },
    {
      url: frame('photo-1632844384543-bb1b2c3900d7', 1200),
      alt: 'A close view of soft grey cotton jersey, folded and catching the light.',
      aspect: '4:5',
    },
  ],
} as const satisfies Record<string, readonly BrandImage[]>;

export type ProductSlug = keyof typeof PRODUCT_IMAGES;
