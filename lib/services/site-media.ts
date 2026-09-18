import { connectToDatabase } from '@/lib/db/connection';
import { MediaSlot } from '@/lib/db/models/media-slot';
import { SectionLayout } from '@/lib/db/models/section-layout';
import { listVisibleCategories } from '@/lib/services/categories';
import { SHOPPABLE } from '@/lib/shop/navigation';
import {
  BRAND_IMAGES,
  CATEGORY_IMAGES,
  HERO_SLIDES,
  PRODUCT_IMAGES,
  type BrandImage,
} from '@/lib/brand/images';
import { HERO_MAX, HERO_MIN, type MediaFrameInput } from '@/lib/validation/media';
import { normaliseZoom, type ViewRatios } from '@/lib/media/crop';
import {
  isSectionColour,
  normaliseSectionColour,
  sectionRules,
  type SectionColour,
  type SectionSetting,
} from '@/lib/media/colours';
import { imageUrl } from '@/lib/images';
import { AdminOperationError } from '@/lib/admin/action';

/* --------------------------------------------------------------------------
   The registry

   The set of slots is a property of the design, not of the database. It lives
   here so the server decides what exists — a form cannot invent a slot, and a
   slot cannot quietly disappear because nobody ever saved it.
   -------------------------------------------------------------------------- */

export const HERO_SLOT = 'hero';

/** `category:men`, `category:women`, … — one per category in the catalogue. */
export function categorySlotId(slug: string): string {
  return `category:${slug}`;
}

export function editorialSlotId(name: EditorialSlot): string {
  return `editorial:${name}`;
}

type EditorialDefinition = {
  label: string;
  /** Where a person will see the change. Written for the admin page, because
   *  "torso" means nothing without it. */
  where: string;
  default: BrandImage;
  /** The two shapes this frame is actually seen in, so the admin crops
   *  against the layout rather than against a guess. Several of these frames
   *  appear in more than one place; the shape named is the largest use, which
   *  is the one a bad crop shows up in first. */
  ratios: ViewRatios;
};

/* The shapes `app/storefront.css` renders these slots at. Named once here so
   the crop stage and the two previews cannot drift from the layout. */
const WIDE: ViewRatios = { desktop: { w: 3, h: 2 }, mobile: { w: 4, h: 5 } };
const TILE: ViewRatios = { desktop: { w: 4, h: 5 }, mobile: { w: 4, h: 5 } };
const RAIL: ViewRatios = { desktop: { w: 3, h: 2 }, mobile: { w: 3, h: 2 } };
const BAND: ViewRatios = { desktop: { w: 3, h: 1 }, mobile: { w: 4, h: 5 } };

/** The carousel is the viewport itself — landscape at a desk, portrait in a
 *  hand. No other slot changes shape this hard, which is why it is the one
 *  worth previewing before it is saved. */
export const HERO_RATIOS: ViewRatios = {
  desktop: { w: 16, h: 9 },
  mobile: { w: 9, h: 16 },
};

/** `.gateway__frame` and `.tiles__frame` — 3:4 from 48rem up, 4:5 below. */
export const CATEGORY_RATIOS: ViewRatios = {
  desktop: { w: 3, h: 4 },
  mobile: { w: 4, h: 5 },
};

/**
 * The hand-composed frames.
 *
 * One record per photograph. Where the same picture is used in two places —
 * the story tile and the lookbook tile cut from the same frame — both places
 * read the one slot, so changing it changes both and the panel never lists
 * the same image twice. The two that reach into `PRODUCT_IMAGES` do so
 * because they are editorial uses of a frame the catalogue happens to own;
 * they have slots of their own so a product's gallery is not the place the
 * home page gets art-directed from.
 *
 * Labels are the place the frame is seen, not what is in it — "Home (Story,
 * left)" rather than "Studio torso" — because that is what a person editing
 * the site is looking for. `where` carries the rest.
 */
