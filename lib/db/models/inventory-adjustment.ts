import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

export const ADJUSTMENT_REASONS = [
  'manual',
  'restock',
  'correction',
  'order',
  'cancellation',
  'return',
  'damage',
] as const;

export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

/**
 * An append-only ledger of every stock movement.
 *
 * `Variant.stock` is the running total; this is how it got there. Without it,
 * "we had twelve of these on Tuesday" is unanswerable, and a miscount is
 * indistinguishable from a theft or a bug.
 *
 * Rows are written by the inventory service *after* the atomic update to the
 * variant, and carry the stock level the update produced — so the ledger can
 * be read back without replaying arithmetic.
 */
const inventoryAdjustmentSchema = new Schema(
  {
    variantId: { type: Schema.Types.ObjectId, ref: 'Variant', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    sku: { type: String, required: true },
    /** Signed. Negative takes stock away. */
    delta: { type: Number, required: true },
    /** What `Variant.stock` read immediately after this movement. */
    resultingStock: { type: Number, required: true, min: 0 },
    reason: { type: String, enum: ADJUSTMENT_REASONS, required: true, index: true },
    note: { type: String, default: '' },
    /** Who did it. 'system' for anything an order caused. */
    actorId: { type: String, default: '' },
    actorEmail: { type: String, default: 'system' },
    /** Set when an order caused the movement, so a stock question can be
     *  traced to the sale that answers it. */
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
  },
  { timestamps: true },
);

inventoryAdjustmentSchema.index({ variantId: 1, createdAt: -1 });

export type InventoryAdjustmentDoc = InferSchemaType<typeof inventoryAdjustmentSchema>;

export const InventoryAdjustment: Model<InventoryAdjustmentDoc> =
  (models.InventoryAdjustment as Model<InventoryAdjustmentDoc>) ??
  model<InventoryAdjustmentDoc>('InventoryAdjustment', inventoryAdjustmentSchema);
