import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const imageSchema = new Schema(
  {
    publicId: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    alt: { type: String, default: '' },
    /** Where the frame crops, and how far in. A photograph is shown in more
     *  than one shape — a 2:3 card, a 4:5 gallery — so which part survives is
     *  a property of the photograph, exactly as it is for site media. */
    focus: { type: String, default: '' },
    zoom: { type: Number, default: 1, min: 1, max: 3 },
    mobileFocus: { type: String, default: '' },
    mobileZoom: { type: Number, min: 1, max: 3 },
  },
  { _id: false },
);

const seoSchema = new Schema(
  {
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    keywords: { type: [String], default: [] },
  },
  { _id: false },
);

/**
 * How this product may be bought.
 *
 * Some things sell singly; some sell in pairs; some have a minimum. Rather
 * than teach the cart about product types, a product states its own rule and
 * the server enforces it: quantities start at `min`, move in steps of `step`,
 * and stop at `max` when one is set. The default — 1, 1, none — is the
 * ordinary case and costs nothing.
 */
const quantityRuleSchema = new Schema(
  {
    min: { type: Number, default: 1, min: 1 },
    step: { type: Number, default: 1, min: 1 },
    max: { type: Number, default: null, min: 1 },
  },
  { _id: false },
);

const productSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    category: { type: String, required: true, index: true },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    // Editorially chosen, not computed. The store has no sales history to rank
    // by, so "featured" is something an admin decides rather than something a
    // best-seller query invents.
    featured: { type: Boolean, default: false, index: true },
    // Editorial, like `featured`, and for the same reason: "new" is a decision
    // about what to promote, not a fact about a timestamp. Every product in a
    // freshly seeded catalogue was created in the same second, so deriving
    // this from `createdAt` would either badge all of them or none.
    badge: { type: String, enum: ['none', 'new'], default: 'none' },
    // Out of 5, to one decimal. Zero means "not rated yet" and draws nothing,
    // which is the honest state for a product nobody has reviewed — a card
    // showing 0.0 would read as a terrible rating rather than as no rating.
    // There is no review collection yet; this is the number an admin sets.
    rating: { type: Number, default: 0, min: 0, max: 5 },
    /** Free-form merchandising labels. Lowercased on the way in so "Tee" and
     *  "tee" are one tag, not two. */
    tags: { type: [String], default: [], index: true },
    /** Product-level stock keeping code. Variants carry their own SKUs, which
     *  are what actually ship; this is the family they belong to. */
    baseSku: { type: String, default: '', uppercase: true, trim: true },
    seo: { type: seoSchema, default: () => ({}) },
    quantityRule: { type: quantityRuleSchema, default: () => ({}) },
    /* Images are ordered. Position 0 is the featured image — the one a card,
       a cart line and a share preview all use — so reordering is how the
       featured image is chosen. */
    images: { type: [imageSchema], default: [] },
    optionSets: {
      sizes: { type: [String], default: [] },
      colors: { type: [String], default: [] },
    },
    /** Soft delete. Products are never removed: carts hold variant ids and
     *  past orders were priced from them, so a hard delete would rewrite
     *  history. Archived products leave the storefront and the admin list. */
    archivedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

export type ProductDoc = InferSchemaType<typeof productSchema>;

export const Product: Model<ProductDoc> =
  (models.Product as Model<ProductDoc>) ?? model<ProductDoc>('Product', productSchema);
