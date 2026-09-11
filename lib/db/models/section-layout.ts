import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

/**
 * One storefront section the admin has set the height or the ground of.
 *
 * The same override pattern the media slots and the content slots use, and for
 * the same reason: a row exists only for a section that has actually been
 * changed, everything else falls through to what the design gives it, and "put
 * it back" is a delete rather than a second copy of the original that could
 * drift.
 *
 * One setting per section, not one per device. A section is a band across the
 * page and the admin edits it from whichever preview is to hand, so a phone
 * and a desk reading different values would be two settings pretending to be
 * one — see `HOME_SECTIONS` in `lib/services/site-media.ts`, which owns the
 * set of ids and where each one lands.
 */
const sectionLayoutSchema = new Schema(
  {
    sectionId: { type: String, required: true, unique: true, trim: true },
    /**
     * Pixels. Bounded in `lib/validation/media.ts`, which is the only door in.
     *
     * Not required, because a row can exist for a colour alone — a section
     * given a warmer ground but left at the height the page draws it keeps no
     * second copy of that height. Absent reads as "the design's own", exactly
     * as a missing content value does.
     */
    height: { type: Number, min: 0 },
    /**
     * A name from the palette in `lib/media/colours.ts`, or a colour of the
     * section's own as `#rrggbb`.
     *
     * A name so that re-tinting the brand moves every section set to one of
     * the site's own grounds without a migration; a hex for the ones dressed
     * to something the palette does not have. Absent is the ground the page
     * already gives the band.
     */
    background: { type: String, trim: true },
  },
  { timestamps: true },
);

export type SectionLayoutDoc = InferSchemaType<typeof sectionLayoutSchema>;

export const SectionLayout: Model<SectionLayoutDoc> =
  (models.SectionLayout as Model<SectionLayoutDoc>) ??
  model<SectionLayoutDoc>('SectionLayout', sectionLayoutSchema);
