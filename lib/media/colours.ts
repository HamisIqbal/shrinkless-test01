/**
 * The grounds a home-page section can be set to.
 *
 * Pure on purpose, and free of any database import: the same colours are read
 * in three places — the service that writes them, the stylesheet the
 * storefront serves, and the editor drawing its swatches and its live preview
 * in the browser — and one shared copy is the only way those three can agree
 * on what `warm` means. The same arrangement `lib/content/style.ts` uses for
 * type, for the same reason.
 *
 * The three named grounds are the ones the rest of the site is built on and
 * the ones the editor offers first, but a section can also be given any colour
 * outright: the admin panel is where the shop is dressed, and a ground the
 * palette does not have should not need a deploy.
 */

/**
 * The named grounds — stored by name, never by hex.
 *
 * So re-tinting the brand moves every section that was set to `paper` without
 * a migration — these values are the tokens in `app/globals.css`, written out
 * because a `var()` would resolve against whatever the section it lands in
 * inherits. A section set to a colour of its own stores that colour instead,
 * as `#rrggbb`, and is left alone by a re-tint.
 */
export const SECTION_COLOURS = {
  paper: { label: 'Paper', hex: '#f5f4f0' },
  'paper-deep': { label: 'Deep paper', hex: '#edece7' },
  warm: { label: 'Warm sand', hex: '#d8d2c7' },
} as const;

/** One of the site's own grounds. */
export type SectionColourName = keyof typeof SECTION_COLOURS;

/** What a section's ground is stored as: one of the names above, or a colour
 *  of its own as `#rrggbb`. */
export type SectionColour = SectionColourName | (string & {});

/** The order the editor lists the named ones in — lightest first, which is the
 *  order they read as on the page. */
export const SECTION_COLOUR_IDS = Object.keys(SECTION_COLOURS) as SectionColourName[];

/** Three digits or six, with or without the hash — what a person types into a
 *  hex box. Nothing else is a colour as far as anything downstream is
 *  concerned, which is what keeps a stylesheet free of anything but a colour. */
const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Whether a value names one of the site's own grounds. */
export function isSectionColourName(value: unknown): value is SectionColourName {
  return typeof value === 'string' && value in SECTION_COLOURS;
}

/**
 * The one form a colour is stored and served in: a palette name as it stands,
 * a hex as lowercase `#rrggbb`, and everything else as the empty string.
 *
 * Every door into the database and every door out of it goes through here, so
 * `#FFF`, `fff` and `#ffffff` are one row and one rule rather than three.
 */
export function normaliseSectionColour(value: unknown): string {
  if (isSectionColourName(value)) return value;
  if (typeof value !== 'string') return '';

  const match = value.trim().match(HEX);
  if (!match) return '';

  const digits = match[1].toLowerCase();

  return `#${digits.length === 3 ? [...digits].map((digit) => digit + digit).join('') : digits}`;
}

/** Whether a value is a ground a section can actually be given — a name this
 *  site has, or a colour written as hex. Everything that reaches the database
 *  or a stylesheet passes through here first. */
export function isSectionColour(value: unknown): value is SectionColour {
  return normaliseSectionColour(value) !== '';
}

/** The hex a stored ground resolves to, or empty for anything else —
 *  including the empty string, which is how "the ground the page already gives
 *  it" is stored. */
export function sectionColourHex(value: string | undefined): string {
  if (isSectionColourName(value)) return SECTION_COLOURS[value].hex;

  return normaliseSectionColour(value);
}

/** What a stored ground is called in the admin panel: the palette's word for
 *  it, or the hex itself, which is the only name a colour of its own has. */
export function sectionColourLabel(value: string | undefined): string {
  if (isSectionColourName(value)) return SECTION_COLOURS[value].label;

  return normaliseSectionColour(value).toUpperCase();
}

/**
 * What one section is set to.
 *
 * Both halves optional and both meaning the same thing when absent: leave the
 * design's own. A section is only in the database at all once one of them has
 * been set.
 */
export type SectionSetting = {
  /** Pixels. 0 — like absent — is the height the page gives it. */
  height?: number;
  background?: SectionColour;
};

/**
 * One section's rules, or nothing at all.
 *
 * Shared by the published stylesheet and the editor's preview so the two
 * cannot drift: what is on screen while a swatch is being tried is built by
 * the same function that will serve the page after Publish.
 *
 * `fixed` is for the sections whose height *is* the design — a viewport-tall
 * hero, a full-bleed band. Those take the number as a height so it can be
 * brought down as well as up; everything else takes it as a floor, because a
 * fixed height on a grid of product cards would have the page run out from
 * under itself.
 */
export function sectionRules(
  selector: string,
  setting: SectionSetting,
  fixed?: boolean,
): string {
  const declarations: string[] = [];

  const height = setting.height ?? 0;
  if (height > 0) {
    declarations.push(
      fixed ? `height: ${height}px; min-height: ${height}px` : `min-height: ${height}px`,
    );
  }

  const hex = sectionColourHex(setting.background);
  if (hex) declarations.push(`background: ${hex}`);

  return declarations.length ? `${selector} { ${declarations.join('; ')}; }` : '';
}
