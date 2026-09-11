import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db/connection';
import { Product, type ProductDoc } from '@/lib/db/models/product';
import { Variant, type VariantDoc } from '@/lib/db/models/variant';
import type { ProductFilter } from '@/lib/validation/catalogue';
import { WHOLESALE_TAG } from '@/lib/wholesale/catalogue';
import type { ProductInput, VariantInput } from '@/lib/validation/product';
import { pageWindow, searchRegex, sortStage, toPaged, type ListParams, type Paged } from '@/lib/admin/query';
import type { AdminProductRowDTO, ProductDTO, VariantDTO } from '@/types/dto';

type WithId<T> = T & { _id: Types.ObjectId };

function toVariantDTO(variant: WithId<VariantDoc>): VariantDTO {
  return {
    id: String(variant._id),
    size: variant.size,
    color: variant.color,
    sku: variant.sku,
    priceCents: variant.priceCents,
    stock: variant.stock,
    inStock: variant.stock > 0,
    enabled: variant.enabled,
    lowStockThreshold: variant.lowStockThreshold ?? null,
    imagePublicId: variant.imagePublicId ?? '',
  };
}

function toProductDTO(product: WithId<ProductDoc>, variants: WithId<VariantDoc>[]): ProductDTO {
  const variantDTOs = variants.map(toVariantDTO);
  const sellable = variantDTOs.filter((v) => v.enabled);

  return {
    id: String(product._id),
    title: product.title,
    slug: product.slug,
    description: product.description,
    category: product.category,
    status: product.status as 'draft' | 'published',
    featured: Boolean(product.featured),
    badge: (product.badge as 'none' | 'new') ?? 'none',
    rating: product.rating ?? 0,
    images: product.images.map((image) => ({
      publicId: image.publicId,
      width: image.width,
      height: image.height,
      alt: image.alt,
      focus: image.focus ?? '',
      zoom: image.zoom ?? 1,
      mobileFocus: image.mobileFocus ?? '',
      ...(image.mobileZoom ? { mobileZoom: image.mobileZoom } : {}),
    })),
    sizes: product.optionSets?.sizes ?? [],
    colors: product.optionSets?.colors ?? [],
    variants: variantDTOs,
    minPriceCents: sellable.length ? Math.min(...sellable.map((v) => v.priceCents)) : 0,
    tags: product.tags ?? [],
    baseSku: product.baseSku ?? '',
    seo: {
      title: product.seo?.title ?? '',
      description: product.seo?.description ?? '',
      keywords: product.seo?.keywords ?? [],
    },
    quantityRule: {
      min: product.quantityRule?.min ?? 1,
      step: product.quantityRule?.step ?? 1,
      max: product.quantityRule?.max ?? null,
    },
    archived: Boolean(product.archivedAt),
  };
}

async function loadVariantsByProduct(productIds: Types.ObjectId[]) {
  const variants = (await Variant.find({ productId: { $in: productIds } }).lean()) as WithId<VariantDoc>[];
  const grouped = new Map<string, WithId<VariantDoc>[]>();

  for (const variant of variants) {
    const key = String(variant.productId);
    grouped.set(key, [...(grouped.get(key) ?? []), variant]);
  }

  return grouped;
}

