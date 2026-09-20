import { describe, expect, it } from 'vitest';
import { withTestDatabase } from '@/tests/setup/db';
import { MediaSlot } from '@/lib/db/models/media-slot';
import { BRAND_IMAGES, CATEGORY_IMAGES, HERO_SLIDES } from '@/lib/brand/images';
import {
  EDITORIAL_SLOTS,
  HERO_SLOT,
  HOME_SECTIONS,
  categoryImage,
  categorySlotId,
  editorialSlotId,
  getMediaLayer,
  getSectionSettings,
  getSiteMedia,
  isKnownSection,
  isKnownSlot,
  listMediaPages,
  listMediaSlots,
  resetMediaSlot,
  saveHeroFrames,
  saveMediaSlot,
  saveSectionSettings,
  sectionSettingCss,
} from '@/lib/services/site-media';
import { SECTION_COLOURS, isSectionColour } from '@/lib/media/colours';
import { AdminOperationError } from '@/lib/admin/action';

withTestDatabase();

const frame = (url: string) => ({ url, alt: 'A replacement frame', focus: '' });

describe('getSiteMedia with nothing saved', () => {
  it('renders the site exactly as it ships', async () => {
    const media = await getSiteMedia();

    expect(media.hero).toEqual([...HERO_SLIDES]);
    expect(media.editorial.fabric).toEqual(BRAND_IMAGES.fabric);
    expect(media.categories.men).toEqual(CATEGORY_IMAGES.men);
  });

  it('offers every editorial slot the design has', async () => {
    const media = await getSiteMedia();

    for (const slot of EDITORIAL_SLOTS) {
      expect(media.editorial[slot]?.url).toBeTruthy();
      expect(media.editorial[slot]?.alt).toBeTruthy();
    }
  });
});

describe('saveMediaSlot', () => {
  it('overlays one editorial slot and leaves the rest alone', async () => {
    await saveMediaSlot(editorialSlotId('fabric'), frame('https://example.com/new.jpg'));

    const media = await getSiteMedia();

    expect(media.editorial.fabric.url).toBe('https://example.com/new.jpg');
    expect(media.editorial.fabric.alt).toBe('A replacement frame');
    expect(media.editorial.craft).toEqual(BRAND_IMAGES.craft);
  });

  it('keeps the aspect from the slot, not from the saved row', async () => {
    // Aspect is a property of the layout: a differently-shaped photograph is
    // handled by `focus`, never by letting the band change height.
    await saveMediaSlot(editorialSlotId('folded'), frame('https://example.com/tall.jpg'));

    const media = await getSiteMedia();

    expect(media.editorial.folded.aspect).toBe(BRAND_IMAGES.folded.aspect);
  });

  it('carries a focus point through, and omits an empty one', async () => {
    await saveMediaSlot(editorialSlotId('torso'), {
      url: 'https://example.com/a.jpg',
      alt: 'A frame',
      focus: '50% 20%',
    });
    await saveMediaSlot(editorialSlotId('heather'), frame('https://example.com/b.jpg'));

    const media = await getSiteMedia();

    expect(media.editorial.torso.focus).toBe('50% 20%');
    expect(media.editorial.heather.focus).toBeUndefined();
  });

  /* The phone's own placement. The editor this replaced cropped against a
     desktop-shaped preview and blanked this pair on the way out, so a 16:9
     hero and a 9:16 one were published from one decision. The list crops both
     stages, so the pair has to survive the round trip — and has to stay absent
     when nobody has moved the phone, because absent is what `mobileView`
     reads as "follow the desktop". */
  it('carries the phone’s own crop through, and leaves it absent until there is one', async () => {
    await saveMediaSlot(editorialSlotId('torso'), {
      url: 'https://example.com/a.jpg',
      alt: 'A frame',
      focus: '50% 20%',
      zoom: 1.4,
      mobileFocus: '30% 80%',
      mobileZoom: 2,
    });

    await saveMediaSlot(editorialSlotId('heather'), {
      url: 'https://example.com/b.jpg',
      alt: 'A frame',
      focus: '50% 20%',
      zoom: 1.4,
      mobileFocus: '',
    });

    const media = await getSiteMedia();

    expect(media.editorial.torso.mobileFocus).toBe('30% 80%');
    expect(media.editorial.torso.mobileZoom).toBe(2);

    expect(media.editorial.heather.zoom).toBe(1.4);
    expect(media.editorial.heather.mobileFocus).toBeUndefined();
    expect(media.editorial.heather.mobileZoom).toBeUndefined();
  });

  /* The regression that took the editorial band off the site, and this test
     asserted it: an id was echoed back exactly as stored. But "as readily as a
     URL" has to mean it renders, and every component hands `url` straight to
     next/image — which read a bare id as a path relative to this site and
     404ed. Uploading is the only way to get an id in here, so pasting a link
     worked and it looked like an upload problem. */
  it('accepts a Cloudinary public id as readily as a URL', async () => {
    await saveMediaSlot(editorialSlotId('craft'), frame('shrinkless/site/abc123'));

    const url = (await getSiteMedia()).editorial.craft.url;

    expect(url).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    expect(url).toMatch(/shrinkless\/site\/abc123$/);
  });

  it('leaves an address that is already one exactly as it is', async () => {
    await saveMediaSlot(editorialSlotId('hanging'), frame('https://example.com/kept.jpg'));

    expect((await getSiteMedia()).editorial.hanging.url).toBe('https://example.com/kept.jpg');
  });

  it('replaces rather than accumulating', async () => {
    const slot = editorialSlotId('fabric');

    await saveMediaSlot(slot, frame('https://example.com/one.jpg'));
    await saveMediaSlot(slot, frame('https://example.com/two.jpg'));

    expect(await MediaSlot.countDocuments({ slotId: slot })).toBe(1);
    expect((await getSiteMedia()).editorial.fabric.url).toBe('https://example.com/two.jpg');
  });

  it('refuses a slot the design does not have', async () => {
    await expect(
      saveMediaSlot('editorial:nonsense', frame('https://example.com/a.jpg')),
    ).rejects.toBeInstanceOf(AdminOperationError);

    expect(await MediaSlot.countDocuments({})).toBe(0);
  });

  it('refuses to save the carousel one frame at a time', async () => {
    await expect(
      saveMediaSlot(HERO_SLOT, frame('https://example.com/a.jpg')),
    ).rejects.toBeInstanceOf(AdminOperationError);
  });
});

