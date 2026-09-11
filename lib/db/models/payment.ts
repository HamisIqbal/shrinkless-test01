import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const paymentSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    provider: { type: String, enum: ['stripe', 'paypal'], required: true },
    providerPaymentId: { type: String, required: true, index: true },
    providerEventId: { type: String, required: true, unique: true },
    amountCents: { type: Number, required: true, min: 0 },
    status: { type: String, required: true },
    last4: { type: String, default: '' },
    brand: { type: String, default: '' },
    raw: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export type PaymentDoc = InferSchemaType<typeof paymentSchema>;

export const Payment: Model<PaymentDoc> =
  (models.Payment as Model<PaymentDoc>) ?? model<PaymentDoc>('Payment', paymentSchema);