export async function listPublishedProducts(
  filter: ProductFilter,
  category?: string,
): Promise<ProductDTO[]> {
  await connectToDatabase();

  // Archived products leave the storefront entirely. They keep their
  // documents so old orders and carts still resolve, but nothing lists them.
  //
  // Wholesale styles leave it too, and for a different reason: they are
  // genuinely published — they have to be, or they could not be edited in the
  // product editor — but they are sold by the quote, at a tier, on /wholesale.
  // Letting one onto the retail grid would offer a shopper a single tee at a
  // price that only exists at 150 units.
  const query: Record<string, unknown> = {
    status: 'published',
    archivedAt: null,
    tags: { $ne: WHOLESALE_TAG },
  };
  if (category) query.category = category;

  const products = (await Product.find(query).lean()) as WithId<ProductDoc>[];
  const grouped = await loadVariantsByProduct(products.map((p) => p._id));

  const dtos = products.map((product) =>
    toProductDTO(product, grouped.get(String(product._id)) ?? []),
  );

  // A size or colour filter means "show me what I can actually buy in this",
  // so a variant only counts if it is enabled AND in stock. Matching on
  // existence alone would send shoppers to products that are sold out in the
  // very size they filtered for.
  const needle = filter.q.toLowerCase();

  const matching = dtos.filter((product) => {
    const buyable = product.variants.filter((v) => v.enabled && v.inStock);

    const sizeOk = !filter.sizes.length || buyable.some((v) => filter.sizes.includes(v.size));
    const colorOk = !filter.colors.length || buyable.some((v) => filter.colors.includes(v.color));

    // Search covers what a shopper can see on the tile: the name, the copy,
    // and the colourways — someone searching "charcoal" means a colour.
    const textOk =
      !needle ||
      product.title.toLowerCase().includes(needle) ||
      product.description.toLowerCase().includes(needle) ||
      product.colors.some((color) => color.toLowerCase().includes(needle));

    // Price is compared against what the shopper actually sees on the tile:
    // the cheapest buyable variant, not every variant's price.
    const priceOk =
      (filter.minPrice === null || product.minPriceCents >= filter.minPrice * 100) &&
      (filter.maxPrice === null || product.minPriceCents <= filter.maxPrice * 100);

    return sizeOk && colorOk && textOk && priceOk;
  });

  if (filter.sort === 'price-asc') {
    return matching.sort((a, b) => a.minPriceCents - b.minPriceCents);
  }
  if (filter.sort === 'price-desc') {
    return matching.sort((a, b) => b.minPriceCents - a.minPriceCents);
  }

  // "Newest" has to mean newest. Mongo's natural order is not insertion order
  // and reversing it only looked right while the catalogue was one product.
  const createdAt = new Map(products.map((p) => [String(p._id), timeOf(p)]));
  return matching.sort((a, b) => (createdAt.get(b.id) ?? 0) - (createdAt.get(a.id) ?? 0));
}

/** `timestamps: true` is on the schema but absent from the inferred type. */
function timeOf(doc: unknown, field: 'createdAt' | 'updatedAt' = 'createdAt'): number {
  const value = (doc as Record<string, Date | string | undefined>)[field];
  return value ? new Date(value).getTime() : 0;
}

/**
 * The homepage's "New Arrivals" rail. Real recency, straight off `createdAt` —
 * nothing here is curated.
 */
export async function listNewArrivals(limit = 4): Promise<ProductDTO[]> {
  const all = await listPublishedProducts({ sizes: [], colors: [], sort: 'newest', q: '', minPrice: null, maxPrice: null, gender: null });
  return all.slice(0, limit);
}

/**
 * The homepage's featured rail.
 *
 * Deliberately NOT "best sellers": the store has no sales history to rank by,
 * so this reads the `featured` flag an admin sets in the product editor. If
 * nothing is flagged it falls back to the newest products rather than
 * rendering an empty band.
 */
export async function listFeaturedProducts(limit = 3): Promise<ProductDTO[]> {
  const all = await listPublishedProducts({ sizes: [], colors: [], sort: 'newest', q: '', minPrice: null, maxPrice: null, gender: null });
  const chosen = all.filter((product) => product.featured);

  return (chosen.length ? chosen : all).slice(0, limit);
}

/** Everything published in one category, newest first. Powers the gateways. */
export async function listProductsInCategory(
  category: string,
  limit?: number,
): Promise<ProductDTO[]> {
  const all = await listPublishedProducts(
    { sizes: [], colors: [], sort: 'newest', q: '', minPrice: null, maxPrice: null, gender: null },
    category,
  );
  return typeof limit === 'number' ? all.slice(0, limit) : all;
}

