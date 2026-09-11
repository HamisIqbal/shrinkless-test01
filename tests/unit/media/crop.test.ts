import { describe, expect, it } from 'vitest';
import {
  CENTRE,
  ZOOM_MAX,
  ZOOM_MIN,
  cropStyle,
  desktopView,
  focusToPair,
  hasMobileCrop,
  mobileView,
  normaliseFocus,
  normaliseZoom,
  pairToFocus,
  ratioValue,
  viewStyle,
  PRODUCT_RATIOS,
} from '@/lib/media/crop';

describe('normaliseFocus', () => {
  it('keeps a well-formed pair', () => {
    expect(normaliseFocus('42% 63%')).toBe('42% 63%');
  });

  it('falls back to the centre for anything else', () => {
    // Everything here would otherwise reach a style attribute.
    for (const value of [undefined, '', 'top', '50%', '50%50%', 'url(x)', '50px 20px']) {
      expect(normaliseFocus(value)).toBe(CENTRE);
    }
  });
});

describe('focus round trip', () => {
  it('survives a there-and-back', () => {
    expect(pairToFocus(...focusToPair('42% 63%'))).toBe('42% 63%');
  });

  it('clamps a drag that runs off the edge', () => {
    expect(pairToFocus(-0.4, 1.9)).toBe('0% 100%');
  });

  it('rounds to whole percentages, which is all the validator accepts', () => {
    expect(pairToFocus(0.4237, 0.6349)).toBe('42% 63%');
  });
});

describe('normaliseZoom', () => {
  it('bounds the range', () => {
    expect(normaliseZoom(0.2)).toBe(ZOOM_MIN);
    expect(normaliseZoom(9)).toBe(ZOOM_MAX);
    expect(normaliseZoom(1.75)).toBe(1.75);
  });

  it('treats nothing, and nonsense, as no zoom', () => {
    expect(normaliseZoom(undefined)).toBe(ZOOM_MIN);
    expect(normaliseZoom(Number.NaN)).toBe(ZOOM_MIN);
  });
});

describe('the two views', () => {
  it('sends the phone after the desktop until it has a crop of its own', () => {
    const crop = { focus: '30% 20%', zoom: 1.5 };

    expect(mobileView(crop)).toEqual(desktopView(crop));
    expect(hasMobileCrop(crop)).toBe(false);
  });

  it('lets the phone go its own way once it has one', () => {
    const crop = { focus: '30% 20%', zoom: 1.5, mobileFocus: '70% 90%', mobileZoom: 2 };

    expect(desktopView(crop)).toEqual({ focus: '30% 20%', zoom: 1.5 });
    expect(mobileView(crop)).toEqual({ focus: '70% 90%', zoom: 2 });
    expect(hasMobileCrop(crop)).toBe(true);
  });

  it('falls back a half at a time — a mobile position keeps the desktop zoom', () => {
    expect(mobileView({ focus: '30% 20%', zoom: 1.5, mobileFocus: '70% 90%' })).toEqual({
      focus: '70% 90%',
      zoom: 1.5,
    });
  });
});

describe('viewStyle', () => {
  it('pins the zoom to the chosen point, not to the middle of the frame', () => {
    expect(viewStyle({ focus: '30% 20%', zoom: 1.5 })).toEqual({
      objectPosition: '30% 20%',
      transformOrigin: '30% 20%',
      '--crop-zoom': '1.5',
    });
  });
});

describe('cropStyle', () => {
  it('writes nothing for a frame nobody has cropped', () => {
    // The hero sits its frames at 50% 35% in the stylesheet. Writing a
    // position over every untouched frame would quietly undo that.
    expect(cropStyle(undefined)).toEqual({});
    expect(cropStyle({ focus: '', zoom: 1 })).toEqual({});
  });

  it('sends only the desktop pair while the phone is following it', () => {
    expect(cropStyle({ focus: '30% 20%', zoom: 1.5 })).toEqual({
      '--crop-pos': '30% 20%',
      '--crop-zoom': '1.5',
    });
  });

  it('sends both pairs once they differ, for the stylesheet to choose between', () => {
    expect(
      cropStyle({ focus: '30% 20%', zoom: 1.5, mobileFocus: '70% 90%', mobileZoom: 2 }),
    ).toEqual({
      '--crop-pos': '30% 20%',
      '--crop-zoom': '1.5',
      '--crop-pos-m': '70% 90%',
      '--crop-zoom-m': '2',
    });
  });

  it('omits a zoom of 1 rather than stating it', () => {
    expect(cropStyle({ focus: '30% 20%', zoom: 1 })).toEqual({ '--crop-pos': '30% 20%' });
  });

  it('refuses a zoom below 1, which would letterbox the frame', () => {
    expect(cropStyle({ focus: '50% 50%', zoom: 0.5, mobileZoom: 0.5 })).toEqual({
      '--crop-pos': '50% 50%',
      '--crop-zoom-m': '1',
    });
  });
});

describe('ratioValue', () => {
  it('is the CSS aspect-ratio the crop stage and the previews are drawn at', () => {
    expect(ratioValue(PRODUCT_RATIOS.desktop)).toBe('4 / 5');
    expect(ratioValue(PRODUCT_RATIOS.mobile)).toBe('2 / 3');
  });
});
