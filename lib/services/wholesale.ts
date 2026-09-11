import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db/connection';
import { Product, type ProductDoc } from '@/lib/db/models/product';
import { Variant, type VariantDoc } from '@/lib/db/models/variant';
import { WholesaleEnquiry } from '@/lib/db/models/wholesale-enquiry';
import { WHOLESALE_TAG } from '@/lib/wholesale/catalogue';
import { enquiryTotal, quoteForTier, tierLadder } from '@/lib/wholesale/pricing';
import type { WholesaleEnquiryInput } from '@/lib/validation/wholesale';
import type {
  AdminWholesaleRowDTO,
  ImageDTO,
  WholesaleEnquiryDTO,
  WholesaleProductDTO,
  WholesaleProductDetailDTO,
  VariantDTO,
} from '@/types/dto';

type WithId<T> = T & { _id: Types.ObjectId };

/**
 * A slug that reached the action but is not a wholesale style: a stale tab
 * after a style was pulled, or a hand-edited submission reaching for a retail
 * product. Distinct from a database failure because it is the one error the
 * buyer can do something about.
 */
export class UnknownWholesaleStyleError extends Error {
  constructor(readonly slug: string) {
    super(`No wholesale style is published under the slug "${slug}".`);
    this.name = 'UnknownWholesaleStyleError';
  }
}

/** The query that defines "on the line sheet". Used to list and to price. */
const ON_THE_LINE_SHEET = {
  tags: WHOLESALE_TAG,
  status: 'published',
  archivedAt: null,
} as const;

/**
 * The price the ladder is struck from.
 *
 * The cheapest enabled variant, matching what the retail card would have shown
 * — a style whose XXL costs more must not quote the whole order at the XXL
 * price. Stock is deliberately not consulted: wholesale is made to order, and
 * an empty warehouse says nothing about whether a mill run can be booked.
 */
function retailBasis(variants: readonly VariantDoc[]): number {
  const sellable = variants.filter((variant) => variant.enabled);
  return sellable.length ? Math.min(...sellable.map((variant) => variant.priceCents)) : 0;
}

function toWholesaleDTO(
  product: WithId<ProductDoc>,
  variants: readonly VariantDoc[],
): WholesaleProductDTO {
  const retailCents = retailBasis(variants);
  const frame = product.images[0];

  return {
    id: String(product._id),
    slug: product.slug,
    title: product.title,
    description: product.description ?? '',
    category: product.category,
    image: frame
      ? {
          publicId: frame.publicId,
          width: frame.width,
          height: frame.height,
          alt: frame.alt ?? '',
          focus: frame.focus ?? '',
          zoom: frame.zoom ?? 1,
          mobileFocus: frame.mobileFocus ?? '',
          ...(frame.mobileZoom ? { mobileZoom: frame.mobileZoom } : {}),
        }
      : null,
    colors: product.optionSets?.colors ?? [],
    sizes: product.optionSets?.sizes ?? [],
    retailCents,
    tiers: tierLadder(retailCents),
  };
}

/**
 * The line sheet, in the order it was seeded.
 *
 * Insertion order rather than newest-first: a line sheet is a document, and a
 * buyer who scrolls it twice should find the same style in the same place.
 */
export async function listWholesaleProducts(): Promise<WholesaleProductDTO[]> {
  await connectToDatabase();

  const products = (await Product.find(ON_THE_LINE_SHEET)
    .sort({ createdAt: 1 })
    .lean()) as WithId<ProductDoc>[];

  if (!products.length) return [];

  const variants = (await Variant.find({
    productId: { $in: products.map((product) => product._id) },
  }).lean()) as WithId<VariantDoc>[];

  const grouped = new Map<string, WithId<VariantDoc>[]>();
  for (const variant of variants) {
    const key = String(variant.productId);
    grouped.set(key, [...(grouped.get(key) ?? []), variant]);
  }

  return products.map((product) =>
    toWholesaleDTO(product, grouped.get(String(product._id)) ?? []),
  );
}

/**
 * One style, with everything the line sheet card leaves out.
 *
 * The listing shows a frame, a title and the opening figure; the style's own
 * page has to carry the whole gallery and the full description. Both are built
 * from the same record and the same `ON_THE_LINE_SHEET` query, so a style that
 * has been pulled 404s here rather than staying reachable by its old URL.
 */
export async function getWholesaleProductBySlug(
  slug: string,
): Promise<WholesaleProductDetailDTO | null> {
  await connectToDatabase();

  const product = (await Product.findOne({
    ...ON_THE_LINE_SHEET,
    slug,
  }).lean()) as WithId<ProductDoc> | null;

  if (!product) return null;

  const variants = (await Variant.find({
    productId: product._id,
  }).lean()) as WithId<VariantDoc>[];

  const images: ImageDTO[] = product.images.map((frame) => ({
    publicId: frame.publicId,
    width: frame.width,
    height: frame.height,
    alt: frame.alt ?? '',
    focus: frame.focus ?? '',
    zoom: frame.zoom ?? 1,
    mobileFocus: frame.mobileFocus ?? '',
    ...(frame.mobileZoom ? { mobileZoom: frame.mobileZoom } : {}),
  }));

  const variantDTOs: VariantDTO[] = variants.map((variant) => ({
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
  }));

  return { ...toWholesaleDTO(product, variants), images, variants: variantDTOs };
}

/**
 * Records a quote request.
 *
 * Every line is re-priced here from the style's own retail basis. The browser
 * sent a slug and a tier and nothing else, so the figures that land in the
 * enquiry are the store's figures — a submission cannot name its own price,
 * and cannot ask about a style that is not on the line sheet.
 */
