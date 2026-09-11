import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db/connection';
import { MAX_STOCK, STOCK_RANGE_ERROR } from '@/lib/inventory/limits';
import { InventoryAdjustment, type AdjustmentReason } from '@/lib/db/models/inventory-adjustment';
import { Order } from '@/lib/db/models/order';
import { Product } from '@/lib/db/models/product';
import { Variant } from '@/lib/db/models/variant';
import { getStoreSettings } from '@/lib/services/settings';
import {
  pageWindow,
  searchRegex,
  toPaged,
  type ListParams,
  type Paged,
} from '@/lib/admin/query';
import type { InventoryAdjustmentDTO, InventoryRowDTO, LowStockRowDTO } from '@/types/dto';

/** Re-exported so callers reaching for the service get the bound too. */
export { MAX_STOCK } from '@/lib/inventory/limits';

export class InsufficientStockError extends Error {
  constructor(
    readonly sku: string,
    readonly available: number,
    readonly wanted: number,
  ) {
    super(`Only ${available} of ${sku} left, and ${wanted} were requested`);
    this.name = 'InsufficientStockError';
  }
}

export class VariantNotFoundError extends Error {
  constructor(id: string) {
    super(`No variant with id ${id}`);
    this.name = 'VariantNotFoundError';
  }
}

export type Actor = { id: string; email: string };

const SYSTEM: Actor = { id: '', email: 'system' };

export type AdjustInput = {
  variantId: string;
  /** Signed. Negative takes stock away. */
  delta: number;
  reason: AdjustmentReason;
  note?: string;
  actor?: Actor;
  orderId?: string | null;
};

/**
 * The single door every stock movement goes through.
 *
 * The update is one `findOneAndUpdate` with the guard *inside the filter*:
 * for a decrease, the document only matches while it still holds enough. Two
 * requests racing for the last unit therefore cannot both match — Mongo
 * applies single-document updates atomically, so the loser matches nothing
 * and is told the truth instead of driving stock negative.
 *
 * Read-then-write would be the obvious shape here and would be wrong: between
 * the read and the write, the other request has already spent the stock.
 */
export async function adjustStock(input: AdjustInput): Promise<number> {
  const { variantId, delta, reason } = input;
  const actor = input.actor ?? SYSTEM;

  if (!Types.ObjectId.isValid(variantId)) throw new VariantNotFoundError(variantId);
  if (!Number.isSafeInteger(delta)) throw new Error(STOCK_RANGE_ERROR);
  if (Math.abs(delta) > MAX_STOCK) throw new Error(STOCK_RANGE_ERROR);
  if (delta === 0) {
    const current = await Variant.findById(variantId).select('stock').lean();
    if (!current) throw new VariantNotFoundError(variantId);
    return current.stock;
  }

  await connectToDatabase();

  const filter: Record<string, unknown> = { _id: new Types.ObjectId(variantId) };
  // Overselling is not supported: the floor is zero and the filter enforces it.
  if (delta < 0) filter.stock = { $gte: -delta };
  // And the ceiling is enforced in the same breath, for the same reason it is
  // a filter rather than a check: a concurrent adjustment must not be able to
  // carry the total over the top between the read and the write.
  if (delta > 0) filter.stock = { $lte: MAX_STOCK - delta };

  const updated = await Variant.findOneAndUpdate(
    filter,
    { $inc: { stock: delta } },
    { returnDocument: 'after' },
  ).lean();

  if (!updated) {
    // The variant is gone, there was not enough stock, or this would have
    // taken it over the ceiling. Distinguish them so the caller can say
    // something true.
    const existing = await Variant.findById(variantId).select('sku stock').lean();
    if (!existing) throw new VariantNotFoundError(variantId);

    if (delta > 0) {
      throw new Error(
        `${existing.sku} would go past ${MAX_STOCK.toLocaleString('en-US')} units. ` +
          'Check the figure — that is a warehouse, not a shelf.',
      );
    }

    throw new InsufficientStockError(existing.sku, existing.stock, -delta);
  }

  // The ledger is written after the fact, deliberately. A failed ledger write
  // must never roll back a successful stock movement — the stock level is the
  // truth customers experience, and a missing history row is a smaller problem
  // than a phantom unit.
  await InventoryAdjustment.create({
    variantId: updated._id,
    productId: updated.productId,
    sku: updated.sku,
    delta,
    resultingStock: updated.stock,
    reason,
    note: input.note ?? '',
    actorId: actor.id,
    actorEmail: actor.email,
    orderId: input.orderId && Types.ObjectId.isValid(input.orderId)
      ? new Types.ObjectId(input.orderId)
      : null,
  });

  return updated.stock;
}

