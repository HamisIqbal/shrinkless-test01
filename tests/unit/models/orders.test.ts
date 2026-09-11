import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { withTestDatabase } from '@/tests/setup/db';
import { User } from '@/lib/db/models/user';
import { Order } from '@/lib/db/models/order';
import { Payment } from '@/lib/db/models/payment';
import { Settings } from '@/lib/db/models/settings';

withTestDatabase();

const orderFixture = {
  orderNumber: 'SHR-1001',
  email: 'buyer@example.com',
  items: [{
    title: 'Field Shirt', size: 'm', color: 'sand', sku: 'FS-M-SAND',
    unitPriceCents: 4500, quantity: 2, imagePublicId: 'shrinkless/field-shirt',
  }],
  shippingAddress: {
    name: 'A Buyer', line1: '1 Main St', city: 'Austin',
    state: 'TX', postalCode: '78701', country: 'US',
  },
  subtotalCents: 9000, shippingCents: 500, taxCents: 743, totalCents: 10243,
};

describe('User model', () => {
  it('defaults to the customer role', async () => {
    const user = await User.create({ email: 'a@b.com', passwordHash: 'hash' });
    expect(user.role).toBe('customer');
  });

  it('rejects a duplicate email', async () => {
    await User.create({ email: 'a@b.com', passwordHash: 'hash' });
    await expect(User.create({ email: 'a@b.com', passwordHash: 'other' })).rejects.toThrowError(/duplicate key/i);
  });
});

describe('Order model', () => {
  it('defaults to pending status', async () => {
    const order = await Order.create(orderFixture);
    expect(order.status).toBe('pending');
  });

  it('keeps the item snapshot independent of the catalogue', async () => {
    const order = await Order.create(orderFixture);
    expect(order.items[0].unitPriceCents).toBe(4500);
    expect(order.items[0].title).toBe('Field Shirt');
  });

  it('rejects a duplicate order number', async () => {
    await Order.create(orderFixture);
    await expect(Order.create(orderFixture)).rejects.toThrowError(/duplicate key/i);
  });
});

describe('Payment model', () => {
  it('rejects a duplicate provider event id', async () => {
    const base = {
      orderId: new Types.ObjectId(), provider: 'stripe' as const,
      providerPaymentId: 'pi_1', providerEventId: 'evt_1',
      amountCents: 10243, status: 'succeeded',
    };
    await Payment.create(base);
    await expect(Payment.create(base)).rejects.toThrowError(/duplicate key/i);
  });
});

describe('Settings model', () => {
  it('allows only one singleton document', async () => {
    await Settings.create({ key: 'store', storeEmail: 'hi@shrinkless.com' });
    await expect(Settings.create({ key: 'store', storeEmail: 'other@shrinkless.com' }))
      .rejects.toThrowError(/duplicate key/i);
  });
});
