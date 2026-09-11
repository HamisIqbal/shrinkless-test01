import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

export const ORDER_STATUSES = [
  'pending', 'paid', 'shipped', 'delivered', 'cancelled', 'payment_failed',
] as const;

const orderItemSchema = new Schema(
  {
    title: { type: String, required: true },
    size: { type: String, required: true },
    color: { type: String, required: true },
    sku: { type: String, required: true },
    unitPriceCents: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    imagePublicId: { type: String, default: '' },
  },
  { _id: false },
);

const statusEventSchema = new Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    actor: { type: String, default: 'system' },
    at: { type: Date, default: () => new Date() },
    note: { type: String, default: '' },
  },
  { _id: false },
);

/**
 * An internal note. Never shown to the customer — this is the shop talking to
 * itself about an order, and the distinction has to be structural, not a
 * convention someone remembers.
 */
const orderNoteSchema = new Schema(
  {
    body: { type: String, required: true, trim: true },
    actorId: { type: String, default: '' },
    actorEmail: { type: String, default: 'system' },
    at: { type: Date, default: () => new Date() },
  },
  { _id: true },
);

const shippingAddressSchema = new Schema(
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

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    /* The payment intent this order is being paid through. Held so a shopper
       who reloads checkout resumes the same intent instead of stacking up
       abandoned orders, and so a webhook can find its order. */
    paymentIntentId: { type: String, default: null, index: true },
    /* The basket this order was built from. Held so a shopper who reloads
       checkout resumes their pending order instead of leaving a trail of
       abandoned ones. */
    cartId: { type: Schema.Types.ObjectId, ref: 'Cart', default: null, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    items: { type: [orderItemSchema], required: true },
    shippingAddress: { type: shippingAddressSchema, required: true },
    subtotalCents: { type: Number, required: true, min: 0 },
    /* What the server calculated the discount to be, and the code that earned
       it. Both are recorded on the order because a coupon can be edited or
       archived later and the order still has to explain its own total. */
    discountCode: { type: String, default: '' },
    discountCents: { type: Number, default: 0, min: 0 },
    shippingCents: { type: Number, required: true, min: 0 },
    /** Which shipping method was quoted, by code. */
    shippingMethodCode: { type: String, default: '' },
    shippingMethodName: { type: String, default: '' },
    taxCents: { type: Number, required: true, min: 0 },
    totalCents: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ORDER_STATUSES, default: 'pending', index: true },
    statusHistory: { type: [statusEventSchema], default: [] },
    notes: { type: [orderNoteSchema], default: [] },
    trackingNumber: { type: String, default: '' },
    /** Set when stock has been taken for this order, so a cancellation knows
     *  whether there is anything to give back. */
    stockCommittedAt: { type: Date, default: null },
    /** Cumulative, in cents. Refunds are recorded here and in the status
     *  history; the money itself moves at the payment provider. */
    refundedCents: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

export type OrderDoc = InferSchemaType<typeof orderSchema>;

export const Order: Model<OrderDoc> =
  (models.Order as Model<OrderDoc>) ?? model<OrderDoc>('Order', orderSchema);
