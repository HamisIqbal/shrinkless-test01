import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db/connection';
import { Discount, DiscountRedemption } from '@/lib/db/models/discount';
import { Product } from '@/lib/db/models/product';
import {
  pageWindow,
  searchRegex,
  sortStage,
  toPaged,
  type ListParams,
  type Paged,
} from '@/lib/admin/query';
import type { DiscountInput } from '@/lib/validation/discount';
import type { CartLineDTO, DiscountDTO } from '@/types/dto';

export class DiscountCodeTakenError extends Error {
  constructor(code: string) {
    super(`The code "${code}" already exists`);
    this.name = 'DiscountCodeTakenError';
  }
}

export class DiscountNotFoundError extends Error {
  constructor(id: string) {
    super(`No discount with id ${id}`);
    this.name = 'DiscountNotFoundError';
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toDTO(doc: any): DiscountDTO {
  const startsAt = doc.startsAt ? new Date(doc.startsAt) : null;
  const endsAt = doc.endsAt ? new Date(doc.endsAt) : null;
  const now = Date.now();

  const exhausted = doc.usageLimit !== null && doc.usedCount >= doc.usageLimit;
  const inWindow =
    (!startsAt || startsAt.getTime() <= now) && (!endsAt || endsAt.getTime() > now);

  return {
    id: String(doc._id),
    code: doc.code,
    description: doc.description ?? '',
    type: doc.type,
    value: doc.value,
    active: Boolean(doc.active),
    startsAt: startsAt ? startsAt.toISOString() : null,
    endsAt: endsAt ? endsAt.toISOString() : null,
    usageLimit: doc.usageLimit ?? null,
    perCustomerLimit: doc.perCustomerLimit ?? null,
    usedCount: doc.usedCount ?? 0,
    minOrderCents: doc.minOrderCents ?? 0,
    productIds: (doc.productIds ?? []).map((id: unknown) => String(id)),
    categorySlugs: doc.categorySlugs ?? [],
    archived: Boolean(doc.archivedAt),
    redeemable: Boolean(doc.active) && !doc.archivedAt && inWindow && !exhausted,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const DISCOUNT_SORTS = ['createdAt', 'code', 'usedCount', 'endsAt'] as const;
export const DISCOUNT_FILTERS = ['state', 'type'] as const;

export async function listDiscounts(params: ListParams): Promise<Paged<DiscountDTO>> {
  await connectToDatabase();

  const query: Record<string, unknown> = {};
  query.archivedAt = params.filters.state === 'archived' ? { $ne: null } : null;

  if (params.filters.state === 'active') query.active = true;
  if (params.filters.state === 'inactive') query.active = false;
  if (params.filters.type === 'percentage' || params.filters.type === 'fixed') {
    query.type = params.filters.type;
  }

  const needle = searchRegex(params.q);
  if (needle) query.$or = [{ code: needle }, { description: needle }];

  const { skip, limit } = pageWindow(params);

  const [total, docs] = await Promise.all([
    Discount.countDocuments(query),
    Discount.find(query).sort(sortStage(params.sort, params.direction)).skip(skip).limit(limit).lean(),
  ]);

  return toPaged(docs.map(toDTO), total, params);
}

export async function getDiscount(id: string): Promise<DiscountDTO | null> {
  if (!Types.ObjectId.isValid(id)) return null;

  await connectToDatabase();

  const doc = await Discount.findById(id).lean();
  return doc ? toDTO(doc) : null;
}

export async function saveDiscount(input: DiscountInput): Promise<string> {
  await connectToDatabase();

  if (input.id && !Types.ObjectId.isValid(input.id)) throw new DiscountNotFoundError(input.id);

  const clash = await Discount.findOne({ code: input.code }).select('_id').lean();
  if (clash && (!input.id || String(clash._id) !== input.id)) {
    throw new DiscountCodeTakenError(input.code);
  }

  const fields = {
    code: input.code,
    description: input.description,
    type: input.type,
    value: input.value,
    active: input.active,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    usageLimit: input.usageLimit,
    perCustomerLimit: input.perCustomerLimit,
    minOrderCents: input.minOrderCents,
    productIds: input.productIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id)),
    categorySlugs: input.categorySlugs,
  };

  if (!input.id) {
    const created = await Discount.create(fields);
    return String(created._id);
  }

  // `usedCount` is deliberately absent from `fields`: it is a ledger total,
  // not an editable property, and an edit form must never be able to reset it.
  const updated = await Discount.findByIdAndUpdate(input.id, { $set: fields });
  if (!updated) throw new DiscountNotFoundError(input.id);

  return input.id;
}

export async function archiveDiscount(id: string, archived: boolean): Promise<void> {
  if (!Types.ObjectId.isValid(id)) throw new DiscountNotFoundError(id);

  await connectToDatabase();

  const updated = await Discount.findByIdAndUpdate(id, {
    $set: { archivedAt: archived ? new Date() : null, ...(archived ? { active: false } : {}) },
  });

  if (!updated) throw new DiscountNotFoundError(id);
}

export type DiscountRefusal =
  | 'unknown'
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'exhausted'
  | 'customer_limit'
  | 'below_minimum'
  | 'no_eligible_items';

export const REFUSAL_MESSAGES: Record<DiscountRefusal, string> = {
  unknown: 'That code is not recognised.',
  inactive: 'That code is no longer available.',
  not_started: 'That code is not active yet.',
  expired: 'That code has expired.',
  exhausted: 'That code has been fully redeemed.',
  customer_limit: 'You have already used that code.',
  below_minimum: 'Your order does not reach the minimum for that code.',
  no_eligible_items: 'That code does not apply to anything in your cart.',
};

export type DiscountEvaluation =
  | { ok: true; discount: DiscountDTO; amountCents: number; eligibleCents: number }
  | { ok: false; reason: DiscountRefusal; message: string };

/**
 * Decides what a code is worth for a specific cart and a specific customer.
 *
 * This is the only place a discount amount is ever produced. The browser sends
 * a code and nothing else — never an amount, never a percentage, never a
 * pre-computed total. Every check that could refuse the code runs here, in
 * order, and the caller gets either a number this server calculated or a
 * reason it refused.
 */
export async function evaluateDiscount(input: {
  code: string;
  lines: CartLineDTO[];
  /** For per-customer limits. Either identifies the shopper. */
  userId?: string | null;
  email?: string | null;
  now?: Date;
}): Promise<DiscountEvaluation> {
  const now = input.now ?? new Date();
  const code = input.code.trim().toUpperCase();

  if (!code) return { ok: false, reason: 'unknown', message: REFUSAL_MESSAGES.unknown };

  await connectToDatabase();

  const doc = await Discount.findOne({ code, archivedAt: null }).lean();
  if (!doc) return { ok: false, reason: 'unknown', message: REFUSAL_MESSAGES.unknown };

  const discount = toDTO(doc);

  if (!discount.active) return refuse('inactive');
  if (discount.startsAt && new Date(discount.startsAt).getTime() > now.getTime()) {
    return refuse('not_started');
  }
  if (discount.endsAt && new Date(discount.endsAt).getTime() <= now.getTime()) {
    return refuse('expired');
  }
  if (discount.usageLimit !== null && discount.usedCount >= discount.usageLimit) {
    return refuse('exhausted');
  }

  if (discount.perCustomerLimit !== null) {
    const used = await countRedemptionsFor(discount.id, input.userId ?? null, input.email ?? null);
    if (used >= discount.perCustomerLimit) return refuse('customer_limit');
  }

  const eligible = await eligibleLines(discount, input.lines);
  const eligibleCents = eligible.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const subtotalCents = input.lines.reduce((sum, line) => sum + line.lineTotalCents, 0);

  // The minimum is measured against the whole order, not the eligible slice:
  // "spend $80" means spend $80.
  if (subtotalCents < discount.minOrderCents) return refuse('below_minimum');
  if (eligibleCents <= 0) return refuse('no_eligible_items');

  const amountCents = amountFor(discount, eligibleCents);

  return { ok: true, discount, amountCents, eligibleCents };

  function refuse(reason: DiscountRefusal): DiscountEvaluation {
    return { ok: false, reason, message: REFUSAL_MESSAGES[reason] };
  }
}

/** Rounds down, so a discount can never gain a cent through arithmetic, and
 *  can never exceed what it is discounting. */
export function amountFor(
  discount: Pick<DiscountDTO, 'type' | 'value'>,
  eligibleCents: number,
): number {
  if (eligibleCents <= 0) return 0;

  const raw =
    discount.type === 'percentage'
      ? Math.floor((eligibleCents * discount.value) / 10_000)
      : discount.value;

  return Math.max(0, Math.min(raw, eligibleCents));
}

/** Which cart lines a discount actually applies to. No restrictions means all
 *  of them, which is the common case and costs no query. */
async function eligibleLines(
  discount: DiscountDTO,
  lines: CartLineDTO[],
): Promise<CartLineDTO[]> {
  if (!discount.productIds.length && !discount.categorySlugs.length) return lines;

  // Cart lines carry a product slug, not an id, so resolve the restriction to
  // slugs once rather than per line.
  const query: Record<string, unknown>[] = [];
  if (discount.productIds.length) {
    query.push({ _id: { $in: discount.productIds.map((id) => new Types.ObjectId(id)) } });
  }
  if (discount.categorySlugs.length) {
    query.push({ category: { $in: discount.categorySlugs } });
  }

  const products = await Product.find({ $or: query }).select('slug').lean();
  const allowed = new Set(products.map((product) => product.slug));

  return lines.filter((line) => allowed.has(line.productSlug));
}

async function countRedemptionsFor(
  discountId: string,
  userId: string | null,
  email: string | null,
): Promise<number> {
  const or: Record<string, unknown>[] = [];
  if (userId && Types.ObjectId.isValid(userId)) or.push({ userId: new Types.ObjectId(userId) });
  if (email) or.push({ email: email.trim().toLowerCase() });

  if (!or.length) return 0;

  return DiscountRedemption.countDocuments({
    discountId: new Types.ObjectId(discountId),
    $or: or,
  });
}

/**
 * Records that a code was actually spent, when an order is placed.
 *
 * The unique (discountId, orderId) index makes this idempotent: a retried
 * checkout cannot burn a customer's one allowed use twice, and the counter
 * only moves when a redemption row is genuinely new.
 */
export async function redeemDiscount(input: {
  discountId: string;
  code: string;
  orderId: string;
  email: string;
  userId?: string | null;
  amountCents: number;
}): Promise<void> {
  await connectToDatabase();

  try {
    await DiscountRedemption.create({
      discountId: new Types.ObjectId(input.discountId),
      code: input.code,
      orderId: new Types.ObjectId(input.orderId),
      email: input.email.trim().toLowerCase(),
      userId:
        input.userId && Types.ObjectId.isValid(input.userId)
          ? new Types.ObjectId(input.userId)
          : null,
      amountCents: input.amountCents,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('duplicate key')) return;
    throw error;
  }

  await Discount.updateOne({ _id: input.discountId }, { $inc: { usedCount: 1 } });
}
