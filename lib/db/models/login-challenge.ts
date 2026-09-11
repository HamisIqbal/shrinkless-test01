import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

/**
 * A pending second factor for one admin sign-in.
 *
 * The code is never stored in the clear — only an argon2 hash, the same
 * treatment a password gets. A short life and a hard attempt cap are what
 * actually make six digits safe: 10 minutes and 5 guesses leaves an attacker
 * with a 5-in-a-million chance per issued code.
 *
 * One row per admin at a time. Issuing a new code drops the old one, so a
 * mailbox full of codes never means a mailbox full of *valid* codes.
 */
const loginChallengeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    codeHash: { type: String, required: true },
    /** Where the code was sent. Recorded so the prompt can name the mailbox
     *  without re-deriving it, and so a changed destination is auditable. */
    sentTo: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// Mongo's TTL monitor sweeps about once a minute, so this is housekeeping,
// not enforcement. Expiry is also checked on every verify.
loginChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type LoginChallengeDoc = InferSchemaType<typeof loginChallengeSchema>;

export const LoginChallenge: Model<LoginChallengeDoc> =
  (models.LoginChallenge as Model<LoginChallengeDoc>) ??
  model<LoginChallengeDoc>('LoginChallenge', loginChallengeSchema);
