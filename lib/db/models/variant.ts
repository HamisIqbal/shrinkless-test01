import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const variantSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    size: { type: String, required: true, lowercase: true, trim: true },
    color: { type: String, required: true, lowercase: true, trim: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    priceCents: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    /** Per-variant override of the store-wide low-stock threshold. Null means
     *  "use the store setting" — a rule that lives in one place until a
     *  particular variant needs its own. */
    lowStockThreshold: { type: Number, default: null, min: 0 },
    /** Optional colourway shot. Falls back to the product's images when
     *  empty, which is the common case. */
    imagePublicId: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

variantSchema.index({ productId: 1, size: 1, color: 1 }, { unique: true });

export type VariantDoc = InferSchemaType<typeof variantSchema>;

export const Variant: Model<VariantDoc> =
  (models.Variant as Model<VariantDoc>) ?? model<VariantDoc>('Variant', variantSchema);
