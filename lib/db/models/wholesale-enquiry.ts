import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

/**
 * One line of a quote request, priced at the moment it was asked for.
 *
 * The title and the unit price are copied in rather than referenced, for the
 * same reason an order item copies them: a quote is a statement about what was
 * offered on a particular day, and re-reading it through today's price ladder
 * would silently rewrite what the buyer was told.
 */
const enquiryLineSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    slug: { type: String, required: true },
    title: { type: String, required: true },
    /** Units. One of the five tiers in `lib/wholesale/pricing.ts`. */
    tier: { type: Number, required: true, min: 1 },
    unitPriceCents: { type: Number, required: true, min: 0 },
    totalCents: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const wholesaleEnquirySchema = new Schema(
  {
    company: { type: String, required: true, trim: true },
    contactName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    phone: { type: String, default: '' },
    country: { type: String, required: true, trim: true },
    message: { type: String, default: '' },
    lines: { type: [enquiryLineSchema], required: true },
    /** Roll-ups, stored rather than derived, so a list of enquiries is one
     *  query rather than one query and a fold over every line. */
    units: { type: Number, required: true, min: 0 },
    totalCents: { type: Number, required: true, min: 0 },
    /* Where this got to. Nothing writes anything but `new` yet — the admin
       side of wholesale is not built — but an enquiry with no state is one
       nobody can tell has been dealt with. */
    status: {
      type: String,
      enum: ['new', 'answered', 'closed'],
      default: 'new',
      index: true,
    },
  },
  { timestamps: true },
);

export type WholesaleEnquiryDoc = InferSchemaType<typeof wholesaleEnquirySchema>;

export const WholesaleEnquiry: Model<WholesaleEnquiryDoc> =
  (models.WholesaleEnquiry as Model<WholesaleEnquiryDoc>) ??
  model<WholesaleEnquiryDoc>('WholesaleEnquiry', wholesaleEnquirySchema);
