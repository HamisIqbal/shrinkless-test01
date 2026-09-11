'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Types } from 'mongoose';
import { adminAction } from '@/lib/admin/action';
import { ADJUSTMENT_REASONS } from '@/lib/db/models/inventory-adjustment';
import { Variant } from '@/lib/db/models/variant';
import { connectToDatabase } from '@/lib/db/connection';
import {
  InsufficientStockError,
  VariantNotFoundError,
  adjustStock,
  setStockForProducts,
  setVariantStock,
} from '@/lib/services/inventory';
import { listAdminProductIds } from '@/lib/services/products';
import { listWholesaleProductIds } from '@/lib/services/wholesale';
import { MAX_STOCK, STOCK_RANGE_ERROR } from '@/lib/inventory/limits';

function revalidateInventory(): void {
  revalidatePath('/admin/inventory');
  revalidatePath('/admin/products');
  revalidatePath('/admin');
  revalidatePath('/shop');
}

function translate(error: unknown): string | null {
  if (error instanceof InsufficientStockError) return error.message;
  if (error instanceof VariantNotFoundError) return 'That variant no longer exists.';
  return null;
}

/** A manual movement: "+12, restock" or "-1, damage". Reason is required
 *  because a ledger entry that cannot explain itself is barely a record. */
export const adjustStockAction = adminAction(
  {
    permission: 'inventory:write',
    schema: z.object({
      variantId: z.string().min(1),
      delta: z
        .number()
        .int('Adjust by a whole number of units')
        .refine((value) => value !== 0, 'An adjustment of zero changes nothing'),
      reason: z.enum(ADJUSTMENT_REASONS),
      note: z.string().trim().max(200).default(''),
    }),
    translate,
    genericError: 'Could not adjust the stock.',
  },
  async (input, actor) => {
    const stock = await adjustStock({
      variantId: input.variantId,
      delta: input.delta,
      reason: input.reason,
      note: input.note,
      actor: { id: actor.id, email: actor.email },
    });

    revalidateInventory();
    return { stock };
  },
);

/** An absolute count, as after a stock take. */
export const setStockAction = adminAction(
  {
    permission: 'inventory:write',
    schema: z.object({
      variantId: z.string().min(1),
      stock: z.number().int().min(0, 'Stock cannot be negative'),
      note: z.string().trim().max(200).default(''),
    }),
    translate,
    genericError: 'Could not set the stock level.',
  },
  async (input, actor) => {
    const stock = await setVariantStock({
      variantId: input.variantId,
      stock: input.stock,
      reason: 'correction',
      note: input.note || 'Stock take',
      actor: { id: actor.id, email: actor.email },
    });

    revalidateInventory();
    return { stock };
  },
);

/**
 * One count, applied across a whole list.
 *
 * The client sends the list it is looking at — the tab, plus the search and
 * filters in the query string — and the server resolves that back into product
 * ids itself. Sending the ids from the browser would be the obvious shape and
 * would quietly be wrong twice: the page holds only the twenty-five rows it
 * fetched, and a list of ids from a client is a list of anything.
 */
export const setStockForListedAction = adminAction(
  {
    permission: 'inventory:write',
    schema: z.object({
      scope: z.enum(['products', 'wholesale']),
      stock: z
        .number()
        .int('Stock has to be a whole number of units')
        .min(0, 'Stock cannot be negative')
        .max(MAX_STOCK, STOCK_RANGE_ERROR),
      note: z.string().trim().max(200).default(''),
      /** Echoed from the list's own query string; ignored for wholesale,
       *  whose list has no filters of its own. */
      q: z.string().trim().max(100).default(''),
      filters: z.record(z.string(), z.string().max(100)).default({}),
    }),
    translate,
    genericError: 'Could not set the stock levels.',
  },
  async (input, actor) => {
    const productIds =
      input.scope === 'wholesale'
        ? await listWholesaleProductIds()
        : await listAdminProductIds({ q: input.q, filters: input.filters });

    const result = await setStockForProducts({
      productIds,
      stock: input.stock,
      note: input.note || `Set to ${input.stock} across the ${input.scope} list`,
      actor: { id: actor.id, email: actor.email },
    });

    revalidateInventory();
    if (input.scope === 'wholesale') {
      revalidatePath('/admin/wholesale');
      revalidatePath('/wholesale');
    }

    return result;
  },
);

/** Per-variant low-stock threshold. Null hands the variant back to the
 *  store-wide setting. */
export const setLowStockThresholdAction = adminAction(
  {
    permission: 'inventory:write',
    schema: z.object({
      variantId: z.string().min(1),
      threshold: z.number().int().min(0).nullable(),
    }),
    translate,
    genericError: 'Could not update the threshold.',
  },
  async (input) => {
    if (!Types.ObjectId.isValid(input.variantId)) {
      throw new VariantNotFoundError(input.variantId);
    }

    await connectToDatabase();

    const updated = await Variant.findByIdAndUpdate(input.variantId, {
      $set: { lowStockThreshold: input.threshold },
    });

    if (!updated) throw new VariantNotFoundError(input.variantId);

    revalidateInventory();
    return undefined;
  },
);
