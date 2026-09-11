import { beforeEach, describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { withTestDatabase } from '@/tests/setup/db';
import { Product } from '@/lib/db/models/product';
import { Variant } from '@/lib/db/models/variant';
import { Cart } from '@/lib/db/models/cart';
import {
  addItemToCart, createCart, getCartView,
  mergeGuestCartIntoUserCart, updateCartItemQuantity,
} from '@/lib/services/cart';

withTestDatabase();

let variantId: string;

beforeEach(async () => {
  const product = await Product.create({
    title: 'Field Shirt', slug: 'field-shirt', category: 'shirts', status: 'published',
    images: [{ publicId: 'shrinkless/fs', width: 800, height: 1000, alt: 'Field Shirt' }],
  });
  const variant = await Variant.create({
    productId: product._id, size: 'm', color: 'sand', sku: 'FS-M', priceCents: 4500, stock: 5,
  });
  variantId = String(variant._id);
});

describe('addItemToCart', () => {
  it('prices the line from the live variant', async () => {
    const cartId = await createCart();
    const view = await addItemToCart(cartId, variantId, 2);

    expect(view.lines[0].unitPriceCents).toBe(4500);
    expect(view.lines[0].lineTotalCents).toBe(9000);
    expect(view.subtotalCents).toBe(9000);
    expect(view.itemCount).toBe(2);
  });

  it('sums quantities when the same variant is added twice', async () => {
    const cartId = await createCart();
    await addItemToCart(cartId, variantId, 1);
    const view = await addItemToCart(cartId, variantId, 2);

    expect(view.lines).toHaveLength(1);
    expect(view.lines[0].quantity).toBe(3);
  });

  it('refuses to exceed available stock', async () => {
    const cartId = await createCart();
    await expect(addItemToCart(cartId, variantId, 6)).rejects.toThrowError(/only 5/i);
  });

  it('rejects an unknown variant', async () => {
    const cartId = await createCart();
    await expect(addItemToCart(cartId, String(new Types.ObjectId()), 1))
      .rejects.toThrowError(/variant not found/i);
  });
});

describe('updateCartItemQuantity', () => {
  it('removes the line when the quantity is zero', async () => {
    const cartId = await createCart();
    await addItemToCart(cartId, variantId, 2);
    const view = await updateCartItemQuantity(cartId, variantId, 0);

    expect(view.lines).toHaveLength(0);
    expect(view.subtotalCents).toBe(0);
  });
});

describe('getCartView', () => {
  it('reflects a price change made after the item was added', async () => {
    const cartId = await createCart();
    await addItemToCart(cartId, variantId, 1);
    await Variant.updateOne({ _id: variantId }, { priceCents: 5000 });

    const view = await getCartView(cartId);
    expect(view?.subtotalCents).toBe(5000);
  });

  it('returns null for an unknown cart', async () => {
    expect(await getCartView(String(new Types.ObjectId()))).toBeNull();
  });

  /* The cart id is read straight off a cookie on every storefront render, so
     it is the one input to the shop that never passed through a form. This
     used to throw, which took down every page of the store — and since a
     Server Component cannot clear a cookie, a browser carrying a bad one
     could not get back in. A cart id that is not an id is simply no cart. */
  it.each(['', ' ', 'not-an-objectid', 'zzz', '../../etc/passwd', 'null'])(
    'treats %j in the cart cookie as no cart rather than throwing',
    async (value) => {
      await expect(getCartView(value)).resolves.toBeNull();
    },
  );
});

describe('mergeGuestCartIntoUserCart', () => {
  it('sums quantities and caps them at available stock', async () => {
    const userId = String(new Types.ObjectId());
    const userCartId = await createCart(userId);
    await addItemToCart(userCartId, variantId, 4);

    const guestCartId = await createCart();
    await addItemToCart(guestCartId, variantId, 3);

    const mergedId = await mergeGuestCartIntoUserCart(guestCartId, userId);
    const view = await getCartView(mergedId);

    expect(mergedId).toBe(userCartId);
    expect(view?.lines[0].quantity).toBe(5);
    expect(await Cart.findById(guestCartId)).toBeNull();
  });
});

describe('quantity rules', () => {
  it('refuses a quantity the product is not sold in', async () => {
    const product = await Product.create({
      title: 'Bulk Tee',
      slug: 'bulk-tee',
      category: 'tees',
      quantityRule: { min: 12, step: 12, max: 36 },
    });

    const variant = await Variant.create({
      productId: product._id,
      size: 's',
      color: 'sand',
      sku: 'BULK-S-SAND',
      priceCents: 1000,
      stock: 100,
    });

    const cartId = await createCart();

    await expect(addItemToCart(cartId, String(variant._id), 1)).rejects.toThrow(
      /minimums of 12/i,
    );
    await expect(addItemToCart(cartId, String(variant._id), 13)).rejects.toThrow(
      /multiples of 12/i,
    );
    await expect(addItemToCart(cartId, String(variant._id), 48)).rejects.toThrow(
      /at most 36/i,
    );

    const view = await addItemToCart(cartId, String(variant._id), 24);
    expect(view.lines[0].quantity).toBe(24);
    expect(view.lines[0].quantityRule).toEqual({ min: 12, step: 12, max: 36 });
  });

  it('applies the rule to a quantity change as well as an add', async () => {
    const product = await Product.create({
      title: 'Pair Socks',
      slug: 'pair-socks',
      category: 'socks',
      quantityRule: { min: 2, step: 2, max: null },
    });

    const variant = await Variant.create({
      productId: product._id,
      size: 'm',
      color: 'black',
      sku: 'PAIR-M-BLACK',
      priceCents: 800,
      stock: 50,
    });

    const cartId = await createCart();
    await addItemToCart(cartId, String(variant._id), 2);

    await expect(
      updateCartItemQuantity(cartId, String(variant._id), 3),
    ).rejects.toThrow(/multiples of 2/i);

    const view = await updateCartItemQuantity(cartId, String(variant._id), 4);
    expect(view.lines[0].quantity).toBe(4);
  });

  it('leaves ordinary products alone', async () => {
    const product = await Product.create({ title: 'Tee', slug: 'plain-tee', category: 'tees' });
    const variant = await Variant.create({
      productId: product._id,
      size: 's',
      color: 'sand',
      sku: 'PLAIN-S-SAND',
      priceCents: 4200,
      stock: 10,
    });

    const cartId = await createCart();
    const view = await addItemToCart(cartId, String(variant._id), 1);

    expect(view.lines[0].quantity).toBe(1);
    expect(view.lines[0].quantityRule).toEqual({ min: 1, step: 1, max: null });
  });
});