describe('categories', () => {
  it('overlays a category tile', async () => {
    await saveMediaSlot(categorySlotId('men'), frame('https://example.com/men.jpg'));

    const media = await getSiteMedia();

    expect(categoryImage(media, 'men').url).toBe('https://example.com/men.jpg');
    expect(categoryImage(media, 'women')).toEqual(CATEGORY_IMAGES.women);
  });

  it('gives art to a category the manifest never knew about', async () => {
    await saveMediaSlot(categorySlotId('kids'), frame('https://example.com/kids.jpg'));

    expect(categoryImage(await getSiteMedia(), 'kids').url).toBe(
      'https://example.com/kids.jpg',
    );
  });

  it('stands in rather than rendering an empty tile', async () => {
    const media = await getSiteMedia();

    expect(categoryImage(media, 'never-seen-before')).toEqual(CATEGORY_IMAGES.men);
  });
});

describe('saveHeroFrames', () => {
  it('replaces the whole carousel', async () => {
    await saveHeroFrames([
      frame('https://example.com/1.jpg'),
      frame('https://example.com/2.jpg'),
      frame('https://example.com/3.jpg'),
    ]);

    const media = await getSiteMedia();

    expect(media.hero).toHaveLength(3);
    expect(media.hero.map((image) => image.url)).toEqual([
      'https://example.com/1.jpg',
      'https://example.com/2.jpg',
      'https://example.com/3.jpg',
    ]);
  });

  it('gives a frame past the shipped four an aspect to fall back on', async () => {
    const frames = Array.from({ length: 6 }, (_, i) =>
      frame(`https://example.com/${i}.jpg`),
    );

    await saveHeroFrames(frames);

    for (const image of (await getSiteMedia()).hero) {
      expect(image.aspect).toBeTruthy();
    }
  });

  it('refuses fewer than two frames — that is not a carousel', async () => {
    await expect(
      saveHeroFrames([frame('https://example.com/1.jpg')]),
    ).rejects.toBeInstanceOf(AdminOperationError);
  });

  it('refuses more than six', async () => {
    const frames = Array.from({ length: 7 }, (_, i) =>
      frame(`https://example.com/${i}.jpg`),
    );

    await expect(saveHeroFrames(frames)).rejects.toBeInstanceOf(AdminOperationError);
  });
});

