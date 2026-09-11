import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { withTestDatabase } from '@/tests/setup/db';
import { Cart } from '@/lib/db/models/cart';

withTestDatabase();

describe('Cart model', () => {
  it('creates an empty guest cart with a null userId', async () => {
    const cart = await Cart.create({});
    expect(cart.userId).toBeNull();
    expect(cart.items).toHaveLength(0);
  });

  it('rejects a quantity below one', async () => {
    await expect(
      Cart.create({ items: [{ variantId: new Types.ObjectId(), quantity: 0 }] }),
    ).rejects.toThrowError(/validation failed/i);
  });

  it('stores no price on the item', async () => {
    const cart = await Cart.create({ items: [{ variantId: new Types.ObjectId(), quantity: 2 }] });
    expect(cart.items[0]).not.toHaveProperty('priceCents');
  });
});
