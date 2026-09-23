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
    /* Marketing consent, kept separately from the restock requests above: an
       address given to hear about one tee coming back is not an address that
       agreed to a newsletter. Only `marketing: true` rows that have not
       unsubscribed may be sent news. `consentAt` is when the box was ticked,
       kept as the record CAN-SPAM and the state privacy laws ask for. */
    marketing: { type: Boolean, default: false, index: true },
    consentAt: { type: Date, default: null },
    /** Set by the unsubscribe link. Anything that sends mail must skip these. */
    unsubscribedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

export type SubscriberDoc = InferSchemaType<typeof subscriberSchema>;

export const Subscriber: Model<SubscriberDoc> =
  (models.Subscriber as Model<SubscriberDoc>) ??
  model<SubscriberDoc>('Subscriber', subscriberSchema);