const EDITORIAL: Record<string, EditorialDefinition> = {
  fabric: {
    label: 'Why Shrinkless (Fabric)',
    where: 'Why Shrinkless, and the lookbook rail on Home',
    default: BRAND_IMAGES.fabric,
    ratios: WIDE,
  },
  craft: {
    label: 'Our Story (Workshop)',
    where: 'Our Story, Why Shrinkless, the lookbook rail on Home, and the footer backdrop',
    default: BRAND_IMAGES.craft,
    ratios: WIDE,
  },
  hanging: {
    label: 'Why Shrinkless (Hanger)',
    where: 'Why Shrinkless, and the lookbook rail on Home',
    default: BRAND_IMAGES.hanging,
    ratios: WIDE,
  },
  folded: {
    label: 'Why Shrinkless (Flat lay)',
    where: 'Why Shrinkless, and the Boxy Tee tile on the lookbook rail',
    default: BRAND_IMAGES.folded,
    ratios: TILE,
  },
  heather: {
    label: 'Home (Story, right)',
    where: 'Home — the second story tile, and the last tile on the lookbook rail',
    default: BRAND_IMAGES.heather,
    ratios: WIDE,
  },
  torso: {
    label: 'Home (Story, left)',
    where: 'Home — the first story tile, and the Heavyweight Tee tile on the lookbook rail',
    default: BRAND_IMAGES.torso,
    ratios: WIDE,
  },
  promise: {
    label: 'Home (Promise band)',
    where: 'Home — the “Wash it. Dry it.” full-bleed band',
    default: PRODUCT_IMAGES['mens-long-sleeve-tee'][1],
    ratios: BAND,
  },
  lookbookOrganic: {
    label: 'Home (Lookbook)',
    where: 'Home — the Organic Tee tile on the lookbook rail',
    default: PRODUCT_IMAGES['womens-organic-tee'][1],
    ratios: RAIL,
  },
  storyOne: {
    label: 'Our Story (First chapter)',
    where: 'Our Story — the photograph beside “the shirt that stopped fitting”',
    default: PRODUCT_IMAGES['mens-organic-tee'][1],
    ratios: WIDE,
  },
  storyTwo: {
    label: 'Our Story (Second chapter)',
    where: 'Our Story — the photograph beside the cloth',
    default: PRODUCT_IMAGES['womens-everyday-tee'][1],
    ratios: WIDE,
  },
  storyThree: {
    label: 'Our Story (Third chapter)',
    where: 'Our Story — the photograph beside the making',
    default: PRODUCT_IMAGES['mens-long-sleeve-tee'][0],
    ratios: WIDE,
  },
  storyStatement: {
    label: 'Our Story (Closing band)',
    where: 'Our Story — the full-bleed band the page closes on',
    default: PRODUCT_IMAGES['womens-everyday-tee'][0],
    ratios: BAND,
  },
  tradeStatement: {
    label: 'Wholesale (Closing band)',
    where: 'Wholesale — the full-bleed band above the enquiry',
    default: PRODUCT_IMAGES['womens-boxy-tee'][0],
    ratios: BAND,
  },
};

export type EditorialSlot = keyof typeof EDITORIAL & string;

export const EDITORIAL_SLOTS = Object.keys(EDITORIAL) as EditorialSlot[];

/** The category frame used where a category has no art of its own. An empty
 *  tile reads as a broken page, which is worse than a stand-in. */
const CATEGORY_FALLBACK = CATEGORY_IMAGES.men;

/* --------------------------------------------------------------------------
   Reading
   -------------------------------------------------------------------------- */

export type SiteMedia = {
  hero: BrandImage[];
  categories: Record<string, BrandImage>;
  editorial: Record<EditorialSlot, BrandImage>;
};

type StoredFrame = {
  url: string;
  alt: string;
  focus?: string;
  zoom?: number;
  mobileFocus?: string;
  mobileZoom?: number;
};

/**
 * An override merged onto a default.
 *
 * `aspect` is taken from the default and never from the row: it is a property
 * of the layout slot, not of the photograph. A 2:3 frame dropped into a 3:2
 * band would letterbox or crop whatever the admin intended, so `focus` — which
 * *is* stored — is the control that makes a differently-shaped photograph sit
 * correctly.
 */