describe('resetMediaSlot', () => {
  it('puts a slot back to what the site shipped with', async () => {
    const slot = editorialSlotId('fabric');

    await saveMediaSlot(slot, frame('https://example.com/new.jpg'));
    await resetMediaSlot(slot);

    expect((await getSiteMedia()).editorial.fabric).toEqual(BRAND_IMAGES.fabric);
    expect(await MediaSlot.countDocuments({ slotId: slot })).toBe(0);
  });

  it('restores the carousel', async () => {
    await saveHeroFrames([frame('https://example.com/1.jpg'), frame('https://example.com/2.jpg')]);
    await resetMediaSlot(HERO_SLOT);

    expect((await getSiteMedia()).hero).toEqual([...HERO_SLIDES]);
  });

  it('is quiet about a slot that was never changed', async () => {
    await expect(resetMediaSlot(editorialSlotId('torso'))).resolves.toBeUndefined();
  });
});

describe('isKnownSlot', () => {
  it('accepts the slots the design has', () => {
    expect(isKnownSlot(HERO_SLOT)).toBe(true);
    expect(isKnownSlot(editorialSlotId('fabric'))).toBe(true);
    expect(isKnownSlot(categorySlotId('men'))).toBe(true);
    expect(isKnownSlot(categorySlotId('brand-new'))).toBe(true);
  });

  it('refuses everything else', () => {
    expect(isKnownSlot('editorial:nonsense')).toBe(false);
    expect(isKnownSlot('category:Not A Slug')).toBe(false);
    expect(isKnownSlot('products')).toBe(false);
    expect(isKnownSlot('')).toBe(false);
  });
});

describe('listMediaSlots', () => {
  it('lists every slot, changed or not, and says which is which', async () => {
    await saveMediaSlot(editorialSlotId('fabric'), frame('https://example.com/new.jpg'));

    const library = await listMediaSlots();

    expect(library.editorial).toHaveLength(EDITORIAL_SLOTS.length);
    expect(library.hero.overridden).toBe(false);

    const fabric = library.editorial.find((slot) => slot.slotId === editorialSlotId('fabric'));
    const craft = library.editorial.find((slot) => slot.slotId === editorialSlotId('craft'));

    expect(fabric?.overridden).toBe(true);
    expect(craft?.overridden).toBe(false);
  });

  it('describes where each slot appears, so the label is not a riddle', async () => {
    const library = await listMediaSlots();

    for (const slot of [library.hero, ...library.categories, ...library.editorial]) {
      expect(slot.label).toBeTruthy();
      expect(slot.where).toBeTruthy();
      expect(slot.frames.length).toBeGreaterThan(0);
    }
  });

  /* The panel used to list ten cards called "Home (Section)", three of which
     were the same photograph under two slots. Both halves of that are what
     these two guard. */
  it('gives every slot a title of its own', async () => {
    const library = await listMediaSlots();
    const labels = [library.hero, ...library.categories, ...library.editorial].map(
      (slot) => slot.label,
    );

    expect(new Set(labels).size).toBe(labels.length);
  });

  it('never lists the same photograph under two slots', async () => {
    const library = await listMediaSlots();
    const urls = [...library.categories, ...library.editorial].map(
      (slot) => slot.frames[0].url,
    );

    expect(new Set(urls).size).toBe(urls.length);
  });

  it('falls back to the manifest categories when the catalogue has none', async () => {
    const library = await listMediaSlots();

    expect(library.categories.map((slot) => slot.slotId).sort()).toEqual([
      categorySlotId('men'),
      categorySlotId('women'),
    ]);
  });
});