/**
 * Sets stock to an absolute number.
 *
 * Expressed as a compare-and-set rather than a plain write: the update only
 * applies while stock is still what was read, so a sale landing mid-edit is
 * not silently overwritten by a stale figure from a form. On a collision it
 * re-reads and retries a few times before giving up.
 */
export async function setVariantStock(input: {
  variantId: string;
  stock: number;
  reason?: AdjustmentReason;
  note?: string;
  actor?: Actor;
}): Promise<number> {
  const { variantId, stock } = input;

  if (!Types.ObjectId.isValid(variantId)) throw new VariantNotFoundError(variantId);
  if (!Number.isInteger(stock) || stock < 0) {
    throw new Error('Stock has to be a whole number of units, and cannot be negative');
  }
  // Checked after the sign, so a figure that is merely too large is told it is
  // too large rather than being accused of being negative.
  if (!Number.isSafeInteger(stock) || stock > MAX_STOCK) throw new Error(STOCK_RANGE_ERROR);

  await connectToDatabase();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await Variant.findById(variantId).select('stock').lean();
    if (!current) throw new VariantNotFoundError(variantId);

    if (current.stock === stock) return stock;

    const delta = stock - current.stock;

    const applied = await Variant.findOneAndUpdate(
      { _id: new Types.ObjectId(variantId), stock: current.stock },
      { $inc: { stock: delta } },
      { returnDocument: 'after' },
    ).lean();

    if (applied) {
      const actor = input.actor ?? SYSTEM;

      await InventoryAdjustment.create({
        variantId: applied._id,
        productId: applied.productId,
        sku: applied.sku,
        delta,
        resultingStock: applied.stock,
        reason: input.reason ?? 'manual',
        note: input.note ?? '',
        actorId: actor.id,
        actorEmail: actor.email,
        orderId: null,
      });

      return applied.stock;
    }
  }

  throw new Error('Stock kept changing while saving. Reload and try again.');
}

/**
 * The same absolute count, applied to every variant of many products at once.
 *
 * Deliberately built on `setVariantStock` rather than one `updateMany`. A
 * bulk figure is still a stock take: each variant needs its own compare-and-
 * set against the count that was actually there, and its own ledger row, or
 * the day someone sets the whole catalogue to 100 there is no record of what
 * any of it used to be. The store is catalogue-sized — tens of styles, not
 * millions of rows — so the loop is affordable and the history is worth more
 * than the round trips it costs.
 *
 * Variants already sitting at the figure are skipped by `setVariantStock`
 * itself: re-running the same bulk set writes nothing and logs nothing.
 *
 * One variant failing does not abandon the rest. A bulk set that stopped
 * halfway would leave the catalogue in a state nobody asked for and no
 * message could describe; instead every variant is attempted and the count of
 * failures comes back with the result.
 */
