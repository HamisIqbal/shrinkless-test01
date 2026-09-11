import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db/connection';
import { Cart } from '@/lib/db/models/cart';
import { Product } from '@/lib/db/models/product';
import { Variant } from '@/lib/db/models/variant';
import { isAllowedQuantity, snapQuantity } from '@/lib/validation/product';
import type { CartLineDTO, CartViewDTO, QuantityRuleDTO } from '@/types/dto';

export class QuantityRuleError extends Error {
  constructor(readonly rule: QuantityRuleDTO, readonly wanted: number) {
    super(describeRule(rule, wanted));
    this.name = 'QuantityRuleError';
  }
}

/**
 * The shelf cannot cover the line.
 *
 * Named, like `QuantityRuleError`, because the message is written for a
 * shopper and the action is allowed to repeat it verbatim. Everything else
 * this module throws names an id and belongs in a log, not in a toast.
 */
export class StockError extends Error {
  constructor(readonly available: number) {
    super(
      available === 0
        ? 'That sold out while you were looking at it.'
        : `Only ${available} left. Adjust the quantity and try again.`,
    );
    this.name = 'StockError';
  }
}

/** Says what is wrong in the shop's own terms — "sold in pairs", not
 *  "quantity must satisfy (q - min) % step === 0". */
function describeRule(rule: QuantityRuleDTO, wanted: number): string {
  if (rule.max !== null && wanted > rule.max) {
    return `You can order at most ${rule.max} of this at a time.`;
  }
  if (wanted < rule.min) {
    return `This is sold in minimums of ${rule.min}.`;
  }
  if (rule.step > 1) {
    return `This is sold in multiples of ${rule.step}, starting at ${rule.min}.`;
  }
  return `That is not a quantity this product is sold in.`;
}

function ruleOf(product: { quantityRule?: { min?: number; step?: number; max?: number | null } } | null): QuantityRuleDTO {
  return {
    min: product?.quantityRule?.min ?? 1,
    step: product?.quantityRule?.step ?? 1,
    max: product?.quantityRule?.max ?? null,
  };
}

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) throw new Error(`Invalid id: ${id}`);
  return new Types.ObjectId(id);
}

export async function createCart(userId: string | null = null): Promise<string> {
  await connectToDatabase();

  const cart = await Cart.create({ userId: userId ? toObjectId(userId) : null });
  return String(cart._id);
}