describe('listMediaPages', () => {
  /* Only the pages that have photography. The FAQ, the cart and the checkout
     carry no pictures at all, and product photography belongs to a product
     rather than to a page. */
  it('offers the pages that have images, and no others', async () => {
    const pages = await listMediaPages();

    expect(pages.map((page) => page.id)).toEqual([
      'home',
      'collections',
      'our-story',
      'why-shrinkless',
      'wholesale',
    ]);

    for (const page of pages) {
      expect(page.label).toBeTruthy();
      expect(page.path.startsWith('/')).toBe(true);
      expect(page.slots.length).toBeGreaterThan(0);
    }
  });

  /* The category tiles stand on Home, where the gateway composes them, and on
     the collection pages, where each one is the head of its own grid. Listed
     under both, because a frame is edited where it is seen — and it is one
     record either way, so editing it from either place moves both. */
  it('keeps the category doors on Home and on Collections', async () => {
    const pages = await listMediaPages();

    for (const id of ['home', 'collections']) {
      const doors = pages
        .find((page) => page.id === id)
        ?.slots.map((slot) => slot.slotId)
        .filter((slotId) => slotId.startsWith('category:'));

      expect(doors?.sort()).toEqual([categorySlotId('men'), categorySlotId('women')]);
    }
  });

  /* The point of the tab: a frame is edited where it stands, so every slot the
     library holds has to be reachable from some page. A slot nobody can get to
     is a photograph nobody can change. */
  it('places every slot on a page', async () => {
    const [pages, library] = await Promise.all([listMediaPages(), listMediaSlots()]);

    const placed = new Set(pages.flatMap((page) => page.slots.map((slot) => slot.slotId)));

    for (const slot of [library.hero, ...library.categories, ...library.editorial]) {
      expect(placed.has(slot.slotId)).toBe(true);
    }
  });

  it('carries the saved frame, not a second copy of it', async () => {
    await saveMediaSlot(editorialSlotId('promise'), frame('https://example.com/band.jpg'));

    const pages = await listMediaPages();
    const home = pages.find((page) => page.id === 'home');

    const appearances = home?.slots.filter(
      (slot) => slot.slotId === editorialSlotId('promise'),
    );

    expect(appearances?.length).toBe(1);
    expect(appearances?.[0].frames[0].url).toBe('https://example.com/band.jpg');
    expect(appearances?.[0].overridden).toBe(true);
  });

  /* Section height is a home-page control, and the editor draws its panel from
     this list — so a section offered anywhere else would be a control that
     could not be published. */
  it('offers the home page’s sections, and only there', async () => {
    const pages = await listMediaPages();

    for (const page of pages) {
      if (page.id === 'home') {
        // Every band the page has, in the order the page runs them — the list
        // draws its section rows straight from this, so one missing here is a
        // band nobody can set.
        expect(page.sections.map((section) => section.id)).toEqual(
          HOME_SECTIONS.map((section) => section.id),
        );
      } else {
        expect(page.sections).toEqual([]);
      }
    }
  });
});

