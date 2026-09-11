import type { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { Order } from '@/lib/db/models/order';
import { User } from '@/lib/db/models/user';
import { getCustomerDetail, listCustomers } from '@/lib/services/users';
import { withTestDatabase } from '@/tests/setup/db';
import type { OrderStatus } from '@/types/dto';

withTestDatabase();

async function seedCustomer(email = 'buyer@example.com') {
  return User.create({ email, passwordHash: 'x', name: 'A Buyer', role: 'customer' });
}

async function seedOrder(
  userId: Types.ObjectId,
  orderNumber: string,
  status: OrderStatus,
  totalCents: number,
) {
  return Order.create({
    orderNumber, userId, email: 'buyer@example.com',
    items: [{ title: 'Field Tee', size: 's', color: 'sand', sku: 'S1', unitPriceCents: totalCents, quantity: 1 }],
    shippingAddress: { name: 'A', line1: '1', city: 'Austin', state: 'TX', postalCode: '78701', country: 'US' },
    subtotalCents: totalCents, shippingCents: 0, taxCents: 0, totalCents, status,
  });
}

describe('listCustomers', () => {
  it('counts orders and sums lifetime value', async () => {
    const user = await seedCustomer();
    await seedOrder(user._id, 'SL-1', 'paid', 4200);
    await seedOrder(user._id, 'SL-2', 'delivered', 5800);

    const [row] = await listCustomers();

    expect(row).toMatchObject({ email: 'buyer@example.com', orderCount: 2, lifetimeCents: 10000 });
  });

  it('excludes cancelled and failed orders from lifetime value', async () => {
    const user = await seedCustomer();
    await seedOrder(user._id, 'SL-1', 'paid', 4200);
    await seedOrder(user._id, 'SL-2', 'cancelled', 9900);
    await seedOrder(user._id, 'SL-3', 'payment_failed', 9900);

    const [row] = await listCustomers();

    expect(row.orderCount).toBe(3);
    expect(row.lifetimeCents).toBe(4200);
  });

  it('returns a customer with no orders', async () => {
    await seedCustomer();

    const [row] = await listCustomers();

    expect(row).toMatchObject({ orderCount: 0, lifetimeCents: 0 });
  });
});

describe('getCustomerDetail', () => {
  it('returns the customer with their order rows', async () => {
    const user = await seedCustomer();
    await seedOrder(user._id, 'SL-1', 'paid', 4200);

    const detail = await getCustomerDetail(String(user._id));

    expect(detail?.customer.email).toBe('buyer@example.com');
    expect(detail?.orders.map((order) => order.orderNumber)).toEqual(['SL-1']);
  });

  it('returns null for an unknown id', async () => {
    expect(await getCustomerDetail('64b7f3c2a1b2c3d4e5f60718')).toBeNull();
  });

  it('returns null for a malformed id', async () => {
    expect(await getCustomerDetail('nope')).toBeNull();
  });
});
