import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

/**
 * One outstanding "set a new password" link.
 *
 * The token is stored as a SHA-256 digest rather than in the clear, so a dump
 * of this collection is a list of useless hashes. It is deliberately *not*
 * argon2: a reset token is 32 random bytes, which no amount of hardware will
 * ever guess, and a fast digest is what lets the token be found by lookup
 * instead of by scanning every outstanding row and verifying each one.
 *
 * Customers only. An admin account is never issued one — an admin's second
 * factor would be worth nothing if a single mailbox could replace the
 * password behind it.
 */
const passwordResetSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    /** Where it was sent. Recorded so a reset is auditable after the fact. */
    sentTo: { type: String, required: true },
    /** Set the moment the token is spent. A used token is kept rather than
     *  deleted so a second click gets "already used" instead of a silence
     *  that looks like a broken link. */
    usedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// Housekeeping, not enforcement — expiry is checked on every use. The sweep
// runs an hour past expiry so a just-expired link can still say so.
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 });

export type PasswordResetDoc = InferSchemaType<typeof passwordResetSchema>;

export const PasswordReset: Model<PasswordResetDoc> =
  (models.PasswordReset as Model<PasswordResetDoc>) ??
  model<PasswordResetDoc>('PasswordReset', passwordResetSchema);