describe('section settings', () => {
  it('stores nothing until a section has actually been given one', async () => {
    expect(await getSectionSettings()).toEqual({});
    expect(sectionSettingCss({})).toBe('');
  });

  it('keeps one height per section, not one per device', async () => {
    await saveSectionSettings([{ sectionId: 'hero', height: 600 }]);

    expect(await getSectionSettings()).toEqual({ hero: { height: 600 } });

    const css = sectionSettingCss(await getSectionSettings());

    expect(css).toContain('height: 600px');
    expect(css).not.toContain('@media');
  });

  /* A band whose own height is the design takes the number outright, so it can
     be brought down as well as up; a grid of product cards takes it as a floor,
     because a fixed height there would have the page run out from under
     itself. */
  it('sets a fixed band outright and an open one as a floor', async () => {
    await saveSectionSettings([
      { sectionId: 'hero', height: 700 },
      { sectionId: 'new', height: 700 },
    ]);

    const css = sectionSettingCss(await getSectionSettings());

    expect(css).toContain('.hero { height: 700px; min-height: 700px; }');
    expect(css).toContain('section[aria-labelledby="new-heading"] { min-height: 700px; }');
  });

  it('updates rather than duplicates', async () => {
    await saveSectionSettings([{ sectionId: 'footer', height: 400 }]);
    await saveSectionSettings([{ sectionId: 'footer', height: 520 }]);

    expect(await getSectionSettings()).toEqual({ footer: { height: 520 } });
  });

  /* Zero and blank together are "put it back", and putting it back is
     forgetting the row rather than storing a zero and an empty string that
     would have to be read around everywhere. */
  it('forgets the row when a section is cleared', async () => {
    await saveSectionSettings([{ sectionId: 'promise', height: 500, background: 'warm' }]);
    await saveSectionSettings([{ sectionId: 'promise', height: 0, background: '' }]);

    expect(await getSectionSettings()).toEqual({});
  });

  it('refuses a section the page does not have', async () => {
    expect(isKnownSection('hero')).toBe(true);
    expect(isKnownSection('nonsense')).toBe(false);

    await expect(
      saveSectionSettings([{ sectionId: 'nonsense', height: 300 }]),
    ).rejects.toBeInstanceOf(AdminOperationError);
  });

  /* --- The ground a band stands on ------------------------------------- */

  it('serves a ground the palette has, as the hex the site is built on', async () => {
    await saveSectionSettings([{ sectionId: 'doors', height: 0, background: 'warm' }]);

    expect(await getSectionSettings()).toEqual({ doors: { background: 'warm' } });
    expect(sectionSettingCss(await getSectionSettings())).toBe(
      `.gateway { background: ${SECTION_COLOURS.warm.hex}; }`,
    );
  });

  it('refuses a value that is not a colour', async () => {
    expect(isSectionColour('paper-deep')).toBe(true);
    expect(isSectionColour('#ff0000')).toBe(true);
    expect(isSectionColour('hotpink')).toBe(false);

    await expect(
      saveSectionSettings([{ sectionId: 'doors', height: 0, background: 'hotpink' }]),
    ).rejects.toBeInstanceOf(AdminOperationError);

    expect(await getSectionSettings()).toEqual({});
  });

  /* A colour the palette does not have is kept exactly as picked — and in one
     form, so the same colour typed two ways is one row. */
  it("keeps a colour of the section's own", async () => {
    await saveSectionSettings([{ sectionId: 'doors', height: 0, background: '#A1B2C3' }]);

    expect(await getSectionSettings()).toEqual({ doors: { background: '#a1b2c3' } });
    expect(sectionSettingCss(await getSectionSettings())).toBe(
      '.gateway { background: #a1b2c3; }',
    );
  });

  /* A band can be recoloured at the height the page already draws it, and
     retimed without losing the ground — so either half alone keeps the row and
     neither is written as an empty value the reader would have to interpret. */
  it('keeps the row on either half alone', async () => {
    await saveSectionSettings([{ sectionId: 'story', height: 640, background: 'paper-deep' }]);
    expect(await getSectionSettings()).toEqual({
      story: { height: 640, background: 'paper-deep' },
    });

    await saveSectionSettings([{ sectionId: 'story', height: 0, background: 'paper-deep' }]);
    expect(await getSectionSettings()).toEqual({ story: { background: 'paper-deep' } });

    await saveSectionSettings([{ sectionId: 'story', height: 640, background: '' }]);
    expect(await getSectionSettings()).toEqual({ story: { height: 640 } });
  });

  it('writes both halves into the one rule', async () => {
    await saveSectionSettings([{ sectionId: 'lookbook', height: 500, background: 'paper' }]);

    expect(sectionSettingCss(await getSectionSettings())).toBe(
      `.lookbook { min-height: 500px; background: ${SECTION_COLOURS.paper.hex}; }`,
    );
  });
});

describe('getMediaLayer', () => {
  /* The layer used to carry the page's photographs as well, so a visual editor
     running in an iframe could find each frame by the address it had been
     rendered from. The Media tab edits the registry directly now, so the
     stylesheet is all that is left — and it is the half every visitor was
     being served anyway. */
  it('is a page’s own stylesheet and nothing else', async () => {
    const layer = await getMediaLayer('home');

    expect(layer.page).toBe('home');
    expect(Object.keys(layer).sort()).toEqual(['css', 'page']);
  });

  it('serves nothing for a page with no sections and nothing saved', async () => {
    const faq = await getMediaLayer('faq');

    expect(faq.page).toBe('faq');
    expect(faq.css).toBe('');
  });

  /* Section height and ground are home-page controls, so a saved height must
     not leak into the stylesheet another page serves. */
  it('keeps the home page’s sections to the home page', async () => {
    await saveSectionSettings([{ sectionId: 'lookbook', height: 480 }]);

    expect((await getMediaLayer('home')).css).toContain('.lookbook');
    expect((await getMediaLayer('why-shrinkless')).css).toBe('');
  });

  it('serves the saved heights and grounds as the page’s own stylesheet', async () => {
    await saveSectionSettings([
      { sectionId: 'lookbook', height: 480 },
      { sectionId: 'doors', height: 0, background: 'warm' },
    ]);

    const layer = await getMediaLayer('home');

    expect(layer.css).toContain('.lookbook { min-height: 480px; }');
    expect(layer.css).toContain(`.gateway { background: ${SECTION_COLOURS.warm.hex}; }`);
  });
});