export async function createWholesaleEnquiry(
  input: WholesaleEnquiryInput,
): Promise<WholesaleEnquiryDTO> {
  await connectToDatabase();

  const slugs = input.lines.map((line) => line.slug);

  const products = (await Product.find({
    ...ON_THE_LINE_SHEET,
    slug: { $in: slugs },
  }).lean()) as WithId<ProductDoc>[];

  const bySlug = new Map(products.map((product) => [product.slug, product]));

  for (const slug of slugs) {
    if (!bySlug.has(slug)) throw new UnknownWholesaleStyleError(slug);
  }

  const variants = (await Variant.find({
    productId: { $in: products.map((product) => product._id) },
  }).lean()) as WithId<VariantDoc>[];

  const basisByProduct = new Map<string, VariantDoc[]>();
  for (const variant of variants) {
    const key = String(variant.productId);
    basisByProduct.set(key, [...(basisByProduct.get(key) ?? []), variant]);
  }

  const lines = input.lines.map((line) => {
    // Checked above, before anything was priced.
    const product = bySlug.get(line.slug)!;
    const basis = retailBasis(basisByProduct.get(String(product._id)) ?? []);
    const quote = quoteForTier(basis, line.tier);

    return {
      productId: product._id,
      slug: product.slug,
      title: product.title,
      tier: quote.tier,
      unitPriceCents: quote.unitPriceCents,
      totalCents: quote.totalCents,
    };
  });

  const { units, totalCents } = enquiryTotal(lines);

  const saved = await WholesaleEnquiry.create({
    company: input.company,
    contactName: input.contactName,
    email: input.email,
    phone: input.phone,
    country: input.country,
    message: input.message,
    lines,
    units,
    totalCents,
  });

  return {
    id: String(saved._id),
    company: saved.company,
    contactName: saved.contactName,
    email: saved.email,
    phone: saved.phone ?? '',
    country: saved.country,
    message: saved.message ?? '',
    // The product id is the enquiry's own bookkeeping; the DTO describes what
    // was quoted, which is a title, a quantity and two figures.
    lines: lines.map((line) => ({
      slug: line.slug,
      title: line.title,
      tier: line.tier,
      unitPriceCents: line.unitPriceCents,
      totalCents: line.totalCents,
    })),
    units,
    totalCents,
    status: 'new',
  };
}

/* --------------------------------------------------------------------------
   The admin side of the line sheet
   -------------------------------------------------------------------------- */

/**
 * The ids behind the admin line sheet, in the same scope the table shows —
 * every wholesale style, archived ones included, since the table lists those
 * too. The retail counterpart is `listAdminProductIds`.
 */
export async function listWholesaleProductIds(): Promise<string[]> {
  await connectToDatabase();

  const products = await Product.find({ tags: WHOLESALE_TAG }).select('_id').lean();
  return products.map((product) => String(product._id));
}

/**
 * Every wholesale style, including the ones the buyer cannot see.
 *
 * Deliberately NOT `ON_THE_LINE_SHEET`: that query is what the storefront
 * publishes, and an admin list that used it could not show a style being
 * drafted or one that has been pulled — the two states the editor exists to
 * move a style between. The tag is the only condition, because the tag is what
 * makes a product a wholesale style.
 *
 * Ordered by creation like the public sheet, so the two read the same way.
 */
export async function listWholesaleForAdmin(): Promise<AdminWholesaleRowDTO[]> {
  await connectToDatabase();

  const products = (await Product.find({ tags: WHOLESALE_TAG })
    .sort({ createdAt: 1 })
    .lean()) as WithId<ProductDoc>[];

  if (!products.length) return [];

  const variants = (await Variant.find({
    productId: { $in: products.map((product) => product._id) },
  }).lean()) as WithId<VariantDoc>[];

  const grouped = new Map<string, WithId<VariantDoc>[]>();
  for (const variant of variants) {
    const key = String(variant.productId);
    grouped.set(key, [...(grouped.get(key) ?? []), variant]);
  }

  return products.map((product) => {
    const own = grouped.get(String(product._id)) ?? [];
    const retailCents = retailBasis(own);

    // The same ladder the page prints, so the admin and the buyer are never
    // reading two different arithmetics off the same style.
    const opening = tierLadder(retailCents)[0];
    const frame = product.images[0];

    return {
      id: String(product._id),
      title: product.title,
      slug: product.slug,
      category: product.category,
      status: product.status as 'draft' | 'published',
      archived: Boolean(product.archivedAt),
      imagePublicId: frame?.publicId ?? '',
      image: frame
        ? {
            publicId: frame.publicId,
            width: frame.width,
            height: frame.height,
            alt: frame.alt ?? '',
            focus: frame.focus ?? '',
            zoom: frame.zoom ?? 1,
            mobileFocus: frame.mobileFocus ?? '',
            ...(frame.mobileZoom ? { mobileZoom: frame.mobileZoom } : {}),
          }
        : null,
      variantCount: own.length,
      retailCents,
      openingTier: opening.tier,
      openingUnitCents: opening.unitPriceCents,
      updatedAt: new Date(
        (product as { updatedAt?: Date }).updatedAt?.getTime() ?? Date.now(),
      ).toISOString(),
    };
  });
}

/** True when this product is a wholesale style rather than a retail one. The
 *  editor guards on it so a retail id typed into the wholesale URL 404s
 *  instead of quietly opening the wrong editor. */
export function isWholesaleProduct(tags: readonly string[] | undefined): boolean {
  return Boolean(tags?.includes(WHOLESALE_TAG));
}
