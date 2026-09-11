import type { CSSProperties } from 'react';

/**
 * How a photograph sits inside a frame it does not share a shape with.
 *
 * Two numbers, no re-encoding. `focus` is the `object-position` the frame
 * already understood; `zoom` scales the covered image about that same point.
 * Nothing is cut from the file, so the crop is reversible, survives a change
 * of layout, and works for the seeded `https://` photography exactly as it
 * does for a Cloudinary upload — which a baked `c_crop` transform could not.
 *
 * The geometry that makes the two agree: with `object-fit: cover` and
 * `object-position: p% q%`, the point at `p%, q%` **of the frame** is the point
 * at `p%, q%` **of the photograph**, in both axes. Pinning `transform-origin`
 * to the same pair therefore zooms around the chosen subject rather than
 * around the middle of the frame, and the admin's crop stage and the
 * storefront can render from one style.
 */
export type Crop = {
  /** `object-position`, e.g. `"42% 63%"`. Empty means the centre. */
  focus?: string;
  /** 1 is the frame as `cover` gives it. Never below 1 — that would letterbox. */
  zoom?: number;
  /**
   * The same two, for the phone.
   *
   * A wide frame and a tall one cannot honour one crop: the band that works
   * across a 16:9 hero is most of a 9:16 one, and the subject placed nicely in
   * the first is often out of the second entirely. So a photograph carries two
   * placements and the layout picks — see `cropStyle`.
   *
   * Empty means "whatever desktop says", which is what every image starts as
   * and what most of them stay. A mobile crop is stored only once someone has
   * actually made one, so the two do not have to be kept in step by hand.
   */
  mobileFocus?: string;
  mobileZoom?: number;
};

/** One resolved placement: what a single frame, at a single width, renders. */
export type CropView = { focus: string; zoom: number };

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;
export const ZOOM_STEP = 0.01;

export const CENTRE = '50% 50%';

export function normaliseZoom(value: number | undefined): number {
  if (!Number.isFinite(value)) return ZOOM_MIN;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value as number));
}

export function normaliseFocus(value: string | undefined): string {
  return value && /^\d{1,3}% \d{1,3}%$/.test(value) ? value : CENTRE;
}

/** `"42% 63%"` → `[42, 63]`, as fractions of the frame. */
export function focusToPair(value: string | undefined): [number, number] {
  const [x, y] = normaliseFocus(value).split(' ');
  return [Number.parseInt(x, 10) / 100, Number.parseInt(y, 10) / 100];
}

/** The inverse, clamped and rounded — the stored form is integers, because
 *  that is what `lib/validation/media.ts` accepts into a style attribute. */
export function pairToFocus(x: number, y: number): string {
  const clamp = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 100);
  return `${clamp(x)}% ${clamp(y)}%`;
}

/** What this photograph does at a desk. */
export function desktopView(crop: Crop | undefined): CropView {
  return { focus: normaliseFocus(crop?.focus), zoom: normaliseZoom(crop?.zoom) };
}

/** What it does in a hand — its own placement, or the desktop one until
 *  somebody gives it one of its own. */
export function mobileView(crop: Crop | undefined): CropView {
  return {
    focus: normaliseFocus(crop?.mobileFocus || crop?.focus),
    zoom: normaliseZoom(crop?.mobileZoom ?? crop?.zoom),
  };
}

/** True once the phone has been cropped away from the desk. */
export function hasMobileCrop(crop: Crop | undefined): boolean {
  return Boolean(crop?.mobileFocus) || crop?.mobileZoom !== undefined;
}

/**
 * One placement, rendered directly.
 *
 * For a frame whose shape is already decided — the admin's two crop stages,
 * each of which is showing one view and nothing else.
 */
export function viewStyle(view: CropView): CSSProperties {
  return {
    objectPosition: view.focus,
    transformOrigin: view.focus,
    ['--crop-zoom' as string]: String(view.zoom),
  };
}

/**
 * Both placements, as custom properties for the storefront.
 *
 * The storefront cannot be handed a resolved `object-position`: which of the
 * two applies is a question about the viewport, and the server does not know
 * the viewport. So both travel down as custom properties and `storefront.css`
 * picks between them at the same 48rem breakpoint the layouts turn at —
 * `--crop-p` and `--crop-z` are the resolved pair every rule then reads.
 *
 * A property is only written when there is something to say, so an image
 * nobody has cropped inherits the stylesheet's own placement — the hero sits
 * its frames at `50% 35%`, and an inline `50% 50%` over every untouched frame
 * would quietly undo that.
 */
export function cropStyle(crop: Crop | undefined): CSSProperties {
  // Custom properties are not part of `CSSProperties`, and React passes any
  // key beginning with `--` through to the style attribute verbatim.
  const style: Record<string, string> = {};

  if (crop?.focus) style['--crop-pos'] = normaliseFocus(crop.focus);

  const zoom = normaliseZoom(crop?.zoom);
  if (zoom > ZOOM_MIN) style['--crop-zoom'] = String(zoom);

  if (crop?.mobileFocus) style['--crop-pos-m'] = normaliseFocus(crop.mobileFocus);

  if (crop?.mobileZoom !== undefined) {
    style['--crop-zoom-m'] = String(normaliseZoom(crop.mobileZoom));
  }

  return style as CSSProperties;
}

/* --------------------------------------------------------------------------
   Frame shapes

   A crop is only meaningful against the shape it will be seen in, so every
   editable image declares the two it actually renders at. These are the
   `aspect-ratio` values in `app/storefront.css`, kept here in the one form the
   admin can hold a photograph up against.
   -------------------------------------------------------------------------- */

export type Ratio = { w: number; h: number };

export type ViewRatios = {
  /** The shape at a desk. This is the crop stage's own shape. */
  desktop: Ratio;
  /** The shape on a phone, where the same photograph is usually taller. */
  mobile: Ratio;
};

export function ratioValue(ratio: Ratio): string {
  return `${ratio.w} / ${ratio.h}`;
}

/** Product photography: the gallery frame on the product page, and the card
 *  reel in the grid, which is taller. */
export const PRODUCT_RATIOS: ViewRatios = {
  desktop: { w: 4, h: 5 },
  mobile: { w: 2, h: 3 },
};

/**
 * The wholesale line sheet frame.
 *
 * `.sheetrow__frame` is 2:3 at both widths — the sheet keeps one shape so the
 * ten rows stay a column you can run your eye down. The two stages are still
 * both worth having: the frame is a 9rem thumbnail at a desk and a 5rem one in
 * a hand, and a subject that reads at the first is often lost at the second,
 * which is exactly the decision `--crop-pos-m` exists to record.
 */
export const WHOLESALE_RATIOS: ViewRatios = {
  desktop: { w: 2, h: 3 },
  mobile: { w: 2, h: 3 },
};
