import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const subscriberSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    source: { type: String, default: 'footer' },
    /* One address, many reasons to have given it. The footer sign-up sets
       `source` on first insert and leaves it alone after; a back-in-stock
       request appends `restock:<slug>:<colour>` here, so a shopper who is
       already on the newsletter can still ask to be told about a tee. */
    interests: { type: [String], default: [] },
  },
  { timestamps: true },
);

export type SubscriberDoc = InferSchemaType<typeof subscriberSchema>;

export const Subscriber: Model<SubscriberDoc> =
  (models.Subscriber as Model<SubscriberDoc>) ??
  model<SubscriberDoc>('Subscriber', subscriberSchema);