function merge(fallback: BrandImage, stored: StoredFrame | undefined): BrandImage {
  if (!stored) return fallback;

  return {
    /* Resolved here, once, rather than at each of the six places a frame is
       rendered. A slot may hold either an absolute URL or a Cloudinary public
       id, and every consumer hands `url` straight to `next/image` — so a bare
       public id was being read as a path relative to this site and 404ing.
       Nothing caught it because the shipped manifest is absolute URLs
       throughout: it could only appear once somebody uploaded a file, which is
       the one way to get a public id in here.

       `imageUrl` is idempotent, so a value that is already absolute — a pasted
       link, or one of these resolved and saved back — passes through
       unchanged. */
    url: imageUrl(stored.url),
    alt: stored.alt,
    aspect: fallback.aspect,
    ...(stored.focus ? { focus: stored.focus } : {}),
    ...(stored.zoom && stored.zoom > 1 ? { zoom: normaliseZoom(stored.zoom) } : {}),
    ...(stored.mobileFocus ? { mobileFocus: stored.mobileFocus } : {}),
    ...(stored.mobileZoom ? { mobileZoom: normaliseZoom(stored.mobileZoom) } : {}),
  };
}

async function loadOverrides(): Promise<Map<string, StoredFrame[]>> {
  await connectToDatabase();

  const rows = await MediaSlot.find({}).select('slotId frames').lean();

  return new Map(
    rows.map((row) => [
      row.slotId,
      (row.frames ?? []).map((frame) => ({
        url: frame.url,
        alt: frame.alt,
        focus: frame.focus ?? '',
        zoom: normaliseZoom(frame.zoom ?? 1),
        mobileFocus: frame.mobileFocus ?? '',
        ...(frame.mobileZoom ? { mobileZoom: normaliseZoom(frame.mobileZoom) } : {}),
      })),
    ]),
  );
}

/**
 * Every storefront image, overrides merged over the shipped manifest.
 *
 * One query for the whole site. Callers are server components rendering a
 * page that already talks to the database, so this costs a round trip that was
 * happening anyway rather than a new one per image.
 */
export async function getSiteMedia(): Promise<SiteMedia> {
  const overrides = await loadOverrides();

  const heroFrames = overrides.get(HERO_SLOT);
  const hero =
    heroFrames?.length
      ? heroFrames.map((frame, index) =>
          merge(HERO_SLIDES[index] ?? HERO_SLIDES[0], frame),
        )
      : [...HERO_SLIDES];

  const categories: Record<string, BrandImage> = {};

  // Everything the manifest ships with, then anything the admin has added art
  // for — a category created after launch has a row but no manifest entry.
  for (const [slug, image] of Object.entries(CATEGORY_IMAGES)) {
    categories[slug] = merge(image, overrides.get(categorySlotId(slug))?.[0]);
  }

  for (const [slotId, frames] of overrides) {
    if (!slotId.startsWith('category:')) continue;

    const slug = slotId.slice('category:'.length);
    categories[slug] = merge(CATEGORY_FALLBACK, frames[0]);
  }

  const editorial = {} as Record<EditorialSlot, BrandImage>;

  for (const slot of EDITORIAL_SLOTS) {
    editorial[slot] = merge(
      EDITORIAL[slot].default,
      overrides.get(editorialSlotId(slot))?.[0],
    );
  }

  return { hero, categories, editorial };
}

/** The tile for a category, with the stand-in where there is no art. */
export function categoryImage(media: SiteMedia, slug: string): BrandImage {
  return media.categories[slug] ?? media.categories.men ?? CATEGORY_FALLBACK;
}

/* --------------------------------------------------------------------------
   The admin's view
   -------------------------------------------------------------------------- */

export type MediaSlotView = {
  slotId: string;
  label: string;
  where: string;
  frames: BrandImage[];
  /** The shapes this slot renders at — the crop stage and the desktop and
   *  mobile previews are all drawn from these. */
  ratios: ViewRatios;
  /** False when the slot is still showing what the site shipped with. */
  overridden: boolean;
};

export type MediaLibrary = {
  hero: MediaSlotView;
  categories: MediaSlotView[];
  editorial: MediaSlotView[];
};

/**
 * Every slot, whether or not it has ever been changed, with enough context for
 * a person to know what they are editing.
 *
 * Categories come from the catalogue rather than from a fixed pair, so a
 * category added last week gets a tile without a deploy.
 */
