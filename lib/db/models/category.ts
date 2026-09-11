import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

/**
 * A category is the thing a product belongs to and a page a shopper can land
 * on. Until now the set of them lived in a hard-coded array in
 * `lib/shop/navigation.ts`, which meant adding one was a deploy.
 *
 * Products reference a category by **slug**, not by id. That is deliberate:
 * the slug is already on `Product.category`, already in every URL, and already
 * what the storefront queries by — so this collection can be introduced
 * without rewriting a single product document. Renaming a slug is therefore a
 * real operation with consequences, and the service handles it explicitly.
 */
const seoSchema = new Schema(
  {
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    keywords: { type: [String], default: [] },
  },
  { _id: false },
);

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    /** Hidden categories keep their products and their URLs; they simply stop
     *  appearing in navigation. Not the same as archived. */
    visible: { type: Boolean, default: true, index: true },
    /** Manual ordering for the menu. Ties break on name. */
    sortOrder: { type: Number, default: 0 },
    seo: { type: seoSchema, default: () => ({}) },
    /** Soft delete. A category with products can never be hard-deleted, so
     *  this is the only "delete" the admin panel offers. */
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

categorySchema.index({ archivedAt: 1, sortOrder: 1, name: 1 });

export type CategoryDoc = InferSchemaType<typeof categorySchema>;

export const Category: Model<CategoryDoc> =
  (models.Category as Model<CategoryDoc>) ?? model<CategoryDoc>('Category', categorySchema);