export async function setStockForProducts(input: {
  productIds: readonly string[];
  stock: number;
  note?: string;
  actor?: Actor;
}): Promise<{ products: number; variants: number; changed: number; failed: number }> {
  const { stock } = input;

  if (!Number.isInteger(stock) || stock < 0) {
    throw new Error('Stock has to be a whole number of units, and cannot be negative');
  }
  if (!Number.isSafeInteger(stock) || stock > MAX_STOCK) throw new Error(STOCK_RANGE_ERROR);

  const ids = input.productIds
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  if (!ids.length) return { products: 0, variants: 0, changed: 0, failed: 0 };

  await connectToDatabase();

  const variants = await Variant.find({ productId: { $in: ids } })
    .select('_id productId stock')
    .lean();

  let changed = 0;
  let failed = 0;

  for (const variant of variants) {
    try {
      const after = await setVariantStock({
        variantId: String(variant._id),
        stock,
        reason: 'correction',
        note: input.note || 'Bulk stock set',
        actor: input.actor,
      });

      if (after !== variant.stock) changed += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    products: new Set(variants.map((variant) => String(variant.productId))).size,
    variants: variants.length,
    changed,
    failed,
  };
}

/**
 * Takes stock for a whole order, all or nothing.
 *
 * Each line is a separate atomic decrement, so a partial failure is possible
 * mid-flight; the compensating loop puts back exactly what this call took.
 * That is a deliberate choice over a multi-document transaction, which needs a
 * replica set and would make the store unrunnable against a standalone mongod
 * in development. The compensation is safe because it only ever reverses this
 * call's own successful decrements.
 */
export async function commitStockForOrder(
  orderId: string,
  actor: Actor = SYSTEM,
): Promise<void> {
  if (!Types.ObjectId.isValid(orderId)) throw new Error(`Invalid order id: ${orderId}`);

  await connectToDatabase();

  const order = await Order.findById(orderId);
  if (!order) throw new Error(`No order with id ${orderId}`);
  if (order.stockCommittedAt) return; // Already taken; committing twice is not a thing.

  const taken: { variantId: string; quantity: number }[] = [];

  try {
    for (const item of order.items) {
      const variant = await Variant.findOne({ sku: item.sku }).select('_id').lean();
      if (!variant) throw new Error(`No variant for SKU ${item.sku}`);

      await adjustStock({
        variantId: String(variant._id),
        delta: -item.quantity,
        reason: 'order',
        note: `Order ${order.orderNumber}`,
        actor,
        orderId,
      });

      taken.push({ variantId: String(variant._id), quantity: item.quantity });
    }
  } catch (error) {
    for (const undo of taken) {
      await adjustStock({
        variantId: undo.variantId,
        delta: undo.quantity,
        reason: 'correction',
        note: `Rolled back an incomplete commit for order ${order.orderNumber}`,
        actor,
        orderId,
      });
    }

    throw error;
  }

  order.stockCommittedAt = new Date();
  await order.save();
}

/** Puts an order's stock back. Used by cancellations and returns. */
export async function releaseStockForOrder(
  orderId: string,
  reason: AdjustmentReason = 'cancellation',
  actor: Actor = SYSTEM,
): Promise<void> {
  if (!Types.ObjectId.isValid(orderId)) throw new Error(`Invalid order id: ${orderId}`);

  await connectToDatabase();

  const order = await Order.findById(orderId);
  if (!order) throw new Error(`No order with id ${orderId}`);
  if (!order.stockCommittedAt) return; // Nothing was ever taken.

  for (const item of order.items) {
    const variant = await Variant.findOne({ sku: item.sku }).select('_id').lean();
    if (!variant) continue;

    await adjustStock({
      variantId: String(variant._id),
      delta: item.quantity,
      reason,
      note: `Order ${order.orderNumber}`,
      actor,
      orderId,
    });
  }

  order.stockCommittedAt = null;
  await order.save();
}

/** The store-wide fallback, overridable per variant. */
export async function defaultLowStockThreshold(): Promise<number> {
  const settings = await getStoreSettings();
  return settings.lowStockThreshold;
}

export function stockStateFor(
  stock: number,
  threshold: number,
): 'in_stock' | 'low' | 'out' {
  if (stock <= 0) return 'out';
  return stock <= threshold ? 'low' : 'in_stock';
}

export const INVENTORY_SORTS = ['stock', 'sku', 'updatedAt'] as const;
export const INVENTORY_FILTERS = ['state', 'productId'] as const;

/**
 * One page of variants with their stock state.
 *
 * The product titles are fetched for the ids on this page only — never the
 * whole catalogue — which is what keeps this list flat as the store grows.
 */
export async function listInventory(params: ListParams): Promise<Paged<InventoryRowDTO>> {
  await connectToDatabase();

  const threshold = await defaultLowStockThreshold();
  const query: Record<string, unknown> = {};

  const needle = searchRegex(params.q);
  if (needle) query.sku = needle;

  if (params.filters.productId && Types.ObjectId.isValid(params.filters.productId)) {
    query.productId = new Types.ObjectId(params.filters.productId);
  }

  // "Low" has to respect a per-variant override, which a single range query
  // cannot express. $expr compares two fields in the document instead.
  const state = params.filters.state;
  if (state === 'out') {
    query.stock = { $lte: 0 };
  } else if (state === 'low') {
    query.stock = { $gt: 0 };
    query.$expr = {
      $lte: ['$stock', { $ifNull: ['$lowStockThreshold', threshold] }],
    };
  } else if (state === 'in_stock') {
    query.$expr = {
      $gt: ['$stock', { $ifNull: ['$lowStockThreshold', threshold] }],
    };
  }

  const { skip, limit } = pageWindow(params);
  const sortField = params.sort === 'sku' ? 'sku' : params.sort === 'updatedAt' ? 'updatedAt' : 'stock';

  const [total, variants] = await Promise.all([
    Variant.countDocuments(query),
    Variant.find(query)
      .sort({ [sortField]: params.direction === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const products = await Product.find({ _id: { $in: variants.map((v) => v.productId) } })
    .select('title slug')
    .lean();

  const byId = new Map(products.map((product) => [String(product._id), product]));

  const rows: InventoryRowDTO[] = variants.map((variant) => {
    const product = byId.get(String(variant.productId));
    const effective = variant.lowStockThreshold ?? threshold;

    return {
      variantId: String(variant._id),
      productId: String(variant.productId),
      productTitle: product?.title ?? 'Unknown product',
      productSlug: product?.slug ?? '',
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      stock: variant.stock,
      threshold: effective,
      enabled: variant.enabled,
      state: stockStateFor(variant.stock, effective),
    };
  });

  return toPaged(rows, total, params);
}

/** The ledger for one variant, newest first. */
export async function listAdjustments(
  variantId: string,
  params: ListParams,
): Promise<Paged<InventoryAdjustmentDTO>> {
  if (!Types.ObjectId.isValid(variantId)) return toPaged([], 0, params);

  await connectToDatabase();

  const query = { variantId: new Types.ObjectId(variantId) };
  const { skip, limit } = pageWindow(params);

  const [total, rows] = await Promise.all([
    InventoryAdjustment.countDocuments(query),
    InventoryAdjustment.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  return toPaged(
    rows.map((row) => ({
      id: String(row._id),
      variantId: String(row.variantId),
      sku: row.sku,
      delta: row.delta,
      resultingStock: row.resultingStock,
      reason: row.reason,
      note: row.note ?? '',
      actorEmail: row.actorEmail ?? 'system',
      orderId: row.orderId ? String(row.orderId) : null,
      at: ((row as { createdAt?: Date }).createdAt ?? new Date()).toISOString(),
    })),
    total,
    params,
  );
}

/** Counts for the dashboard. Two `countDocuments` calls rather than a scan. */
export async function countStockStates(): Promise<{ low: number; out: number }> {
  await connectToDatabase();

  const threshold = await defaultLowStockThreshold();

  const [out, low] = await Promise.all([
    Variant.countDocuments({ enabled: true, stock: { $lte: 0 } }),
    Variant.countDocuments({
      enabled: true,
      stock: { $gt: 0 },
      $expr: { $lte: ['$stock', { $ifNull: ['$lowStockThreshold', threshold] }] },
    }),
  ]);

  return { low, out };
}

/** The dashboard's short list of what is running out. */
export async function listLowStock(limit = 10): Promise<LowStockRowDTO[]> {
  await connectToDatabase();

  const threshold = await defaultLowStockThreshold();

  const variants = await Variant.find({
    enabled: true,
    $expr: { $lte: ['$stock', { $ifNull: ['$lowStockThreshold', threshold] }] },
  })
    .sort({ stock: 1 })
    .limit(limit)
    .lean();

  const products = await Product.find({ _id: { $in: variants.map((v) => v.productId) } })
    .select('title')
    .lean();

  const titleById = new Map(products.map((product) => [String(product._id), product.title]));

  return variants.map((variant) => ({
    sku: variant.sku,
    title: titleById.get(String(variant.productId)) ?? 'Unknown product',
    size: variant.size,
    color: variant.color,
    stock: variant.stock,
  }));
}
