import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const addressSchema = new Schema(
  {
    name: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String, default: '' },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true, default: 'US' },
    phone: { type: String, default: '' },
  },
  { _id: false },
);

/** Shop-internal note about a customer. Never rendered anywhere a customer
 *  can reach. */
const customerNoteSchema = new Schema(
  {
    body: { type: String, required: true, trim: true },
    actorId: { type: String, default: '' },
    actorEmail: { type: String, default: 'system' },
    at: { type: Date, default: () => new Date() },
  },
  { _id: true },
);

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, default: '' },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer', index: true },
    addresses: { type: [addressSchema], default: [] },
    notes: { type: [customerNoteSchema], default: [] },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema>;
export type AddressDoc = InferSchemaType<typeof addressSchema>;

export const User: Model<UserDoc> =
  (models.User as Model<UserDoc>) ?? model<UserDoc>('User', userSchema);
