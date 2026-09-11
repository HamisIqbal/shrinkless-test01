import { describe, expect, it } from 'vitest';
import { withTestDatabase } from '@/tests/setup/db';
import { ContentSlot } from '@/lib/db/models/content-slot';
import {
  CONTENT_KEYS,
  LONG_MAX,
  SHORT_MAX,
  defaultContent,
  getSiteContent,
  getContentLayer,
  isKnownContentKey,
  listContentPages,
  resetContentField,
  saveContentField,
  saveContentFields,
  styleDeclarations,
} from '@/lib/services/site-content';
import { AdminOperationError } from '@/lib/admin/action';

withTestDatabase();

describe('getSiteContent with nothing saved', () => {
  it('renders the wording the site ships with', async () => {
    const copy = await getSiteContent();

    expect(copy['home.hero.eyebrow']).toBe('Made in USA');
    expect(copy['story.title']).toBe('Our Story');
    expect(copy['faq.1.q']).toBe('Does it really not shrink?');
  });

  it('answers for every key the registry declares', async () => {
    const copy = await getSiteContent();

    for (const key of CONTENT_KEYS) {
      expect(copy[key], key).toBeTruthy();
      expect(copy[key], key).toBe(defaultContent(key));
    }
  });
});

describe('saveContentField', () => {
  it('overlays one field and leaves the rest alone', async () => {
    await saveContentField('home.hero.headline1', 'Tees that hold');

    const copy = await getSiteContent();

    expect(copy['home.hero.headline1']).toBe('Tees that hold');
    expect(copy['home.hero.headline2']).toBe(defaultContent('home.hero.headline2'));
  });

  it('writes one row per field, and updates rather than duplicates', async () => {
    await saveContentField('why.cta', 'Shop the range');
    await saveContentField('why.cta', 'Buy a tee');

    expect(await ContentSlot.countDocuments({ key: 'why.cta' })).toBe(1);
    expect((await getSiteContent())['why.cta']).toBe('Buy a tee');
  });

  it('trims what it is given', async () => {
    await saveContentField('faq.title', '  Questions  ');

    expect((await getSiteContent())['faq.title']).toBe('Questions');
  });

  it('refuses a key the site does not have', async () => {
    await expect(saveContentField('home.hero.nonsense', 'Anything')).rejects.toBeInstanceOf(
      AdminOperationError,
    );
  });

  it('refuses an empty field, because a blank heading is a hole in the page', async () => {
    await expect(saveContentField('why.title', '   ')).rejects.toBeInstanceOf(AdminOperationError);
  });

  it('holds a heading to the short limit and a paragraph to the long one', async () => {
    await expect(saveContentField('why.title', 'x'.repeat(SHORT_MAX + 1))).rejects.toBeInstanceOf(
      AdminOperationError,
    );

    await saveContentField('story.body', 'x'.repeat(SHORT_MAX + 1));
    expect((await getSiteContent())['story.body']).toHaveLength(SHORT_MAX + 1);

    await expect(saveContentField('story.body', 'x'.repeat(LONG_MAX + 1))).rejects.toBeInstanceOf(
      AdminOperationError,
    );
  });
});

describe('resetContentField', () => {
  it('forgets the override rather than writing the original back', async () => {
    await saveContentField('wholesale.title', 'Trade');
    await resetContentField('wholesale.title');

    expect(await ContentSlot.countDocuments({ key: 'wholesale.title' })).toBe(0);
    expect((await getSiteContent())['wholesale.title']).toBe('Wholesale');
  });

  it('refuses a key the site does not have', async () => {
    await expect(resetContentField('nope')).rejects.toBeInstanceOf(AdminOperationError);
  });
});

describe('a row for a field the registry no longer has', () => {
  it('is ignored rather than served', async () => {
    await ContentSlot.create({ key: 'home.hero.retired', value: 'Ghost' });

    const copy = await getSiteContent();

    expect(copy['home.hero.retired']).toBeUndefined();
    expect(isKnownContentKey('home.hero.retired')).toBe(false);
  });
});