export async function listMediaSlots(): Promise<MediaLibrary> {
  const [overrides, media, categories] = await Promise.all([
    loadOverrides(),
    getSiteMedia(),
    listVisibleCategories().catch(() => []),
  ]);

  const slugs = categories.length
    ? categories.map((category) => ({ slug: category.slug, label: category.name }))
    : Object.keys(CATEGORY_IMAGES).map((slug) => ({
        slug,
        label: slug[0].toUpperCase() + slug.slice(1),
      }));

  return {
    hero: {
      slotId: HERO_SLOT,
      label: 'Home',
      where: `Home — the frames behind the headline. ${HERO_MIN}–${HERO_MAX} of them.`,
      frames: media.hero,
      ratios: HERO_RATIOS,
      overridden: overrides.has(HERO_SLOT),
    },

    // Simple, location-based titles — "Men", "Women" — rather than the
    // catalogue's internal naming. The full location still reads underneath.
    categories: slugs.map(({ slug, label }) => ({
      slotId: categorySlotId(slug),
      label,
      where: 'Home — the shopping doors, and the desktop menu',
      frames: [categoryImage(media, slug)],
      ratios: CATEGORY_RATIOS,
      overridden: overrides.has(categorySlotId(slug)),
    })),

    // Location-based titles, one per photograph — "Home (Promise band)",
    // "Why Shrinkless (Fabric)". Two slots never carry the same title, and no
    // two slots hold the same picture.
    editorial: EDITORIAL_SLOTS.map((slot) => ({
      slotId: editorialSlotId(slot),
      label: EDITORIAL[slot].label,
      where: EDITORIAL[slot].where,
      frames: [media.editorial[slot]],
      ratios: EDITORIAL[slot].ratios,
      overridden: overrides.has(editorialSlotId(slot)),
    })),
  };
}

/* --------------------------------------------------------------------------
   Writing
   -------------------------------------------------------------------------- */

/**
 * Whether a slot id names something the design actually has.
 *
 * Category ids are the open case: the catalogue decides them, so any
 * well-formed slug is allowed rather than checked against a list that would go
 * stale the moment a category is added.
 */
export function isKnownSlot(slotId: string): boolean {
  if (slotId === HERO_SLOT) return true;

  if (slotId.startsWith('category:')) {
    return /^[a-z0-9][a-z0-9-]*$/.test(slotId.slice('category:'.length));
  }

  if (slotId.startsWith('editorial:')) {
    return EDITORIAL_SLOTS.includes(slotId.slice('editorial:'.length) as EditorialSlot);
  }

  return false;
}

function assertKnown(slotId: string): void {
  if (!isKnownSlot(slotId)) {
    throw new AdminOperationError('That is not a slot this site has.');
  }
}

/**
 * A frame as it arrives from a caller.
 *
 * The zoom is optional here, and only here: the validator defaults it and the
 * schema defaults it again, so a caller that never heard of a crop — a seed, a
 * test, an older client — writes an uncropped frame rather than a rejected
 * one.
 */
type MediaFrameWrite = Omit<MediaFrameInput, 'zoom' | 'mobileFocus'> & {
  zoom?: number;
  mobileFocus?: string;
};

/** Replaces the photograph in one single-image slot. */
export async function saveMediaSlot(
  slotId: string,
  frame: MediaFrameWrite,
): Promise<void> {
  assertKnown(slotId);

  if (slotId === HERO_SLOT) {
    throw new AdminOperationError('The carousel is saved as a set, not one frame at a time.');
  }

  await connectToDatabase();

  await MediaSlot.findOneAndUpdate(
    { slotId },
    { $set: { frames: [frame] } },
    { upsert: true },
  );
}

/** Replaces the whole carousel — reorder, add and remove are all this. */
export async function saveHeroFrames(frames: MediaFrameWrite[]): Promise<void> {
  if (frames.length < HERO_MIN || frames.length > HERO_MAX) {
    throw new AdminOperationError(
      `The carousel takes between ${HERO_MIN} and ${HERO_MAX} frames.`,
    );
  }

  await connectToDatabase();

  await MediaSlot.findOneAndUpdate(
    { slotId: HERO_SLOT },
    { $set: { frames } },
    { upsert: true },
  );
}