export async function getPublishedProductBySlug(slug: string): Promise<ProductDTO | null> {
  await connectToDatabase();

  // Same exclusion as the grid, and it matters more here: without it a
  // wholesale slug guessed from the line sheet would render a retail product
  // page, complete with an Add to cart button for one unit.
  const product = (await Product.findOne({
    slug,
    status: 'published',
    archivedAt: null,
    tags: { $ne: WHOLESALE_TAG },
  }).lean()) as WithId<ProductDoc> | null;
  if (!product) return null;

  const variants = (await Variant.find({ productId: product._id }).lean()) as WithId<VariantDoc>[];
  return toProductDTO(product, variants);
}

/** Sort keys the admin product list understands. First one is the default. */
export const PRODUCT_SORTS = ['updatedAt', 'createdAt', 'title', 'status'] as const;
export const PRODUCT_FILTERS = ['status', 'category', 'featured', 'archived'] as const;

/**
 * The filter half of the admin product list, on its own.
 *
 * Separate from the list because a bulk edit has to act on exactly the rows an
 * admin is looking at, across every page of them — not on the twenty-five it
 * happens to have fetched. One builder means the scope a bulk edit claims and
 * the scope the list shows can never drift apart.
 */
export function adminProductQuery(
  params: Pick<ListParams, 'q' | 'filters'>,
): Record<string, unknown> {
  // Wholesale styles are products in the database and nowhere else: they are
  // listed, edited and archived under /admin/wholesale, where the pricing
  // ladder they are actually sold on is visible. Leaving them on the retail
  // list would show an admin ten rows whose "From" price belongs to a tier.
  const query: Record<string, unknown> = { tags: { $ne: WHOLESALE_TAG } };

  // Archived is opt-in: an admin looking at "products" means the live ones.
  query.archivedAt = params.filters.archived === 'true' ? { $ne: null } : null;

  if (params.filters.status === 'draft' || params.filters.status === 'published') {
    query.status = params.filters.status;
  }
  if (params.filters.category) query.category = params.filters.category;
  if (params.filters.featured === 'true') query.featured = true;

  const needle = searchRegex(params.q);
  if (needle) {
    query.$or = [{ title: needle }, { slug: needle }, { baseSku: needle }, { tags: needle }];
  }

  return query;
}

/**
 * One page of products, filtered and sorted by the database.
 *
 * The variant roll-up (count, total stock, cheapest price) is a second query
 * scoped to the ids on *this page* — not the whole catalogue — so the cost of
 * the list does not grow with the size of the store.
 */
export async function listProductsForAdmin(
  params: ListParams,
): Promise<Paged<AdminProductRowDTO>> {
  await connectToDatabase();

  const query = adminProductQuery(params);

  const { skip, limit } = pageWindow(params);

  const [total, products] = await Promise.all([
    Product.countDocuments(query),
    Product.find(query)
      .sort(sortStage(params.sort, params.direction))
      .skip(skip)
      .limit(limit)
      .lean() as Promise<WithId<ProductDoc>[]>,
  ]);

  const grouped = await loadVariantsByProduct(products.map((p) => p._id));

  const rows = products.map((product) => {
    const variants = grouped.get(String(product._id)) ?? [];
    const sellable = variants.filter((variant) => variant.enabled);

    return {
      id: String(product._id),
      title: product.title,
      slug: product.slug,
      category: product.category,
      status: product.status as 'draft' | 'published',
      featured: Boolean(product.featured),
      archived: Boolean(product.archivedAt),
      imagePublicId: product.images[0]?.publicId ?? '',
      variantCount: variants.length,
      totalStock: variants.reduce((sum, variant) => sum + variant.stock, 0),
      minPriceCents: sellable.length ? Math.min(...sellable.map((v) => v.priceCents)) : 0,
      updatedAt: new Date(timeOf(product, 'updatedAt') || timeOf(product) || Date.now()).toISOString(),
    };
  });

  return toPaged(rows, total, params);
}