describe('listContentPages', () => {
  it('offers the pages that actually carry hand-written copy', async () => {
    const pages = await listContentPages();

    expect(pages.map((page) => page.id)).toEqual([
      'home',
      'our-story',
      'why-shrinkless',
      'faq',
    ]);
  });

  it('leaves the two shop landings out of the editor but keeps their wording', async () => {
    const pages = await listContentPages();
    const ids = pages.map((page) => page.id);

    expect(ids).not.toContain('men');
    expect(ids).not.toContain('women');

    // The storefront still renders them, so the fields must survive.
    const copy = await getSiteContent();
    expect(copy['shop.men.title']).toBe('Men');
    expect(copy['shop.women.title']).toBe('Women');
  });

  it('gives every page at least one editable field', async () => {
    const pages = await listContentPages();

    for (const page of pages) {
      const fields = page.sections.flatMap((section) => section.fields);
      expect(fields.length, page.id).toBeGreaterThan(0);
    }
  });

  it('marks a saved field as changed and leaves the rest original', async () => {
    await saveContentField('faq.3.a', '7oz organic cotton.');

    const pages = await listContentPages();
    const fields = pages.flatMap((page) => page.sections.flatMap((section) => section.fields));
    const changed = fields.filter((field) => field.overridden);

    expect(changed).toHaveLength(1);
    expect(changed[0].key).toBe('faq.3.a');
    expect(changed[0].value).toBe('7oz organic cotton.');
  });

  it('names every field exactly once across every page', async () => {
    const pages = await listContentPages();
    const keys = pages.flatMap((page) =>
      page.sections.flatMap((section) => section.fields.map((field) => field.key)),
    );

    expect(new Set(keys).size).toBe(keys.length);

    const hidden = ['shop.men.title', 'shop.women.title', 'wholesale.title'];
    expect(keys.sort()).toEqual(CONTENT_KEYS.filter((key) => !hidden.includes(key)).sort());
  });

  it('carries no media, so an image can never be edited from this tab', async () => {
    const pages = await listContentPages();
    const kinds = new Set(
      pages.flatMap((page) =>
        page.sections.flatMap((section) => section.fields.map((f) => f.kind)),
      ),
    );

    expect(kinds.has('heading')).toBe(true);
    for (const kind of kinds) {
      expect([
        'eyebrow',
        'heading',
        'lede',
        'body',
        'button',
        'question',
        'answer',
        'label',
      ]).toContain(kind);
    }
  });
});

describe('styleDeclarations', () => {
  it('writes only settings the vocabulary names, at the sizes it allows', () => {
    const css = styleDeclarations({
      size: 48,
      weight: 700,
      color: '#FFFFFF',
      opacity: 60,
      align: 'center',
    });

    expect(css).toContain('font-size: 48px !important;');
    expect(css).toContain('font-weight: 700 !important;');
    expect(css).toContain('color: #ffffff !important;');
    expect(css).toContain('opacity: 0.6 !important;');
    expect(css).toContain('text-align: center !important;');
  });

  it('drops what it does not know and pulls numbers back inside their range', () => {
    const css = styleDeclarations({
      size: 9000,
      weight: 450,
      color: 'red; } body { display: none',
      align: 'justify',
    } as never);

    expect(css).toContain('font-size: 160px !important;');
    expect(css).not.toContain('font-weight');
    expect(css).not.toContain('color');
    expect(css).not.toContain('text-align');
    expect(css).not.toContain('}');
  });

  it('is empty when nothing has been set', () => {
    expect(styleDeclarations({})).toBe('');
    expect(styleDeclarations(undefined)).toBe('');
  });
});

describe('getContentLayer', () => {
  it('serves a page its own saved settings, at each width', async () => {
    await saveContentFields([
      {
        key: 'home.hero.headline1',
        value: 'Organic tees',
        selector: '.hero__head > span.hero__line',
        style: { desktop: { size: 56 }, mobile: { size: 34 } },
      },
    ]);

    const layer = await getContentLayer('home');

    expect(layer.page).toBe('home');
    expect(layer.css).toContain('@media (min-width: 48rem)');
    expect(layer.css).toContain('font-size: 56px !important;');
    expect(layer.css).toContain('@media (max-width: 47.999rem)');
    expect(layer.css).toContain('font-size: 34px !important;');
    expect(layer.fields.some((field) => field.key === 'home.hero.headline1')).toBe(true);
  });

  it('refuses to build a rule out of a selector it did not like', async () => {
    await saveContentFields([
      {
        key: 'faq.title',
        value: 'FAQ',
        selector: 'h1 { } body',
        style: { desktop: { size: 40 } },
      },
    ]);

    const layer = await getContentLayer('faq');
    expect(layer.css).toBe('');
  });

  it('says nothing about a page it does not have', async () => {
    const layer = await getContentLayer('nowhere');

    expect(layer.css).toBe('');
    expect(layer.fields).toEqual([]);
  });
});
