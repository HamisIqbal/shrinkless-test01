import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

/**
 * A named way to ship, with the rate it charges and where it applies.
 *
 * The store already had shipping *zones* buried in the settings document — a
 * flat list of state groups with a rate each. That is a rate table, not a
 * shipping method: it cannot express "Standard or Express", cannot be turned
 * off for a week, and cannot be chosen at checkout. This model supersedes it
 * for quoting; `Settings.shippingZones` stays as the fallback so nothing
 * breaks on a store that has not configured a method yet.
 *
 * Matching is deliberately simple and explicit: a method with no countries and
 * no states applies everywhere. Anything listed narrows it.
 */
const shippingMethodSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    /** Stable identifier for an order to record. Never shown to shoppers. */
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: '' },
    rateCents: { type: Number, required: true, min: 0 },
    /** Order subtotal at or above which this method costs nothing. Null means
     *  the method never becomes free on its own. */
    freeOverCents: { type: Number, default: null, min: 0 },
    /** Two-letter country codes. Empty means every country. */
    countries: { type: [String], default: [] },
    /** Two-letter state/province codes. Empty means every state. */
    states: { type: [String], default: [] },
    /** Rough delivery promise, for display. Free text on purpose — carriers
     *  and seasons make anything stricter a lie. */
    estimate: { type: String, default: '' },
    active: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

shippingMethodSchema.index({ archivedAt: 1, active: 1, sortOrder: 1 });

export type ShippingMethodDoc = InferSchemaType<typeof shippingMethodSchema>;

export const ShippingMethod: Model<ShippingMethodDoc> =
  (models.ShippingMethod as Model<ShippingMethodDoc>) ??
  model<ShippingMethodDoc>('ShippingMethod', shippingMethodSchema);
