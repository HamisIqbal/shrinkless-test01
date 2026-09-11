import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const cartItemSchema = new Schema(
  {
    variantId: { type: Schema.Types.ObjectId, ref: 'Variant', required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const cartSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true },
);

export type CartDoc = InferSchemaType<typeof cartSchema>;

export const Cart: Model<CartDoc> =
  (models.Cart as Model<CartDoc>) ?? model<CartDoc>('Cart', cartSchema);
