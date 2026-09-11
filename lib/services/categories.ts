import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db/connection';
import { Category } from '@/lib/db/models/category';
import { Product } from '@/lib/db/models/product';
import { countProductsInCategory, reassignCategory } from '@/lib/services/products';
import type { CategoryInput } from '@/lib/validation/category';
import type { CategoryDTO } from '@/types/dto';

export class CategorySlugTakenError extends Error {
  constructor(slug: string) {
    super(`Another category already uses the slug "${slug}"`);
    this.name = 'CategorySlugTakenError';
  }
}

export class CategoryNotFoundError extends Error {
  constructor(id: string) {
    super(`No category with id ${id}`);
    this.name = 'CategoryNotFoundError';
  }
}

export class CategoryNotEmptyError extends Error {
  constructor(slug: string, count: number) {
    super(
      `"${slug}" still has ${count} ${count === 1 ? 'product' : 'products'}. ` +
        'Move them to another category first.',
    );
    this.name = 'CategoryNotEmptyError';
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toDTO(doc: any, productCount: number): CategoryDTO {
  return {
    id: String(doc._id),
    name: doc.name,
    slug: doc.slug,
    description: doc.description ?? '',
    visible: doc.visible !== false,
    sortOrder: doc.sortOrder ?? 0,
    seo: {
      title: doc.seo?.title ?? '',
      description: doc.seo?.description ?? '',
      keywords: doc.seo?.keywords ?? [],
    },
    archived: Boolean(doc.archivedAt),
    productCount,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Product counts for a set of slugs, in one grouped query rather than one
 *  query per category. */
async function countsBySlug(slugs: string[]): Promise<Map<string, number>> {
  if (!slugs.length) return new Map();

  const rows = await Product.aggregate<{ _id: string; count: number }>([
    { $match: { category: { $in: slugs }, archivedAt: null } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);

  return new Map(rows.map((row) => [row._id, row.count]));
}

export async function listCategories(
  options: { includeArchived?: boolean } = {},
): Promise<CategoryDTO[]> {
  await connectToDatabase();

  const query = options.includeArchived ? {} : { archivedAt: null };
  const docs = await Category.find(query).sort({ sortOrder: 1, name: 1 }).lean();
  const counts = await countsBySlug(docs.map((doc) => doc.slug));

  return docs.map((doc) => toDTO(doc, counts.get(doc.slug) ?? 0));
}

/** What the storefront navigation should show: live, visible, in order. */
export async function listVisibleCategories(): Promise<CategoryDTO[]> {
  const all = await listCategories();
  return all.filter((category) => category.visible);
}

export async function getCategory(id: string): Promise<CategoryDTO | null> {
  if (!Types.ObjectId.isValid(id)) return null;

  await connectToDatabase();

  const doc = await Category.findById(id).lean();
  if (!doc) return null;

  return toDTO(doc, await countProductsInCategory(doc.slug));
}

export async function getCategoryBySlug(slug: string): Promise<CategoryDTO | null> {
  await connectToDatabase();

  const doc = await Category.findOne({ slug, archivedAt: null }).lean();
  if (!doc) return null;

  return toDTO(doc, await countProductsInCategory(doc.slug));
}

/**
 * Creates or updates a category.
 *
 * Renaming the slug is the interesting case: products point at categories by
 * slug, so the products have to move with it or they end up orphaned behind a
 * URL that no longer resolves. That reassignment happens here, in the same
 * call, rather than being left as a chore someone has to remember.
 */
export async function saveCategory(input: CategoryInput): Promise<string> {
  await connectToDatabase();

  if (input.id && !Types.ObjectId.isValid(input.id)) throw new CategoryNotFoundError(input.id);

  const clash = await Category.findOne({ slug: input.slug }).select('_id').lean();
  if (clash && (!input.id || String(clash._id) !== input.id)) {
    throw new CategorySlugTakenError(input.slug);
  }

  const fields = {
    name: input.name,
    slug: input.slug,
    description: input.description,
    visible: input.visible,
    sortOrder: input.sortOrder,
    seo: input.seo,
  };

  if (!input.id) {
    const created = await Category.create(fields);
    return String(created._id);
  }

  const existing = await Category.findById(input.id).select('slug').lean();
  if (!existing) throw new CategoryNotFoundError(input.id);

  await Category.updateOne({ _id: input.id }, { $set: fields });

  if (existing.slug !== input.slug) {
    await reassignCategory(existing.slug, input.slug);
  }

  return input.id;
}

/**
 * Archives a category. Never touches its products.
 *
 * Refusing while products remain is the whole point: a category that
 * disappeared under a live product would leave that product reachable but
 * uncategorised, and the storefront's category pages would quietly 404.
 */
export async function archiveCategory(id: string, archived: boolean): Promise<void> {
  if (!Types.ObjectId.isValid(id)) throw new CategoryNotFoundError(id);

  await connectToDatabase();

  const category = await Category.findById(id).select('slug').lean();
  if (!category) throw new CategoryNotFoundError(id);

  if (archived) {
    const count = await countProductsInCategory(category.slug);
    if (count > 0) throw new CategoryNotEmptyError(category.slug, count);
  }

  await Category.updateOne(
    { _id: id },
    { $set: { archivedAt: archived ? new Date() : null } },
  );
}

/** Applies a new manual order in one pass. Ids not listed are left alone. */
export async function reorderCategories(orderedIds: string[]): Promise<void> {
  await connectToDatabase();

  const valid = orderedIds.filter((id) => Types.ObjectId.isValid(id));
  if (!valid.length) return;

  await Category.bulkWrite(
    valid.map((id, index) => ({
      updateOne: { filter: { _id: new Types.ObjectId(id) }, update: { $set: { sortOrder: index } } },
    })),
  );
}

/** Moves products between categories. The admin-facing way to assign or
 *  unassign in bulk. */
export async function assignProductsToCategory(
  productIds: string[],
  slug: string,
): Promise<number> {
  await connectToDatabase();

  const ids = productIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
  if (!ids.length) return 0;

  const category = await Category.findOne({ slug, archivedAt: null }).select('_id').lean();
  if (!category) throw new Error(`No live category with slug "${slug}"`);

  const result = await Product.updateMany({ _id: { $in: ids } }, { $set: { category: slug } });
  return result.modifiedCount ?? 0;
}

/**
 * Creates category documents for slugs that products already use.
 *
 * The catalogue predates this collection — categories were a hard-coded array
 * — so on first run the admin panel would show an empty list beside a shop
 * full of products. This backfills from the source of truth: what products
 * actually say they are.
 */
export async function backfillCategoriesFromProducts(): Promise<number> {
  await connectToDatabase();

  const slugs = (await Product.distinct('category')) as string[];
  const existing = new Set(
    (await Category.find({}).select('slug').lean()).map((doc) => doc.slug),
  );

  const missing = slugs.filter((slug) => slug && !existing.has(slug));
  if (!missing.length) return 0;

  await Category.insertMany(
    missing.map((slug, index) => ({
      slug,
      name: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      visible: true,
      sortOrder: index,
    })),
  );

  return missing.length;
}
