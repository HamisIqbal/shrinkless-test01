import { describe, expect, it } from 'vitest';
import {
  SECTION_COLOURS,
  SECTION_COLOUR_IDS,
  isSectionColour,
  isSectionColourName,
  normaliseSectionColour,
  sectionColourHex,
  sectionColourLabel,
  sectionRules,
} from '@/lib/media/colours';

describe('the palette', () => {
  it('offers the three grounds the site is built on', () => {
    expect(SECTION_COLOUR_IDS).toEqual(['paper', 'paper-deep', 'warm']);

    for (const id of SECTION_COLOUR_IDS) {
      expect(SECTION_COLOURS[id].label, id).toBeTruthy();
      expect(SECTION_COLOURS[id].hex, id).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('knows a name it has from a colour of its own', () => {
    for (const id of SECTION_COLOUR_IDS) expect(isSectionColourName(id)).toBe(true);

    for (const value of [undefined, '', '#d8d2c7', 'hotpink', 42, null]) {
      expect(isSectionColourName(value), String(value)).toBe(false);
    }
  });

  it('takes a name or a hex, and nothing else', () => {
    for (const id of SECTION_COLOUR_IDS) expect(isSectionColour(id)).toBe(true);

    for (const value of ['#d8d2c7', '#D8D2C7', 'd8d2c7', '#abc', ' #abc ']) {
      expect(isSectionColour(value), String(value)).toBe(true);
    }

    // Everything here would otherwise reach a stylesheet.
    for (const value of [undefined, '', 'ink', 'hotpink', 'red; background: url(x)', '#gg0011', 42, null]) {
      expect(isSectionColour(value), String(value)).toBe(false);
    }
  });

  /* One stored form, so a colour typed three ways is one row and one rule. */
  it('puts every way of writing a colour into the one form', () => {
    expect(normaliseSectionColour('warm')).toBe('warm');
    expect(normaliseSectionColour('#D8D2C7')).toBe('#d8d2c7');
    expect(normaliseSectionColour('d8d2c7')).toBe('#d8d2c7');
    expect(normaliseSectionColour('#ABC')).toBe('#aabbcc');
    expect(normaliseSectionColour('hotpink')).toBe('');
    expect(normaliseSectionColour(undefined)).toBe('');
  });

  it('resolves a name to its hex, a hex to itself, and everything else to nothing', () => {
    expect(sectionColourHex('warm')).toBe(SECTION_COLOURS.warm.hex);
    expect(sectionColourHex('#123456')).toBe('#123456');
    expect(sectionColourHex('#ABC')).toBe('#aabbcc');
    expect(sectionColourHex('')).toBe('');
    expect(sectionColourHex('hotpink')).toBe('');
  });

  it('calls a named ground by its name and a colour of its own by its hex', () => {
    expect(sectionColourLabel('warm')).toBe('Warm sand');
    expect(sectionColourLabel('#a1b2c3')).toBe('#A1B2C3');
    expect(sectionColourLabel('')).toBe('');
  });
});

/* The rules the published stylesheet and the editor's live preview are both
   built from — so what is on screen while a swatch is being tried is what the
   page will serve after Publish. */
describe('sectionRules', () => {
  it('says nothing about a section that has been left alone', () => {
    expect(sectionRules('.gateway', {})).toBe('');
    expect(sectionRules('.gateway', { height: 0 })).toBe('');
  });

  /* A band whose own height is the design takes the number outright, so it can
     be brought down as well as up; a grid of product cards takes it as a floor,
     because a fixed height there would have the page run out from under
     itself. */
  it('sets a fixed band outright and an open one as a floor', () => {
    expect(sectionRules('.hero', { height: 700 }, true)).toBe(
      '.hero { height: 700px; min-height: 700px; }',
    );
    expect(sectionRules('.lookbook', { height: 700 })).toBe('.lookbook { min-height: 700px; }');
  });

  it('writes both halves into the one rule', () => {
    expect(sectionRules('.tiles', { height: 500, background: 'paper' })).toBe(
      `.tiles { min-height: 500px; background: ${SECTION_COLOURS.paper.hex}; }`,
    );
  });

  it('gives a ground alone its own rule', () => {
    expect(sectionRules('.quotes', { background: 'warm' })).toBe(
      `.quotes { background: ${SECTION_COLOURS.warm.hex}; }`,
    );
  });

  it('writes a colour the palette does not have as it stands', () => {
    expect(sectionRules('.quotes', { background: '#123456' })).toBe(
      '.quotes { background: #123456; }',
    );
  });

  /* The one thing a stylesheet must never carry out of the database. */
  it('says nothing for a background that is not a colour', () => {
    expect(sectionRules('.quotes', { background: 'red; background: url(x)' })).toBe('');
  });
});