/** Puts a slot back to what the site shipped with, by forgetting the override
 *  rather than by writing a second copy of the original that could drift. */
export async function resetMediaSlot(slotId: string): Promise<void> {
  assertKnown(slotId);

  await connectToDatabase();
  await MediaSlot.deleteOne({ slotId });
}

/* --------------------------------------------------------------------------
   The pages

   The admin edits photography where it lives, so the editor needs to know
   which slots each page is actually built from. That is a property of the
   layouts — the same thing the registry above already owns — so it is
   declared here beside them rather than guessed at in the browser. A slot
   named on two pages is the one slot: editing it from either changes both,
   which is what the storefront already does.
   -------------------------------------------------------------------------- */

/**
 * The lookbook rail's running order — `components/site/LookbookRail.tsx`.
 * Several of these frames are also elsewhere on the page; the rail is where
 * all of them appear at once.
 */
const LOOKBOOK_ORDER: EditorialSlot[] = [
  'torso',
  'fabric',
  'folded',
  'craft',
  'lookbookOrganic',
  'hanging',
  'heather',
];

/** `app/(shop)/why-shrinkless/page.tsx` — the four points, in order. */
const WHY_ORDER: EditorialSlot[] = ['fabric', 'folded', 'hanging', 'craft'];

/** `app/(shop)/page.tsx` — the two statement tiles. */
const STORY_ORDER: EditorialSlot[] = ['torso', 'heather'];

/** Our Story, in the order the page runs them: three chapters, then the band. */
const OUR_STORY_ORDER: EditorialSlot[] = ['storyOne', 'storyTwo', 'storyThree', 'storyStatement'];

/* --------------------------------------------------------------------------
   The home page's sections

   A band across the home page, and the element the storefront draws it as.
   Selectors rather than markers because the storefront's markup is not this
   tab's to change: every class named here is already in the layout, and the
   two grids that share a class are told apart by the heading they are already
   labelled by.

   One height per section and no per-device pair. The admin edits from
   whichever preview is convenient and the number applies everywhere — a phone
   and a desk holding different numbers would be two settings pretending to be
   one.
   -------------------------------------------------------------------------- */

export type HomeSectionDefinition = {
  id: string;
  label: string;
  selector: string;
  /**
   * True where the section's own height *is* the design — a viewport-tall
   * hero, a full-bleed band. Those take the number as a height, so it can be
   * brought down as well as up; everything else takes it as a floor, because a
   * fixed height on a grid of product cards would have the page run out from
   * under itself.
   */
  fixed?: boolean;
};

export const HOME_SECTIONS: HomeSectionDefinition[] = [
  { id: 'hero', label: 'Hero', selector: '.hero', fixed: true },
  { id: 'doors', label: 'Category doors', selector: '.gateway' },
  { id: 'instagram', label: 'Instagram', selector: '.iglane' },
  { id: 'new', label: 'New arrivals', selector: 'section[aria-labelledby="new-heading"]' },
  { id: 'lookbook', label: 'Lookbook rail', selector: '.lookbook' },
  { id: 'story', label: 'Story tiles', selector: '.tiles' },
  { id: 'promise', label: 'Promise band', selector: '.imageband', fixed: true },
  { id: 'featured', label: 'Featured', selector: 'section[aria-labelledby="featured-heading"]' },
  { id: 'reviews', label: 'Reviews', selector: '.quotes' },
  { id: 'footer', label: 'Footer', selector: '.colophon' },
];

const SECTIONS = new Map(HOME_SECTIONS.map((section) => [section.id, section]));

/** Whether an id names a section the home page actually has. */
export function isKnownSection(sectionId: string): boolean {
  return SECTIONS.has(sectionId);
}

/**
 * Everything that has been set on a section, by section id. A section nobody
 * has touched is simply absent.
 *
 * A background that is not a colour is dropped rather than served: a name left
 * behind by a palette entry that has since been retired should fall back to the
 * page's own rather than reach a stylesheet.
 */