/**
 * Just the ids the admin list would show, every page of it.
 *
 * The list itself never needs this — it works a page at a time — but a bulk
 * edit does, and it has to be the same set. Ids only: a bulk stock set has no
 * use for the rest of the document and the catalogue can be swept cheaply
 * while it stays a projection.
 */
export async function listAdminProductIds(
  params: Pick<ListParams, 'q' | 'filters'>,
): Promise<string[]> {
  await connectToDatabase();

  const products = await Product.find(adminProductQuery(params)).select('_id').lean();
  return products.map((product) => String(product._id));
}

export async function getProductForAdmin(id: string): Promise<ProductDTO | null> {
  if (!Types.ObjectId.isValid(id)) return null;

  await connectToDatabase();

  const product = (await Product.findById(id).lean()) as WithId<ProductDoc> | null;
  if (!product) return null;

  const variants = (await Variant.find({ productId: product._id }).lean()) as WithId<VariantDoc>[];
  return toProductDTO(product, variants);
}

export class SlugTakenError extends Error {
  constructor(slug: string) {
    super(`Another product already uses the slug "${slug}"`);
    this.name = 'SlugTakenError';
  }
}

export class SkuTakenError extends Error {
  constructor(sku: string) {
    super(`The SKU "${sku}" is already used by another variant`);
    this.name = 'SkuTakenError';
  }
}

export class ProductNotFoundError extends Error {
  constructor(id: string) {
    super(`No product with id ${id}`);
    this.name = 'ProductNotFoundError';
  }
}

export type SaveActor = { id: string; email: string };

/** Every SKU in the payload has to be unique among themselves and free of any
 *  variant belonging to another product. The unique index is the real guard;
 *  this turns a driver-level duplicate-key crash into a message that names the
 *  offending SKU. */
async function assertSkusAreFree(
  skus: string[],
  productId: Types.ObjectId | null,
): Promise<void> {
  const seen = new Set<string>();
  for (const sku of skus) {
    if (seen.has(sku)) throw new SkuTakenError(sku);
    seen.add(sku);
  }

  if (!skus.length) return;

  const clashes = await Variant.find({
    sku: { $in: skus },
    ...(productId ? { productId: { $ne: productId } } : {}),
  })
    .select('sku')
    .lean();

  if (clashes.length) throw new SkuTakenError(clashes[0].sku);
}

/**
 * Creates or updates a product and reconciles its variants.
 *
 * Two rules that look like details and are not:
 *
 * Variants are upserted by (productId, size, color) and never deleted. Carts
 * hold variant ids and past orders were priced from them, so removing a row
 * would rewrite history; a combination that leaves the option sets is disabled
 * instead.
 *
 * Stock is *not* written here. A quantity typed into the product form is a
 * stock correction like any other, so it goes through the inventory service,
 * which takes the lock, refuses to go negative, and records who did it. The
 * editor is not a back door around the ledger.
 */
