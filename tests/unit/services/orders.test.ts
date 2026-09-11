import { describe, expect, it } from 'vitest';
import { Order } from '@/lib/db/models/order';
import {
  InvalidTransitionError, canTransition, getOrderById, listOrders, transitionOrder,
} from '@/lib/services/orders';
import { withTestDatabase } from '@/tests/setup/db';

withTestDatabase();

async function seedOrder(overrides: Record<string, unknown> = {}) {
  return Order.create({
    orderNumber: 'SL-1001',
    email: 'buyer@example.com',
    items: [{
      title: 'Field Tee', size: 's', color: 'sand', sku: 'FIELD-TEE-S-SAND',
      unitPriceCents: 4200, quantity: 2, imagePublicId: 'shrinkless/field-tee',
    }],
    shippingAddress: {
      name: 'A Buyer', line1: '1 Main St', city: 'Austin',
      state: 'TX', postalCode: '78701', country: 'US',
    },
    subtotalCents: 8400, shippingCents: 500, taxCents: 0, totalCents: 8900,
    status: 'paid',
    ...overrides,
  });
}

describe('canTransition', () => {
  it('allows the fulfillment path', () => {
    expect(canTransition('pending', 'paid')).toBe(true);
    expect(canTransition('paid', 'shipped')).toBe(true);
    expect(canTransition('shipped', 'delivered')).toBe(true);
  });

  it('refuses to skip shipping', () => {
    expect(canTransition('paid', 'delivered')).toBe(false);
  });

  it('refuses to move backwards', () => {
    expect(canTransition('shipped', 'paid')).toBe(false);
  });

  it('treats delivered, cancelled and payment_failed as terminal', () => {
    expect(canTransition('delivered', 'shipped')).toBe(false);
    expect(canTransition('cancelled', 'paid')).toBe(false);
    expect(canTransition('payment_failed', 'paid')).toBe(false);
  });

  it('refuses a no-op transition', () => {
    expect(canTransition('paid', 'paid')).toBe(false);
  });
});

describe('listOrders', () => {
  it('summarises orders newest first', async () => {
    await seedOrder({ orderNumber: 'SL-1001' });
    await seedOrder({ orderNumber: 'SL-1002' });

    const rows = await listOrders();

    expect(rows.map((row) => row.orderNumber)).toEqual(['SL-1002', 'SL-1001']);
    expect(rows[0]).toMatchObject({ totalCents: 8900, itemCount: 2, status: 'paid' });
    expect(typeof rows[0].createdAt).toBe('string');
  });

  it('filters by status', async () => {
    await seedOrder({ orderNumber: 'SL-1001', status: 'paid' });
    await seedOrder({ orderNumber: 'SL-1002', status: 'shipped' });

    const rows = await listOrders('shipped');

    expect(rows).toHaveLength(1);
    expect(rows[0].orderNumber).toBe('SL-1002');
  });
});

describe('getOrderById', () => {
  it('returns snapshot items and a serialisable address', async () => {
    const order = await seedOrder();

    const dto = await getOrderById(String(order._id));

    expect(dto?.items[0].sku).toBe('FIELD-TEE-S-SAND');
    expect(dto?.shippingAddress.city).toBe('Austin');
    expect(typeof dto?.createdAt).toBe('string');
  });

  it('returns null for an unknown id', async () => {
    expect(await getOrderById('64b7f3c2a1b2c3d4e5f60718')).toBeNull();
  });

  it('returns null for a malformed id', async () => {
    expect(await getOrderById('nope')).toBeNull();
  });
});

describe('transitionOrder', () => {
  it('marks an order shipped and records the tracking number', async () => {
    const order = await seedOrder();

    const dto = await transitionOrder({
      id: String(order._id), to: 'shipped', actor: 'admin@shrinkless.test', trackingNumber: '1Z999',
    });

    expect(dto.status).toBe('shipped');
    expect(dto.trackingNumber).toBe('1Z999');
  });

  it('appends to the status history with the actor', async () => {
    const order = await seedOrder();

    const dto = await transitionOrder({
      id: String(order._id), to: 'shipped', actor: 'admin@shrinkless.test',
    });

    expect(dto.statusHistory).toHaveLength(1);
    expect(dto.statusHistory[0]).toMatchObject({
      status: 'shipped', actor: 'admin@shrinkless.test',
    });
    expect(typeof dto.statusHistory[0].at).toBe('string');
  });

  it('rejects an illegal transition and leaves the order untouched', async () => {
    const order = await seedOrder();

    await expect(
      transitionOrder({ id: String(order._id), to: 'delivered', actor: 'admin@shrinkless.test' }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);

    const dto = await getOrderById(String(order._id));
    expect(dto?.status).toBe('paid');
    expect(dto?.statusHistory).toHaveLength(0);
  });

  it('throws for an order that does not exist', async () => {
    await expect(
      transitionOrder({ id: '64b7f3c2a1b2c3d4e5f60718', to: 'shipped', actor: 'a@b.c' }),
    ).rejects.toThrow();
  });
});
