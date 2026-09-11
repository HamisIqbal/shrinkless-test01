import { describe, expect, it } from 'vitest';
import { Order } from '@/lib/db/models/order';
import { Product } from '@/lib/db/models/product';
import { Variant } from '@/lib/db/models/variant';
import { InsufficientStockError } from '@/lib/services/inventory';
import {
  InvalidTransitionError,
  ORDER_FILTERS,
  ORDER_SORTS,
  RefundError,
  addOrderNote,
  allowedTransitions,
  canTransition,
  getOrderById,
  listOrdersPaged,
  recordRefund,
  transitionOrder,
} from '@/lib/services/orders';
import { parseListParams } from '@/lib/admin/query';
import { withTestDatabase } from '@/tests/setup/db';
import type { OrderStatus } from '@/types/dto';

withTestDatabase();

const ACTOR = { id: 'u1', email: 'admin@example.com' };

function params(raw: Record<string, string> = {}) {
  return parseListParams(raw, { sorts: ORDER_SORTS, filters: ORDER_FILTERS });
}

async function seedVariant(stock: number, sku: string) {
  const product = await Product.create({
    title: 'Field Tee',
    slug: `field-tee-${sku.toLowerCase()}`,
    category: 'tees',
  });

  return Variant.create({
    productId: product._id,
    size: 's',
    color: 'sand',
    sku,
    priceCents: 4200,
    stock,
  });
}

async function seedOrder(
  sku: string,
  quantity = 1,
  overrides: Record<string, unknown> = {},
) {
  return Order.create({
    orderNumber: `SL-${sku}`,
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
    status: 'pending',
    ...overrides,
  });
}

describe('the lifecycle map', () => {
  it('allows only the documented moves', () => {
    expect(canTransition('pending', 'paid')).toBe(true);
    expect(canTransition('paid', 'shipped')).toBe(true);
    expect(canTransition('shipped', 'delivered')).toBe(true);

    expect(canTransition('pending', 'shipped')).toBe(false);
    expect(canTransition('delivered', 'shipped')).toBe(false);
    expect(canTransition('cancelled', 'paid')).toBe(false);
    expect(canTransition('paid', 'paid')).toBe(false);
  });

  it('reports the same moves it enforces', () => {
    expect(allowedTransitions('pending')).toEqual(['paid', 'cancelled', 'payment_failed']);
    expect(allowedTransitions('delivered')).toEqual([]);
  });
});