export async function saveProduct(
  input: Omit<
    ProductInput,
    | 'images'
    | 'featured'
    | 'badge'
    | 'rating'
    | 'tags'
    | 'baseSku'
    | 'seo'
    | 'quantityRule'
    | 'variants'
  > & {
    variants: (Omit<VariantInput, 'lowStockThreshold' | 'imagePublicId'> & {
      lowStockThreshold?: number | null;
      imagePublicId?: string;
    })[];
    featured?: boolean;
    badge?: 'none' | 'new';
    rating?: number;
    tags?: string[];
    baseSku?: string;
    seo?: { title: string; description: string; keywords: string[] };
    quantityRule?: { min: number; step: number; max: number | null };
    /* The crop is optional here and defaulted by the schema, so a caller that
       predates it — a seed, a test, an import — still type-checks and still
       gets an uncropped image rather than an invalid one. */
    images: (Omit<
      ProductInput['images'][number],
      'focus' | 'zoom' | 'mobileFocus' | 'mobileZoom'
    > & {
      focus?: string;
      zoom?: number;
      mobileFocus?: string;
      mobileZoom?: number;
    })[];
    id?: string;
  },
  actor: SaveActor = { id: '', email: 'system' },
): Promise<string> {
  await connectToDatabase();

  if (input.id && !Types.ObjectId.isValid(input.id)) throw new ProductNotFoundError(input.id);

  const clash = await Product.findOne({ slug: input.slug }).select('_id').lean();
  if (clash && (!input.id || String(clash._id) !== input.id)) {
    throw new SlugTakenError(input.slug);
  }

  await assertSkusAreFree(
    input.variants.map((variant) => variant.sku),
    input.id ? new Types.ObjectId(input.id) : null,
  );

  const fields = {
    title: input.title,
    slug: input.slug,
    description: input.description,
    category: input.category,
    status: input.status,
    featured: input.featured ?? false,
    badge: input.badge ?? 'none',
    rating: input.rating ?? 0,
    tags: input.tags ?? [],
    baseSku: input.baseSku ?? '',
    seo: input.seo ?? { title: '', description: '', keywords: [] },
    quantityRule: input.quantityRule ?? { min: 1, step: 1, max: null },
    images: input.images,
    optionSets: { sizes: input.sizes, colors: input.colors },
  };

  const product = input.id
    ? await Product.findByIdAndUpdate(input.id, { $set: fields }, { returnDocument: 'after' })
    : await Product.create(fields);

  if (!product) throw new ProductNotFoundError(input.id ?? '');

  const { setVariantStock } = await import('@/lib/services/inventory');

  for (const variant of input.variants) {
    const saved = await Variant.findOneAndUpdate(
      { productId: product._id, size: variant.size, color: variant.color },
      {
        $set: {
          sku: variant.sku,
          priceCents: variant.priceCents,
          enabled: variant.enabled,
          lowStockThreshold: variant.lowStockThreshold ?? null,
          imagePublicId: variant.imagePublicId ?? '',
        },
        // Only ever an initial value. Existing rows keep the ledger's number.
        $setOnInsert: { stock: 0 },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );

    if (saved && saved.stock !== variant.stock) {
      await setVariantStock({
        variantId: String(saved._id),
        stock: variant.stock,
        reason: 'correction',
        note: 'Set from the product editor',
        actor,
      });
    }
  }

  return String(product._id);
}

/**
 * Takes a product off the storefront without destroying it.
 *
 * A hard delete is never offered: variant ids live in carts and every past
 * order was priced from a variant that belongs to a product. Archiving keeps
 * those references resolvable while removing the product from every list a
 * shopper or an admin sees by default.
 */
export async function archiveProduct(id: string, archived: boolean): Promise<void> {
  if (!Types.ObjectId.isValid(id)) throw new ProductNotFoundError(id);

  await connectToDatabase();

  const update = archived
    ? { $set: { archivedAt: new Date(), status: 'draft' as const } }
    : { $set: { archivedAt: null } };

  const product = await Product.findByIdAndUpdate(id, update);
  if (!product) throw new ProductNotFoundError(id);
}

/** Publish or unpublish. Archived products cannot be published — they would
 *  reappear on the storefront with no obvious cause. */
export async function setProductStatus(
  id: string,
  status: 'draft' | 'published',
): Promise<void> {
  if (!Types.ObjectId.isValid(id)) throw new ProductNotFoundError(id);

  await connectToDatabase();

  const product = await Product.findById(id).select('archivedAt').lean();
  if (!product) throw new ProductNotFoundError(id);

  if (product.archivedAt && status === 'published') {
    throw new Error('Restore this product before publishing it.');
  }

  await Product.updateOne({ _id: id }, { $set: { status } });
}

/** Every distinct category slug in use, for the admin filter. */
export async function listUsedCategorySlugs(): Promise<string[]> {
  await connectToDatabase();
  const slugs = await Product.distinct('category', { archivedAt: null });
  return (slugs as string[]).filter(Boolean).sort();
}

/** Values already typed into these fields elsewhere in the catalogue, so the
 *  editor can offer them back instead of the admin retyping them. Purely
 *  suggestions — a `<datalist>` never overwrites what's typed. */
export async function getProductFieldSuggestions(): Promise<{
  categories: string[];
  tags: string[];
  sizes: string[];
  colors: string[];
}> {
  await connectToDatabase();

  const [categories, tags, sizes, colors] = await Promise.all([
    Product.distinct('category', { archivedAt: null }),
    Product.distinct('tags', { archivedAt: null }),
    Product.distinct('optionSets.sizes', { archivedAt: null }),
    Product.distinct('optionSets.colors', { archivedAt: null }),
  ]);

  const clean = (values: unknown[]) => (values as string[]).filter(Boolean).sort();

  return {
    categories: clean(categories),
    tags: clean(tags),
    sizes: clean(sizes),
    colors: clean(colors),
  };
}

/** The next free `base-copy`, `base-copy-2`, … slug. */
async function uniqueSlug(base: string): Promise<string> {
  let candidate = `${base}-copy`;
  let n = 2;
  while (await Product.exists({ slug: candidate })) {
    candidate = `${base}-copy-${n}`;
    n += 1;
  }
  return candidate;
}

/** The next free `BASE-COPY`, `BASE-COPY-2`, … SKU. SKUs are unique across the
 *  whole catalogue, so a duplicated variant can never keep the original's. */
async function uniqueSku(base: string): Promise<string> {
  let candidate = `${base}-COPY`;
  let n = 2;
  while (await Variant.exists({ sku: candidate })) {
    candidate = `${base}-COPY-${n}`;
    n += 1;
  }
  return candidate;
}

/**
 * Copies a product's fields, images and variants into a new, independent
 * document. The original is untouched.
 *
 * Images are copied by reference — the same Cloudinary public ids — so
 * nothing is re-uploaded. Slug and every variant SKU are regenerated because
 * both are unique across the catalogue. The copy starts as a draft, unfeatured
 * and with zero stock: an identical listing silently going live, or claiming
 * stock that only the original variant actually has, is worse than an admin
 * publishing and restocking it on purpose.
 */
export async function duplicateProduct(id: string): Promise<string> {
  if (!Types.ObjectId.isValid(id)) throw new ProductNotFoundError(id);

  await connectToDatabase();

  const source = (await Product.findById(id).lean()) as WithId<ProductDoc> | null;
  if (!source) throw new ProductNotFoundError(id);

  const variants = (await Variant.find({ productId: source._id }).lean()) as WithId<VariantDoc>[];

  const slug = await uniqueSlug(source.slug);

  const copy = await Product.create({
    title: `${source.title} (copy)`,
    slug,
    description: source.description,
    category: source.category,
    status: 'draft',
    featured: false,
    badge: source.badge,
    rating: source.rating,
    tags: source.tags,
    baseSku: source.baseSku,
    seo: source.seo,
    quantityRule: source.quantityRule,
    images: source.images,
    optionSets: source.optionSets,
  });

  for (const variant of variants) {
    const sku = await uniqueSku(variant.sku);
    await Variant.create({
      productId: copy._id,
      size: variant.size,
      color: variant.color,
      sku,
      priceCents: variant.priceCents,
      stock: 0,
      lowStockThreshold: variant.lowStockThreshold,
      imagePublicId: variant.imagePublicId,
      enabled: variant.enabled,
    });
  }

  return String(copy._id);
}

/** How many live products sit in a category. The category service asks before
 *  allowing an archive. */
export async function countProductsInCategory(slug: string): Promise<number> {
  await connectToDatabase();
  return Product.countDocuments({ category: slug, archivedAt: null });
}

/** Moves every product from one category slug to another. Used when a category
 *  is renamed, so no product is left pointing at a slug that no longer
 *  resolves. */
export async function reassignCategory(from: string, to: string): Promise<number> {
  await connectToDatabase();
  const result = await Product.updateMany({ category: from }, { $set: { category: to } });
  return result.modifiedCount ?? 0;
}
