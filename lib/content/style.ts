/**
 * The vocabulary of a content style.
 *
 * Pure on purpose, and free of any database import: the same rules run in
 * three places — the service that writes them, the stylesheet the storefront
 * serves, and the editor drawing its preview in the browser — and one shared
 * copy is the only way those three can agree on what a setting means.
 */

/* --------------------------------------------------------------------------
   How a content field is set

   The second half of this tab: not what a line says, but how it is drawn and
   where it sits. Everything here is a bounded choice rather than free CSS —
   a number with a floor and a ceiling, or one of a handful of named values —
   because the point is a page that still works after the admin has finished
   with it. There is no `position`, no `float`, no z-index: type can be sized,
   weighted, coloured, spaced and placed within the column it already occupies.
   -------------------------------------------------------------------------- */

/** The faces the site loads. Nothing else is offered, because nothing else is
 *  downloaded and a third name here would render as Arial. */
export const CONTENT_FONTS = {
  sans: 'var(--font-sans)',
  serif: 'var(--font-serif)',
} as const;

export type ContentFont = keyof typeof CONTENT_FONTS;

export const CONTENT_WEIGHTS = [300, 400, 500, 600, 700, 800, 900] as const;

export type ContentStyle = {
  font?: ContentFont;
  /** Pixels. Bounded either side: below 8 the line is unreadable, above 160 it
   *  leaves the column whatever else is set. */
  size?: number;
  weight?: number;
  italic?: boolean;
  /** `#rgb` or `#rrggbb`. */
  color?: string;
  /** Per cent. */
  opacity?: number;
  /** Unitless multiple, the way the storefront sets it. */
  lineHeight?: number;
  /** Ems, so it tracks the size rather than fighting it. */
  letterSpacing?: number;
  align?: 'left' | 'center' | 'right';
  transform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  decoration?: 'none' | 'underline' | 'line-through';
  /** Per cent of the space the element already has. */
  width?: number;
  /** A measure, in pixels. 0 means none. */
  maxWidth?: number;
  /** Where the block sits in that space once it is narrower than all of it. */
  place?: 'left' | 'center' | 'right';
  marginTop?: number;
  marginBottom?: number;
  padX?: number;
  padY?: number;
};

/** The same field, set once for each width. Two records rather than one so a
 *  heading can be 56px on a desktop and 34px on a phone, and so changing
 *  either leaves the other alone. */
export type ContentStyleSet = {
  desktop?: ContentStyle;
  mobile?: ContentStyle;
};

/** Where the two viewports part. Matches `48rem` in storefront.css — the
 *  breakpoint the layout itself turns on. */
export const WIDE_MIN = '48rem';
export const MOBILE_MAX = '47.999rem';

const ALIGNS = ['left', 'center', 'right'] as const;
const TRANSFORMS = ['none', 'uppercase', 'lowercase', 'capitalize'] as const;
const DECORATIONS = ['none', 'underline', 'line-through'] as const;

function clamp(value: unknown, low: number, high: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;

  return Math.min(high, Math.max(low, value));
}

function oneOf<T extends readonly string[]>(value: unknown, allowed: T): T[number] | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : undefined;
}

/** Drops anything the vocabulary above does not name and pulls every number
 *  back inside its range. What comes out is safe to write into a stylesheet
 *  without escaping, because none of it is free text. */
export function cleanStyle(input: unknown): ContentStyle | undefined {
  if (!input || typeof input !== 'object') return undefined;

  const raw = input as Record<string, unknown>;
  const color =
    typeof raw.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(raw.color.trim())
      ? raw.color.trim().toLowerCase()
      : undefined;

  const style: ContentStyle = {
    font: oneOf(raw.font, ['sans', 'serif'] as const),
    size: clamp(raw.size, 8, 160),
    weight:
      typeof raw.weight === 'number' && (CONTENT_WEIGHTS as readonly number[]).includes(raw.weight)
        ? raw.weight
        : undefined,
    italic: typeof raw.italic === 'boolean' ? raw.italic : undefined,
    color,
    opacity: clamp(raw.opacity, 0, 100),
    lineHeight: clamp(raw.lineHeight, 0.7, 3),
    letterSpacing: clamp(raw.letterSpacing, -0.1, 0.6),
    align: oneOf(raw.align, ALIGNS),
    transform: oneOf(raw.transform, TRANSFORMS),
    decoration: oneOf(raw.decoration, DECORATIONS),
    width: clamp(raw.width, 10, 100),
    maxWidth: clamp(raw.maxWidth, 0, 1600),
    place: oneOf(raw.place, ALIGNS),
    marginTop: clamp(raw.marginTop, -120, 240),
    marginBottom: clamp(raw.marginBottom, -120, 240),
    padX: clamp(raw.padX, 0, 160),
    padY: clamp(raw.padY, 0, 160),
  };

  for (const [name, value] of Object.entries(style)) {
    if (value === undefined) delete (style as Record<string, unknown>)[name];
  }

  return Object.keys(style).length ? style : undefined;
}

