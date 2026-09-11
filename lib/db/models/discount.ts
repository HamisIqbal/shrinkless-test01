import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

export const DISCOUNT_TYPES = ['percentage', 'fixed'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

/**
 * A coupon.
 *
 * Two rules shape this schema. First, money is integers: a percentage is
 * stored in basis points (2,500 = 25%) and a fixed discount in cents, so no
 * float ever touches a total. Second, the client is never trusted with any of
 * it — the browser sends a *code*, and the server decides what, if anything,
 * that code is worth. Nothing here is ever read from a request body.
 *
 * `usedCount` is a counter incremented atomically at redemption. Per-customer
 * limits need to know *who*, which a counter cannot express, so those are
 * answered from the redemption ledger instead.
 */
const discountSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: '' },
    type: { type: String, enum: DISCOUNT_TYPES, required: true },
    /** Basis points for `percentage`, cents for `fixed`. */
    value: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true, index: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    /** Total redemptions allowed across all customers. Null is unlimited. */
    usageLimit: { type: Number, default: null, min: 1 },
    /** Redemptions allowed per customer. Null is unlimited. */
    perCustomerLimit: { type: Number, default: null, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    /** Order subtotal, before shipping and tax, that must be met. */
    minOrderCents: { type: Number, default: 0, min: 0 },
    /** Empty means "every product". Otherwise the discount only applies to
     *  the lines whose product is listed. */
    productIds: { type: [Schema.Types.ObjectId], ref: 'Product', default: [] },
    /** Empty means "every category". Slugs, matching `Product.category`. */
    categorySlugs: { type: [String], default: [] },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

discountSchema.index({ archivedAt: 1, active: 1 });

export type DiscountDoc = InferSchemaType<typeof discountSchema>;

export const Discount: Model<DiscountDoc> =
  (models.Discount as Model<DiscountDoc>) ?? model<DiscountDoc>('Discount', discountSchema);

/**
 * One redemption. Written when an order is placed, never before — a code
 * sitting in a cart has not been used.
 *
 * Keyed by email as well as user id so a guest checkout still counts against
 * a per-customer limit.
 */
const discountRedemptionSchema = new Schema(
  {
    discountId: { type: Schema.Types.ObjectId, ref: 'Discount', required: true, index: true },
    code: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    amountCents: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

// One redemption per order, so a retried write cannot double-count.
discountRedemptionSchema.index({ discountId: 1, orderId: 1 }, { unique: true });

export type DiscountRedemptionDoc = InferSchemaType<typeof discountRedemptionSchema>;

export const DiscountRedemption: Model<DiscountRedemptionDoc> =
  (models.DiscountRedemption as Model<DiscountRedemptionDoc>) ??
  model<DiscountRedemptionDoc>('DiscountRedemption', discountRedemptionSchema);