export async function getCartView(cartId: string): Promise<CartViewDTO | null> {
  await connectToDatabase();

  // A cart id that is not an id is a cart that does not exist, not a fault.
  // This is read straight from a cookie on every storefront render, and a
  // cookie is a value a browser can be carrying for any number of reasons —
  // a truncated write, something else on the domain, a hand edit. Throwing
  // here took every page down with it, and because a Server Component cannot
  // clear a cookie, the shopper could not get back.
  if (!Types.ObjectId.isValid(cartId)) return null;

  const cart = await Cart.findById(toObjectId(cartId)).lean();
  if (!cart) return null;

  const variantIds = cart.items.map((item) => item.variantId);
  const variants = await Variant.find({ _id: { $in: variantIds } }).lean();
  const products = await Product.find({ _id: { $in: variants.map((v) => v.productId) } }).lean();

  const productById = new Map(products.map((product) => [String(product._id), product]));
  const lines: CartLineDTO[] = [];

  for (const item of cart.items) {
    const variant = variants.find((v) => String(v._id) === String(item.variantId));
    if (!variant) continue;

    const product = productById.get(String(variant.productId));
    if (!product) continue;

    lines.push({
      variantId: String(variant._id),
      productTitle: product.title,
      productSlug: product.slug,
      size: variant.size,
      color: variant.color,
      imagePublicId: product.images[0]?.publicId ?? '',
      unitPriceCents: variant.priceCents,
      quantity: item.quantity,
      lineTotalCents: variant.priceCents * item.quantity,
      availableStock: variant.stock,
      quantityRule: ruleOf(product),
    });
  }

  return {
    id: String(cart._id),
    lines,
    subtotalCents: lines.reduce((sum, line) => sum + line.lineTotalCents, 0),
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}

async function requireVariant(variantId: string) {
  const variant = await Variant.findById(toObjectId(variantId)).lean();
  if (!variant) throw new Error(`Variant not found: ${variantId}`);
  return variant;
}

/**
 * The quantity rule, enforced server-side.
 *
 * The picker in the browser only offers legal values, but a picker is a
 * convenience. This is the rule — every path that changes a line quantity goes
 * through it, so a hand-crafted request cannot buy one of something sold in
 * twelves.
 */
async function assertQuantityAllowed(
  productId: Types.ObjectId,
  quantity: number,
): Promise<void> {
  const product = await Product.findById(productId).select('quantityRule').lean();
  const rule = ruleOf(product);

  if (!isAllowedQuantity(quantity, rule)) throw new QuantityRuleError(rule, quantity);
}

export async function addItemToCart(
  cartId: string,
  variantId: string,
  quantity: number,
): Promise<CartViewDTO> {
  await connectToDatabase();

  const variant = await requireVariant(variantId);
  const cart = await Cart.findById(toObjectId(cartId));
  if (!cart) throw new Error(`Cart not found: ${cartId}`);

  const existing = cart.items.find((item) => String(item.variantId) === variantId);
  const desired = (existing?.quantity ?? 0) + quantity;

  await assertQuantityAllowed(variant.productId, desired);

  if (desired > variant.stock) throw new StockError(variant.stock);

  if (existing) {
    existing.quantity = desired;
  } else {
    cart.items.push({ variantId: toObjectId(variantId), quantity });
  }

  await cart.save();
  return (await getCartView(cartId))!;
}

export async function updateCartItemQuantity(
  cartId: string,
  variantId: string,
  quantity: number,
): Promise<CartViewDTO> {
  await connectToDatabase();

  const cart = await Cart.findById(toObjectId(cartId));
  if (!cart) throw new Error(`Cart not found: ${cartId}`);

  if (quantity <= 0) {
    // Splice in place: a Mongoose DocumentArray cannot be replaced with a
    // plain filtered array.
    const index = cart.items.findIndex((item) => String(item.variantId) === variantId);
    if (index !== -1) cart.items.splice(index, 1);
  } else {
    const variant = await requireVariant(variantId);

    await assertQuantityAllowed(variant.productId, quantity);

    if (quantity > variant.stock) throw new StockError(variant.stock);

    const existing = cart.items.find((item) => String(item.variantId) === variantId);
    if (existing) existing.quantity = quantity;
  }

  await cart.save();
  return (await getCartView(cartId))!;
}

export async function mergeGuestCartIntoUserCart(
  guestCartId: string,
  userId: string,
): Promise<string> {
  await connectToDatabase();

  const guestCart = await Cart.findById(toObjectId(guestCartId));
  if (!guestCart) throw new Error(`Cart not found: ${guestCartId}`);

  const userObjectId = toObjectId(userId);
  const userCart =
    (await Cart.findOne({ userId: userObjectId })) ??
    (await Cart.create({ userId: userObjectId }));

  for (const guestItem of guestCart.items) {
    const variant = await Variant.findById(guestItem.variantId).lean();
    if (!variant) continue;

    const existing = userCart.items.find(
      (item) => String(item.variantId) === String(guestItem.variantId),
    );

    const combined = (existing?.quantity ?? 0) + guestItem.quantity;
    const capped = Math.min(combined, variant.stock);
    if (capped <= 0) continue;

    // A merge must not produce a quantity the product does not sell in. Snap
    // down to the nearest legal value rather than dropping the line: losing a
    // shopper's basket at sign-in is worse than rounding it.
    const product = await Product.findById(variant.productId).select('quantityRule').lean();
    const rule = ruleOf(product);
    const legal = isAllowedQuantity(capped, rule) ? capped : snapQuantity(capped, rule);
    if (legal > variant.stock || legal <= 0) continue;

    if (existing) {
      existing.quantity = legal;
    } else {
      userCart.items.push({ variantId: guestItem.variantId, quantity: legal });
    }
  }

  await userCart.save();
  await Cart.deleteOne({ _id: guestCart._id });

  return String(userCart._id);
}