export async function getSectionSettings(): Promise<Record<string, SectionSetting>> {
  await connectToDatabase();

  const rows = await SectionLayout.find({}).select('sectionId height background').lean();
  const settings: Record<string, SectionSetting> = {};

  for (const row of rows) {
    if (!isKnownSection(row.sectionId)) continue;

    const background = normaliseSectionColour(row.background);

    settings[row.sectionId] = {
      ...(row.height && row.height > 0 ? { height: row.height } : {}),
      ...(background ? { background } : {}),
    };
  }

  return settings;
}

/**
 * Writes what the admin published.
 *
 * A section handed back with no height and no colour is one they cleared, so
 * the row goes rather than a zero and an empty string being stored — the
 * section falls back to what the design gives it, exactly the way a restored
 * photograph falls back to the shipped frame. Either half alone keeps the row:
 * a band can be recoloured at the height the page already draws it.
 */
export async function saveSectionSettings(
  entries: { sectionId: string; height: number; background?: string }[],
): Promise<void> {
  if (!entries.length) return;

  for (const entry of entries) {
    if (!isKnownSection(entry.sectionId)) {
      throw new AdminOperationError('That is not a section this page has.');
    }

    if (entry.background && !isSectionColour(entry.background)) {
      throw new AdminOperationError('That is not a colour.');
    }
  }

  await connectToDatabase();

  await SectionLayout.bulkWrite(
    entries.map((entry) => {
      const height = entry.height > 0 ? Math.round(entry.height) : 0;
      const background = normaliseSectionColour(entry.background);

      if (!height && !background) {
        return { deleteOne: { filter: { sectionId: entry.sectionId } } };
      }

      /* The half that was cleared is unset rather than written empty, so a row
         never carries a zero height or a blank colour that would then have to
         be read as "not set" everywhere downstream. */
      const set: Record<string, unknown> = {};
      const unset: Record<string, ''> = {};

      if (height) set.height = height;
      else unset.height = '';

      if (background) set.background = background;
      else unset.background = '';

      return {
        updateOne: {
          filter: { sectionId: entry.sectionId },
          update: {
            ...(Object.keys(set).length ? { $set: set } : {}),
            ...(Object.keys(unset).length ? { $unset: unset } : {}),
          },
          upsert: true,
        },
      };
    }),
  );
}

/**
 * The sections as a stylesheet.
 *
 * Built on the server and served in the page's first paint, so a section that
 * has been given a height or a ground is drawn that way before anything runs —
 * and unlayered, so it outranks the storefront's own rule for the same element
 * without needing a specificity contest.
 *
 * The rules themselves are built by `sectionRules`, which the editor's live
 * preview also calls: what is on screen while a swatch is being tried is made
 * by the same code that will serve the page after Publish.
 */
export function sectionSettingCss(settings: Record<string, SectionSetting>): string {
  const blocks: string[] = [];

  for (const section of HOME_SECTIONS) {
    const rules = sectionRules(section.selector, settings[section.id] ?? {}, section.fixed);
    if (rules) blocks.push(rules);
  }

  return blocks.join('\n');
}

/* --------------------------------------------------------------------------
   The editor's view
   -------------------------------------------------------------------------- */

export type MediaSectionView = {
  id: string;
  label: string;
  /** What the storefront is serving. Each absent while the design's own still
   *  stands. */
  height?: number;
  background?: SectionColour;
};

export type MediaPageView = {
  id: string;
  label: string;
  /** Where this page is on the storefront — the editor opens it there. */
  path: string;
  slots: MediaSlotView[];
  /** Empty on every page but Home: section height is a home-page control. */
  sections: MediaSectionView[];
};

/**
 * The pages the editor lists, in the order it lists them.
 *
 * Only the pages that have photography. The FAQ carries no pictures at all —
 * listing it would be a heading with nothing under it, which reads as a page
 * whose images failed to load rather than as a page that has none. It still
 * serves its layout overrides through `getMediaLayer`; it simply has nothing
 * to edit here.
 */
