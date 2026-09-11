import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

/**
 * One piece of storefront copy the admin has changed.
 *
 * The same shape the media slots use, and for the same reason: rows exist only
 * for fields that have actually been overridden, and everything else falls
 * through to the defaults declared in `lib/services/site-content.ts`. A fresh
 * database renders the site exactly as it ships, and "restore original" is a
 * delete rather than a second copy of the shipped wording that could drift.
 *
 * The set of keys is a property of the pages, not of this collection — the
 * registry in the service owns it and refuses anything outside it. That is
 * what stops a form inventing a field the site never renders.
 */
const contentSlotSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    /** Not trimmed: a paragraph's leading or trailing space is the admin's to
     *  decide, and the registry bounds the length instead.
     *
     *  Optional, because a row can exist for styling alone — a heading set
     *  larger but still worded the way the site shipped keeps no second copy
     *  of that wording. A missing value reads as "the default". */
    value: { type: String },
    /**
     * How the field is set, per width. Free-form on purpose: the shape is
     * owned by `lib/validation/content.ts`, which is the only door in, and a
     * schema here would be a second copy of it to keep in step.
     */
    style: { type: Schema.Types.Mixed },
    /**
     * Where the field lands in the storefront's markup, as the editor found
     * it — a class-and-position chain derived from the live page when the
     * style was saved. The stylesheet the site serves is built from these, so
     * a rule can only ever point at an element that existed.
     */
    selector: { type: String },
  },
  { timestamps: true },
);

export type ContentSlotDoc = InferSchemaType<typeof contentSlotSchema>;

export const ContentSlot: Model<ContentSlotDoc> =
  (models.ContentSlot as Model<ContentSlotDoc>) ??
  model<ContentSlotDoc>('ContentSlot', contentSlotSchema);