export function cleanStyleSet(input: unknown): ContentStyleSet {
  if (!input || typeof input !== 'object') return {};

  const raw = input as Record<string, unknown>;
  const set: ContentStyleSet = {};

  const desktop = cleanStyle(raw.desktop);
  const mobile = cleanStyle(raw.mobile);

  if (desktop) set.desktop = desktop;
  if (mobile) set.mobile = mobile;

  return set;
}

/**
 * One field's settings as CSS declarations.
 *
 * Every declaration is `!important`. The storefront's own rules are written
 * for the page as designed and are often more specific than anything derived
 * from a live element; an override the admin has just watched take effect in
 * the preview has to survive the same rule on the site itself.
 */
export function styleDeclarations(style: ContentStyle | undefined): string {
  const clean = cleanStyle(style);
  if (!clean) return '';

  const out: string[] = [];
  const set = (property: string, value: string) => out.push(`${property}: ${value} !important;`);

  if (clean.font) set('font-family', CONTENT_FONTS[clean.font]);
  if (clean.size !== undefined) set('font-size', `${clean.size}px`);
  if (clean.weight !== undefined) set('font-weight', String(clean.weight));
  if (clean.italic !== undefined) set('font-style', clean.italic ? 'italic' : 'normal');
  if (clean.color) set('color', clean.color);
  if (clean.opacity !== undefined) set('opacity', String(clean.opacity / 100));
  if (clean.lineHeight !== undefined) set('line-height', String(clean.lineHeight));
  if (clean.letterSpacing !== undefined) set('letter-spacing', `${clean.letterSpacing}em`);
  if (clean.align) set('text-align', clean.align);
  if (clean.transform) set('text-transform', clean.transform);
  if (clean.decoration) set('text-decoration', clean.decoration);
  if (clean.width !== undefined) set('width', `${clean.width}%`);
  if (clean.maxWidth !== undefined) {
    set('max-width', clean.maxWidth ? `${clean.maxWidth}px` : 'none');
  }
  if (clean.marginTop !== undefined) set('margin-top', `${clean.marginTop}px`);
  if (clean.marginBottom !== undefined) set('margin-bottom', `${clean.marginBottom}px`);
  if (clean.padX !== undefined) set('padding-inline', `${clean.padX}px`);
  if (clean.padY !== undefined) set('padding-block', `${clean.padY}px`);

  /* Placement is the one setting with no property of its own. A block narrower
     than its column is moved by its own margins, not by `position` — which is
     what keeps this editor from being able to lift type out of the layout. */
  if (clean.place) {
    set('display', 'block');
    set('margin-inline-start', clean.place === 'left' ? '0' : 'auto');
    set('margin-inline-end', clean.place === 'right' ? '0' : 'auto');
  }

  return out.join(' ');
}

/**
 * Whether a selector is one we are willing to write into a stylesheet.
 *
 * The editor derives these from the live page rather than taking them from a
 * person, but they arrive over the wire like anything else, so the characters
 * that could end a rule and start something else — braces, semicolons, at —
 * are simply not in the alphabet.
 */
export function isSafeSelector(selector: string): boolean {
  return (
    selector.length > 0 && selector.length <= 400 && /^[a-zA-Z0-9 .#_[\]="':()>,-]+$/.test(selector)
  );
}

/** What one field looks like to the editor running inside the page. */
export type ContentLayerField = {
  key: string;
  label: string;
  value: string;
};

export type ContentLayer = {
  page: string;
  css: string;
  fields: ContentLayerField[];
};
