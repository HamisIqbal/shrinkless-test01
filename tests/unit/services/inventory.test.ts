import { describe, expect, it } from 'vitest';
import { InventoryAdjustment } from '@/lib/db/models/inventory-adjustment';
import { Order } from '@/lib/db/models/order';
import { Product } from '@/lib/db/models/product';
import { Variant } from '@/lib/db/models/variant';
import {
  InsufficientStockError,
  VariantNotFoundError,
  MAX_STOCK,
  adjustStock,
  commitStockForOrder,
  countStockStates,
  listInventory,
  listLowStock,
  releaseStockForOrder,
  setStockForProducts,
  setVariantStock,
  stockStateFor,
} from '@/lib/services/inventory';
import { INVENTORY_FILTERS, INVENTORY_SORTS } from '@/lib/services/inventory';
import { parseListParams } from '@/lib/admin/query';
import { withTestDatabase } from '@/tests/setup/db';
import type { OrderStatus } from '@/types/dto';

withTestDatabase();

const ACTOR = { id: 'u1', email: 'admin@example.com' };

function params(raw: Record<string, string> = {}) {
  return parseListParams(raw, { sorts: INVENTORY_SORTS, filters: INVENTORY_FILTERS });
}

async function seedVariant(stock = 10, overrides: Record<string, unknown> = {}) {
  const product = await Product.create({
    title: 'Field Tee',
    slug: `field-tee-${Math.random().toString(36).slice(2, 8)}`,
    category: 'tees',
  });

  const variant = await Variant.create({
    productId: product._id,
    size: 's',
    color: 'sand',
    sku: `SKU-${Math.random().toString(36).slice(2, 8)}`.toUpperCase(),
    priceCents: 4200,
    stock,
    ...overrides,
  });

  return { product, variant };
}

async function seedOrder(
  sku: string,
  quantity: number,
  status: OrderStatus = 'pending',
) {
  return Order.create({
    orderNumber: `SL-${Math.random().toString(36).slice(2, 8)}`,
    email: 'buyer@example.com',
    items: [
      { title: 'Field Tee', size: 's', color: 'sand', sku, unitPriceCents: 4200, quantity },
    ],
    shippingAddress: {
      name: 'A', line1: '1', city: 'Austin', state: 'TX', postalCode: '78701', country: 'US',
    },
    subtotalCents: 4200 * quantity,
    shippingCents: 0,
    taxCents: 0,
    totalCents: 4200 * quantity,
    status,
  });
}

describe('setStockForProducts', () => {
  async function seedProductWithVariants(stocks: number[]) {
    const product = await Product.create({
      title: 'Field Tee',
      slug: `field-tee-${Math.random().toString(36).slice(2, 8)}`,
      category: 'tees',
    });

    for (const [index, stock] of stocks.entries()) {
      await Variant.create({
        productId: product._id,
        size: ['s', 'm', 'l'][index] ?? 'xl',
        color: 'sand',
        sku: `SKU-${Math.random().toString(36).slice(2, 8)}`.toUpperCase(),
        priceCents: 4200,
        stock,
      });
    }

    return product;
  }

  it('sets every variant of every product named to the same count', async () => {
    const first = await seedProductWithVariants([1, 2]);
    const second = await seedProductWithVariants([7]);
    const untouched = await seedProductWithVariants([9]);

    const result = await setStockForProducts({
      productIds: [String(first._id), String(second._id)],
      stock: 100,
      actor: ACTOR,
    });

    expect(result).toEqual({ products: 2, variants: 3, changed: 3, failed: 0 });

    const changed = await Variant.find({
      productId: { $in: [first._id, second._id] },
    }).lean();
    expect(changed.map((variant) => variant.stock)).toEqual([100, 100, 100]);

    const others = await Variant.find({ productId: untouched._id }).lean();
    expect(others[0]?.stock).toBe(9);
  });

  it('writes one ledger row per variant it moved, naming the actor', async () => {
    const product = await seedProductWithVariants([1, 5]);

    await setStockForProducts({
      productIds: [String(product._id)],
      stock: 20,
      note: 'Season reset',
      actor: ACTOR,
    });

    const entries = await InventoryAdjustment.find({ productId: product._id }).lean();
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.resultingStock)).toEqual([20, 20]);
    expect(entries.map((entry) => entry.delta).sort((a, b) => a - b)).toEqual([15, 19]);
    expect(entries[0]).toMatchObject({
      reason: 'correction',
      note: 'Season reset',
      actorEmail: 'admin@example.com',
    });
  });

  it('leaves variants already at the figure alone, and logs nothing for them', async () => {
    const product = await seedProductWithVariants([12, 3]);

    const result = await setStockForProducts({
      productIds: [String(product._id)],
      stock: 12,
      actor: ACTOR,
    });

    expect(result).toMatchObject({ variants: 2, changed: 1 });
    expect(await InventoryAdjustment.countDocuments({})).toBe(1);
  });

  it('takes zero as a figure, which empties the list', async () => {
    const product = await seedProductWithVariants([4, 6]);

    await setStockForProducts({ productIds: [String(product._id)], stock: 0, actor: ACTOR });

    const variants = await Variant.find({ productId: product._id }).lean();
    expect(variants.map((variant) => variant.stock)).toEqual([0, 0]);
  });

  it('refuses a figure that is negative or past the ceiling, before touching anything', async () => {
    const product = await seedProductWithVariants([4]);
    const ids = [String(product._id)];

    await expect(setStockForProducts({ productIds: ids, stock: -1 })).rejects.toThrow();
    await expect(
      setStockForProducts({ productIds: ids, stock: MAX_STOCK + 1 }),
    ).rejects.toThrow();

    const variants = await Variant.find({ productId: product._id }).lean();
    expect(variants[0]?.stock).toBe(4);
  });

  it('does nothing at all when the list is empty', async () => {
    expect(await setStockForProducts({ productIds: [], stock: 50 })).toEqual({
      products: 0,
      variants: 0,
      changed: 0,
      failed: 0,
    });
  });

  it('ignores an id that is not a product id rather than failing the run', async () => {
    const product = await seedProductWithVariants([2]);

    const result = await setStockForProducts({
      productIds: ['not-an-id', String(product._id)],
      stock: 8,
      actor: ACTOR,
    });

    expect(result).toMatchObject({ products: 1, variants: 1, changed: 1, failed: 0 });
  });
});