const MEDIA_PAGES = [
  { id: 'home', label: 'Homepage', path: '/' },
  { id: 'our-story', label: 'Our Story', path: '/our-story' },
  { id: 'why-shrinkless', label: 'Why Shrinkless', path: '/why-shrinkless' },
  { id: 'wholesale', label: 'Wholesale', path: '/wholesale' },
] as const;

/**
 * Which slots stand on a page, in the order the page runs them.
 *
 * Home carries the carousel, the category doors, the lookbook rail, the story
 * tiles and the promise band; Our Story carries its three chapters and its
 * closing band; Why Shrinkless carries the four points; Wholesale carries the
 * band it closes on. The catalogue pages compose the two category doors, which
 * are edited on Home where they are composed rather than in a second place —
 * so they are not listed. Any other page answers with nothing, because the
 * storefront still calls this for every page it serves: the layer it feeds
 * also carries the section stylesheet.
 */
function slotIdsFor(pageId: string): string[] {
  if (pageId === 'home') {
    return [
      HERO_SLOT,
      // The doors the page actually composes, not every category in the
      // catalogue: a category with no art of its own falls back to the men's
      // frame, and two slots holding one photograph could not be told apart on
      // a page where only two of them are drawn.
      ...SHOPPABLE.map(({ slug }) => categorySlotId(slug)),
      ...LOOKBOOK_ORDER.map(editorialSlotId),
      ...STORY_ORDER.map(editorialSlotId),
      editorialSlotId('promise'),
    ];
  }

  if (pageId === 'our-story') return OUR_STORY_ORDER.map(editorialSlotId);

  if (pageId === 'why-shrinkless') return WHY_ORDER.map(editorialSlotId);

  if (pageId === 'wholesale') return [editorialSlotId('tradeStatement')];

  return [];
}

/** Every slot on a page, once each, resolved against what exists right now. */
async function slotsFor(pageId: string): Promise<MediaSlotView[]> {
  const library = await listMediaSlots();

  const known = new Map<string, MediaSlotView>();
  known.set(library.hero.slotId, library.hero);
  for (const slot of [...library.categories, ...library.editorial]) {
    known.set(slot.slotId, slot);
  }

  const seen = new Set<string>();

  return slotIdsFor(pageId)
    .filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((id) => known.get(id))
    .filter((slot): slot is MediaSlotView => Boolean(slot));
}

/**
 * Every page the editor lists, with its slots and — on Home — its sections.
 *
 * A frame standing on both pages is listed under both: the lookbook rail
 * carries four of the frames Why Shrinkless is built from. They are one slot
 * either way, so editing from either place moves both, which is exactly what
 * the storefront already does.
 */
export async function listMediaPages(): Promise<MediaPageView[]> {
  const [settings, ...perPage] = await Promise.all([
    getSectionSettings(),
    ...MEDIA_PAGES.map((page) => slotsFor(page.id)),
  ]);

  return MEDIA_PAGES.map((page, index) => ({
    id: page.id,
    label: page.label,
    path: page.path,
    slots: perPage[index] ?? [],
    sections:
      page.id === 'home'
        ? HOME_SECTIONS.map((section) => ({
            id: section.id,
            label: section.label,
            ...(settings[section.id] ?? {}),
          }))
        : [],
  }));
}

/* --------------------------------------------------------------------------
   The storefront's side
   -------------------------------------------------------------------------- */

export type MediaLayerData = {
  page: string;
  /** The saved section heights and grounds, already built. Served to every
   *  visitor, in the first paint. */
  css: string;
};

/**
 * The layout overrides one page is serving.
 *
 * This used to carry the page's photographs as well, so the visual editor
 * running inside an iframe could find each frame by the address it had been
 * rendered from. The Media tab is a list now — it edits the registry directly
 * rather than the page — so the only thing left to hand the storefront is the
 * stylesheet, which is what every visitor was getting from here anyway.
 *
 * Every page calls this, not just the two the editor lists: a page with no
 * sections and nothing saved gets an empty string and renders nothing.
 */
export async function getMediaLayer(pageId: string): Promise<MediaLayerData> {
  const settings =
    pageId === 'home'
      ? await getSectionSettings()
      : ({} as Record<string, SectionSetting>);

  return { page: pageId, css: sectionSettingCss(settings) };
}
