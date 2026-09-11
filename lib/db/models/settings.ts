import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const shippingZoneSchema = new Schema(
  {
    name: { type: String, required: true },
    states: { type: [String], default: [] },
    rateCents: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const settingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: 'store' },
    storeEmail: { type: String, required: true },
    announcement: { type: String, default: '' },
    shippingZones: { type: [shippingZoneSchema], default: [] },
    freeShippingThresholdCents: { type: Number, default: null },
    /** Store-wide default. A variant may override it; most never need to. */
    lowStockThreshold: { type: Number, default: 3, min: 0 },
    taxMode: { type: String, enum: ['none', 'flat', 'stripe'], default: 'none' },
    flatTaxRateBasisPoints: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

export type SettingsDoc = InferSchemaType<typeof settingsSchema>;

export const Settings: Model<SettingsDoc> =
  (models.Settings as Model<SettingsDoc>) ?? model<SettingsDoc>('Settings', settingsSchema);
