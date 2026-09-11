import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

/**
 * One fixed window of attempts for one key.
 *
 * Deliberately in the database rather than in process memory: this app runs on
 * serverless functions, where each request may land on a different instance
 * and instances come and go. An in-memory counter there does not limit
 * anything — it just occasionally notices.
 */
const rateLimitSchema = new Schema(
  {
    /** `<bucket>:<subject>` — e.g. `login:someone@example.com`. */
    key: { type: String, required: true, unique: true },
    count: { type: Number, required: true, default: 0 },
    /** When this window closes. Also the TTL, so spent windows sweep away. */
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RateLimitDoc = InferSchemaType<typeof rateLimitSchema>;

export const RateLimit: Model<RateLimitDoc> =
  (models.RateLimit as Model<RateLimitDoc>) ?? model<RateLimitDoc>('RateLimit', rateLimitSchema);