describe('adjustStock', () => {
  it('adds stock and records who did it and why', async () => {
    const { variant } = await seedVariant(5);

    const stock = await adjustStock({
      variantId: String(variant._id),
      delta: 7,
      reason: 'restock',
      note: 'Delivery',
      actor: ACTOR,
    });

    expect(stock).toBe(12);

    const [entry] = await InventoryAdjustment.find({ variantId: variant._id }).lean();
    expect(entry).toMatchObject({
      delta: 7,
      resultingStock: 12,
      reason: 'restock',
      actorEmail: 'admin@example.com',
      note: 'Delivery',
    });
  });

  it('refuses to take more than there is, and leaves stock untouched', async () => {
    const { variant } = await seedVariant(3);

    await expect(
      adjustStock({ variantId: String(variant._id), delta: -4, reason: 'order' }),
    ).rejects.toBeInstanceOf(InsufficientStockError);

    const after = await Variant.findById(variant._id).lean();
    expect(after?.stock).toBe(3);
    expect(await InventoryAdjustment.countDocuments({})).toBe(0);
  });

  it('lets stock reach exactly zero', async () => {
    const { variant } = await seedVariant(3);

    expect(
      await adjustStock({ variantId: String(variant._id), delta: -3, reason: 'order' }),
    ).toBe(0);
  });

  it('never lets two concurrent takes both win the last units', async () => {
    const { variant } = await seedVariant(5);
    const id = String(variant._id);

    // Both want four of the five. Exactly one can be right.
    const results = await Promise.allSettled([
      adjustStock({ variantId: id, delta: -4, reason: 'order' }),
      adjustStock({ variantId: id, delta: -4, reason: 'order' }),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);

    const after = await Variant.findById(id).lean();
    expect(after?.stock).toBe(1);
  });

  it('rejects an unknown variant', async () => {
    await expect(
      adjustStock({ variantId: '64b7f3c2a1b2c3d4e5f60718', delta: 1, reason: 'manual' }),
    ).rejects.toBeInstanceOf(VariantNotFoundError);
  });
});

describe('the stock ceiling', () => {
  /* `Number.isInteger(1e21)` is true, so an adjustment that size used to be
     applied. Past 2^53 a double no longer holds every whole number, and the
     correction that should undo it computes a delta that rounds to the whole
     figure — asking to set the variant back to 18 sets it to 0. There is no
     way back through the panel, and a mistyped adjustment is the only thing
     needed to get there. */
  it('refuses an adjustment past the point arithmetic still works', async () => {
    const { variant } = await seedVariant(5);

    await expect(
      adjustStock({ variantId: String(variant._id), delta: 1e21, reason: 'correction', actor: ACTOR }),
    ).rejects.toThrow(/whole number of units/);

    expect((await Variant.findById(variant._id).lean())!.stock).toBe(5);
  });

  it('refuses one that would carry a variant over the ceiling', async () => {
    const { variant } = await seedVariant(5);

    await expect(
      adjustStock({
        variantId: String(variant._id),
        delta: MAX_STOCK,
        reason: 'restock',
        actor: ACTOR,
      }),
    ).rejects.toThrow(/would go past/);

    expect((await Variant.findById(variant._id).lean())!.stock).toBe(5);
  });

  it('refuses an absolute figure past it too', async () => {
    const { variant } = await seedVariant(5);

    await expect(
      setVariantStock({ variantId: String(variant._id), stock: MAX_STOCK + 1, actor: ACTOR }),
    ).rejects.toThrow(/no more than/);
  });

  it('still allows a figure a real warehouse might hold', async () => {
    const { variant } = await seedVariant(0);

    expect(
      await setVariantStock({ variantId: String(variant._id), stock: 250_000, actor: ACTOR }),
    ).toBe(250_000);
  });
});

describe('setVariantStock', () => {
  it('records the difference as one movement', async () => {
    const { variant } = await seedVariant(4);

    expect(
      await setVariantStock({ variantId: String(variant._id), stock: 10, actor: ACTOR }),
    ).toBe(10);

    const [entry] = await InventoryAdjustment.find({ variantId: variant._id }).lean();
    expect(entry).toMatchObject({ delta: 6, resultingStock: 10 });
  });

  it('writes nothing when the count already matches', async () => {
    const { variant } = await seedVariant(4);

    await setVariantStock({ variantId: String(variant._id), stock: 4, actor: ACTOR });

    expect(await InventoryAdjustment.countDocuments({})).toBe(0);
  });

  it('refuses a negative count', async () => {
    const { variant } = await seedVariant(4);

    await expect(
      setVariantStock({ variantId: String(variant._id), stock: -1 }),
    ).rejects.toThrow(/cannot be negative/);
  });
});

describe('commitStockForOrder', () => {
  it('takes every line and marks the order committed', async () => {
    const { variant } = await seedVariant(10);
    const order = await seedOrder(variant.sku, 3);

    await commitStockForOrder(String(order._id), ACTOR);

    expect((await Variant.findById(variant._id).lean())?.stock).toBe(7);
    expect((await Order.findById(order._id).lean())?.stockCommittedAt).toBeTruthy();
  });

  it('is a no-op the second time, so a retry cannot double-count', async () => {
    const { variant } = await seedVariant(10);
    const order = await seedOrder(variant.sku, 3);

    await commitStockForOrder(String(order._id), ACTOR);
    await commitStockForOrder(String(order._id), ACTOR);

    expect((await Variant.findById(variant._id).lean())?.stock).toBe(7);
  });

  it('puts back everything it took when a later line cannot be filled', async () => {
    const first = await seedVariant(10);
    const second = await seedVariant(1);

    const order = await Order.create({
      orderNumber: 'SL-ROLLBACK',
      email: 'buyer@example.com',
      items: [
        { title: 'A', size: 's', color: 'sand', sku: first.variant.sku, unitPriceCents: 100, quantity: 2 },
        { title: 'B', size: 's', color: 'sand', sku: second.variant.sku, unitPriceCents: 100, quantity: 5 },
      ],
      shippingAddress: {
        name: 'A', line1: '1', city: 'Austin', state: 'TX', postalCode: '78701', country: 'US',
      },
      subtotalCents: 700, shippingCents: 0, taxCents: 0, totalCents: 700, status: 'pending',
    });

    await expect(commitStockForOrder(String(order._id), ACTOR)).rejects.toBeInstanceOf(
      InsufficientStockError,
    );

    // The first line's units are back where they started.
    expect((await Variant.findById(first.variant._id).lean())?.stock).toBe(10);
    expect((await Order.findById(order._id).lean())?.stockCommittedAt).toBeFalsy();
  });
});

describe('releaseStockForOrder', () => {
  it('gives committed stock back exactly once', async () => {
    const { variant } = await seedVariant(10);
    const order = await seedOrder(variant.sku, 4);

    await commitStockForOrder(String(order._id), ACTOR);
    await releaseStockForOrder(String(order._id), 'cancellation', ACTOR);
    await releaseStockForOrder(String(order._id), 'cancellation', ACTOR);

    expect((await Variant.findById(variant._id).lean())?.stock).toBe(10);
  });

  it('does nothing for an order whose stock was never taken', async () => {
    const { variant } = await seedVariant(10);
    const order = await seedOrder(variant.sku, 4);

    await releaseStockForOrder(String(order._id), 'cancellation', ACTOR);

    expect((await Variant.findById(variant._id).lean())?.stock).toBe(10);
  });
});

describe('stock state', () => {
  it('classifies against the threshold', () => {
    expect(stockStateFor(0, 3)).toBe('out');
    expect(stockStateFor(3, 3)).toBe('low');
    expect(stockStateFor(4, 3)).toBe('in_stock');
  });

  it('honours a per-variant override when counting and listing', async () => {
    await seedVariant(5, { lowStockThreshold: 10 });
    await seedVariant(5);

    const counts = await countStockStates();
    const low = await listLowStock();

    expect(counts.low).toBe(1);
    expect(low).toHaveLength(1);
  });

  it('filters the inventory list by state', async () => {
    await seedVariant(0);
    await seedVariant(2);
    await seedVariant(50);

    const out = await listInventory(params({ state: 'out' }));
    const lowOnes = await listInventory(params({ state: 'low' }));
    const healthy = await listInventory(params({ state: 'in_stock' }));

    expect(out.total).toBe(1);
    expect(lowOnes.total).toBe(1);
    expect(healthy.total).toBe(1);
  });
});