describe('transitionOrder', () => {
  it('refuses an impossible move', async () => {
    const variant = await seedVariant(5, 'SKU-A');
    const order = await seedOrder(variant.sku);

    await expect(
      transitionOrder({ id: String(order._id), to: 'delivered', actor: ACTOR.email }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it('takes stock when the order is paid', async () => {
    const variant = await seedVariant(5, 'SKU-B');
    const order = await seedOrder(variant.sku, 2);

    await transitionOrder({ id: String(order._id), to: 'paid', actor: ACTOR.email });

    expect((await Variant.findById(variant._id).lean())?.stock).toBe(3);
  });

  it('will not mark an order paid when the stock is not there', async () => {
    const variant = await seedVariant(1, 'SKU-C');
    const order = await seedOrder(variant.sku, 5);

    await expect(
      transitionOrder({ id: String(order._id), to: 'paid', actor: ACTOR.email }),
    ).rejects.toBeInstanceOf(InsufficientStockError);

    // The order stays where it was rather than claiming units it never got.
    expect((await Order.findById(order._id).lean())?.status).toBe('pending');
  });

  it('gives stock back on cancellation', async () => {
    const variant = await seedVariant(5, 'SKU-D');
    const order = await seedOrder(variant.sku, 2);

    await transitionOrder({ id: String(order._id), to: 'paid', actor: ACTOR.email });
    await transitionOrder({ id: String(order._id), to: 'cancelled', actor: ACTOR.email });

    expect((await Variant.findById(variant._id).lean())?.stock).toBe(5);
  });

  it('takes no stock for an order cancelled before it was paid', async () => {
    const variant = await seedVariant(5, 'SKU-E');
    const order = await seedOrder(variant.sku, 2);

    await transitionOrder({ id: String(order._id), to: 'cancelled', actor: ACTOR.email });

    expect((await Variant.findById(variant._id).lean())?.stock).toBe(5);
  });

  it('records the move, the person and the note', async () => {
    const variant = await seedVariant(5, 'SKU-F');
    const order = await seedOrder(variant.sku);

    await transitionOrder({
      id: String(order._id),
      to: 'paid',
      actor: ACTOR.email,
      note: 'Paid by bank transfer',
    });

    const dto = await getOrderById(String(order._id));
    expect(dto?.statusHistory.at(-1)).toMatchObject({
      status: 'paid',
      actor: ACTOR.email,
      note: 'Paid by bank transfer',
    });
  });
});

describe('recordRefund', () => {
  it('refuses an order that was never paid', async () => {
    const variant = await seedVariant(5, 'SKU-G');
    const order = await seedOrder(variant.sku);

    await expect(
      recordRefund({ id: String(order._id), amountCents: 100, actor: ACTOR }),
    ).rejects.toBeInstanceOf(RefundError);
  });

  it('accumulates, and refuses to exceed the order total', async () => {
    const variant = await seedVariant(5, 'SKU-H');
    const order = await seedOrder(variant.sku, 1);
    await transitionOrder({ id: String(order._id), to: 'paid', actor: ACTOR.email });

    await recordRefund({ id: String(order._id), amountCents: 2000, actor: ACTOR });
    await recordRefund({ id: String(order._id), amountCents: 2000, actor: ACTOR });

    const dto = await getOrderById(String(order._id));
    expect(dto?.refundedCents).toBe(4000);

    await expect(
      recordRefund({ id: String(order._id), amountCents: 1000, actor: ACTOR }),
    ).rejects.toBeInstanceOf(RefundError);
  });

  it('refuses a zero or negative amount', async () => {
    const variant = await seedVariant(5, 'SKU-I');
    const order = await seedOrder(variant.sku);
    await transitionOrder({ id: String(order._id), to: 'paid', actor: ACTOR.email });

    await expect(
      recordRefund({ id: String(order._id), amountCents: 0, actor: ACTOR }),
    ).rejects.toBeInstanceOf(RefundError);
  });
});

describe('notes', () => {
  it('appends, attributed and timestamped', async () => {
    const variant = await seedVariant(5, 'SKU-J');
    const order = await seedOrder(variant.sku);

    await addOrderNote({ id: String(order._id), body: 'Customer called', actor: ACTOR });
    const dto = await addOrderNote({ id: String(order._id), body: 'Reshipped', actor: ACTOR });

    expect(dto.notes).toHaveLength(2);
    expect(dto.notes[0]).toMatchObject({ body: 'Customer called', actorEmail: ACTOR.email });
  });

  it('refuses an empty note', async () => {
    const variant = await seedVariant(5, 'SKU-K');
    const order = await seedOrder(variant.sku);

    await expect(
      addOrderNote({ id: String(order._id), body: '   ', actor: ACTOR }),
    ).rejects.toThrow();
  });
});

describe('listOrdersPaged', () => {
  it('filters by status and searches number, email and SKU', async () => {
    const variant = await seedVariant(20, 'SKU-L');
    await seedOrder(variant.sku, 1);
    await seedOrder('SKU-OTHER', 1, { orderNumber: 'SL-OTHER', status: 'paid' as OrderStatus });

    expect((await listOrdersPaged(params({ status: 'paid' }))).total).toBe(1);
    expect((await listOrdersPaged(params({ q: 'SKU-L' }))).total).toBe(1);
    expect((await listOrdersPaged(params({ q: 'buyer@example.com' }))).total).toBe(2);
  });

  it('pages without loading everything', async () => {
    for (let i = 0; i < 4; i += 1) await seedOrder(`SKU-P${i}`);

    const page = await listOrdersPaged(params({ perPage: '2', page: '2' }));

    expect(page.rows).toHaveLength(2);
    expect(page.total).toBe(4);
    expect(page.pageCount).toBe(2);
  });
});
