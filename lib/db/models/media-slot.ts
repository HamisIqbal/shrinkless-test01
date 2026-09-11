import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const frameSchema = new Schema(
  {
    /** An absolute URL or a Cloudinary public id — `lib/images.ts` resolves
     *  both, the same convention product images use. */
    url: { type: String, required: true, trim: true },
    /** Never empty. The one decorative use on the site (the footer backdrop)
     *  passes `alt=""` at the call site rather than storing a blank. */
    alt: { type: String, required: true, trim: true },
    /** `object-position`, e.g. `50% 30%`. Where to crop is a property of the
     *  photograph, so it travels with it. */
    focus: { type: String, default: '' },
    /** How far the photograph is scaled up inside the frame, about `focus`.
     *  1 is the frame as `object-fit: cover` gives it. */
    zoom: { type: Number, default: 1, min: 1, max: 3 },
    /** The same pair for the phone, where the frame is usually a different
     *  shape. Unset — not 50%/1 — means "whatever desktop says", so an image
     *  that only ever needed one placement stores one. */
    mobileFocus: { type: String, default: '' },
    mobileZoom: { type: Number, min: 1, max: 3 },
  },
  { _id: false },
);

/**
 * One storefront image slot the admin has changed.
 *
 * Rows exist only for slots that have actually been overridden. Everything
 * else falls through to the manifest in `lib/brand/images.ts`, which stays the
 * built-in default — so a fresh database renders the site exactly as it ships,
 * and "reset to default" is a delete rather than a second copy of the original
 * values that could drift.
 *
 * Every slot stores an ordered `frames` array. Single-image slots are simply
 * an array of one; the hero carousel is the only one that holds more. A scalar
 * column plus a separate array column for the hero would buy nothing and make
 * every read branch.
 *
 * The set of slot ids is a property of the design, not of this collection —
 * `lib/services/site-media.ts` owns the registry and refuses ids outside it.
 */
const mediaSlotSchema = new Schema(
  {
    slotId: { type: String, required: true, unique: true, trim: true },
    frames: { type: [frameSchema], required: true },
  },
  { timestamps: true },
);

export type MediaFrameDoc = InferSchemaType<typeof frameSchema>;
export type MediaSlotDoc = InferSchemaType<typeof mediaSlotSchema>;

export const MediaSlot: Model<MediaSlotDoc> =
  (models.MediaSlot as Model<MediaSlotDoc>) ??
  model<MediaSlotDoc>('MediaSlot', mediaSlotSchema);
