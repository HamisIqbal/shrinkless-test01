import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db/connection';
import { Order } from '@/lib/db/models/order';
import { Payment } from '@/lib/db/models/payment';
import { commitStockForOrder, releaseStockForOrder, type Actor } from '@/lib/services/inventory';
import {
  pageWindow,
  searchRegex,
  sortStage,
  toPaged,
  type ListParams,
  type Paged,
} from '@/lib/admin/query';
import type { OrderDTO, OrderRowDTO, OrderStatus, PaymentDTO } from '@/types/dto';

export class InvalidTransitionError extends Error {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`An order cannot move from ${from} to ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export class OrderNotFoundError extends Error {
  constructor(id: string) {
    super(`No order with id ${id}`);
    this.name = 'OrderNotFoundError';
  }
}

export class RefundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RefundError';
  }
}

/**
 * Spec §7.4. delivered/cancelled/payment_failed are terminal, and a no-op
 * transition is refused so the history never fills with duplicates.
 *
 * This is the whole lifecycle. A status not reachable from the current one is
 * not reachable by any route — there is no "force" flag, because an admin who
 * needs one is really telling you the map is wrong.
 */
const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  pending: ['paid', 'cancelled', 'payment_failed'],
  paid: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
  payment_failed: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function allowedTransitions(from: OrderStatus): OrderStatus[] {
  return [...(ALLOWED[from] ?? [])];
}

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date().toISOString();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toPaymentDTO(payment: any): PaymentDTO {
  return {
    id: String(payment._id),
    orderId: String(payment.orderId),
    provider: payment.provider,
    providerPaymentId: payment.providerPaymentId,
    amountCents: payment.amountCents,
    status: payment.status,
    // Card metadata only — a brand and four digits. Nothing here can charge
    // anything, and nothing else from the provider payload is ever exposed.
    last4: payment.last4 ?? '',
    brand: payment.brand ?? '',
    at: toIso(payment.createdAt),
  };
}

function toOrderDTO(order: any, payments: any[] = []): OrderDTO {
  const status = order.status as OrderStatus;

  return {
    id: String(order._id),
    orderNumber: order.orderNumber,
    email: order.email,
    userId: order.userId ? String(order.userId) : null,
    status,
    items: order.items.map((item: any) => ({
      title: item.title,
      size: item.size,
      color: item.color,
      sku: item.sku,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
      imagePublicId: item.imagePublicId ?? '',
    })),
    shippingAddress: {
      name: order.shippingAddress.name,
      line1: order.shippingAddress.line1,
      line2: order.shippingAddress.line2 ?? '',
      city: order.shippingAddress.city,
      state: order.shippingAddress.state,
      postalCode: order.shippingAddress.postalCode,
      country: order.shippingAddress.country,
      phone: order.shippingAddress.phone ?? '',
    },
    subtotalCents: order.subtotalCents,
    discountCode: order.discountCode ?? '',
    discountCents: order.discountCents ?? 0,
    shippingCents: order.shippingCents,
    shippingMethodCode: order.shippingMethodCode ?? '',
    shippingMethodName: order.shippingMethodName ?? '',
    taxCents: order.taxCents,
    totalCents: order.totalCents,
    refundedCents: order.refundedCents ?? 0,
    itemCount: order.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
    trackingNumber: order.trackingNumber ?? '',
    statusHistory: (order.statusHistory ?? []).map((event: any) => ({
      status: event.status as OrderStatus,
      actor: event.actor ?? 'system',
      at: toIso(event.at),
      note: event.note ?? '',
    })),
    notes: (order.notes ?? []).map((note: any) => ({
      id: String(note._id ?? ''),
      body: note.body,
      actorEmail: note.actorEmail ?? 'system',
      at: toIso(note.at),
    })),
    allowedTransitions: allowedTransitions(status),
    payments: payments.map(toPaymentDTO),
    createdAt: toIso(order.createdAt),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function toRow(dto: OrderDTO): OrderRowDTO {
  return {
    id: dto.id,
    orderNumber: dto.orderNumber,
    email: dto.email,
    status: dto.status,
    totalCents: dto.totalCents,
    itemCount: dto.itemCount,
    createdAt: dto.createdAt,
  };
}

export const ORDER_SORTS = ['createdAt', 'totalCents', 'orderNumber', 'status'] as const;
export const ORDER_FILTERS = ['status', 'from', 'to', 'email'] as const;

/**
 * One page of orders, filtered and sorted by the database.
 *
 * Search covers the three things someone actually has in front of them when
 * they go looking: an order number, an email address, and a SKU from a
 * packing slip.
 */
export async function listOrdersPaged(params: ListParams): Promise<Paged<OrderRowDTO>> {
  await connectToDatabase();

  const query: Record<string, unknown> = {};

  const status = params.filters.status as OrderStatus | undefined;
  if (status && status in ALLOWED) query.status = status;

  if (params.filters.email) query.email = params.filters.email.trim().toLowerCase();

  const from = params.filters.from ? new Date(params.filters.from) : null;
  const to = params.filters.to ? new Date(params.filters.to) : null;
  const range: Record<string, Date> = {};
  if (from && !Number.isNaN(from.getTime())) range.$gte = from;
  if (to && !Number.isNaN(to.getTime())) range.$lte = to;
  if (Object.keys(range).length) query.createdAt = range;

  const needle = searchRegex(params.q);
  if (needle) {
    query.$or = [{ orderNumber: needle }, { email: needle }, { 'items.sku': needle }];
  }

  const { skip, limit } = pageWindow(params);

  const [total, orders] = await Promise.all([
    Order.countDocuments(query),
    Order.find(query).sort(sortStage(params.sort, params.direction)).skip(skip).limit(limit).lean(),
  ]);

  return toPaged(orders.map((order) => toRow(toOrderDTO(order))), total, params);
}

/** Kept for the callers that only ever wanted "all of them, newest first". */
export async function listOrders(status?: OrderStatus): Promise<OrderRowDTO[]> {
  await connectToDatabase();

  const query = status ? { status } : {};
  const orders = await Order.find(query).sort({ createdAt: -1 }).limit(200).lean();

  return orders.map((order) => toRow(toOrderDTO(order)));
}

export async function getOrderById(id: string): Promise<OrderDTO | null> {
  if (!Types.ObjectId.isValid(id)) return null;

  await connectToDatabase();

  const order = await Order.findById(id).lean();
  if (!order) return null;

  const payments = await Payment.find({ orderId: order._id }).sort({ createdAt: -1 }).lean();
  return toOrderDTO(order, payments);
}

/**
 * Moves an order along its lifecycle, with the stock consequences that go
 * with each move.
 *
 * Stock is taken when an order is paid and given back when it is cancelled —
 * because those are the moments the units are actually spoken for and
 * released. Both operations are idempotent at the inventory layer, so a
 * retried transition cannot double-count units.
 *
 * A stock failure fails the transition. An order marked paid whose units were
 * never taken is how a store oversells, and the honest outcome is a refusal an
 * admin can act on.
 */
export async function transitionOrder(input: {
  id: string;
  to: OrderStatus;
  actor: string;
  actorId?: string;
  note?: string;
  trackingNumber?: string;
}): Promise<OrderDTO> {
  if (!Types.ObjectId.isValid(input.id)) throw new OrderNotFoundError(input.id);

  await connectToDatabase();

  const order = await Order.findById(input.id);
  if (!order) throw new OrderNotFoundError(input.id);

  const from = order.status as OrderStatus;
  if (!canTransition(from, input.to)) throw new InvalidTransitionError(from, input.to);

  const actor: Actor = { id: input.actorId ?? '', email: input.actor };

  if (input.to === 'paid') await commitStockForOrder(input.id, actor);
  if (input.to === 'cancelled') await releaseStockForOrder(input.id, 'cancellation', actor);

  // Re-read: the inventory helpers write to this same document.
  const fresh = await Order.findById(input.id);
  if (!fresh) throw new OrderNotFoundError(input.id);

  fresh.status = input.to;
  if (input.trackingNumber) fresh.trackingNumber = input.trackingNumber;
  fresh.statusHistory.push({
    status: input.to,
    actor: input.actor,
    at: new Date(),
    note: input.note ?? '',
  });

  await fresh.save();

  // TODO(Phase 5): when `to === 'shipped'`, fire the shipping-confirmation
  // email. The transport now exists in lib/email; the template does not.
  return toOrderDTO(fresh.toObject());
}

/** An internal note. Never shown to the customer. */
export async function addOrderNote(input: {
  id: string;
  body: string;
  actor: Actor;
}): Promise<OrderDTO> {
  if (!Types.ObjectId.isValid(input.id)) throw new OrderNotFoundError(input.id);

  const body = input.body.trim();
  if (!body) throw new Error('A note needs something in it');

  await connectToDatabase();

  const order = await Order.findByIdAndUpdate(
    input.id,
    {
      $push: {
        notes: {
          body,
          actorId: input.actor.id,
          actorEmail: input.actor.email,
          at: new Date(),
        },
      },
    },
    { returnDocument: 'after' },
  ).lean();

  if (!order) throw new OrderNotFoundError(input.id);

  return toOrderDTO(order);
}

/**
 * Records a refund against an order.
 *
 * This moves no money. There is no live payment provider in this store yet, so
 * pretending otherwise would be the worst kind of fiction — an admin would
 * believe a customer had been paid. What this does is keep the shop's own
 * books straight: the amount, who authorised it, and when, in the order's
 * history. When a provider is wired up, its refund call belongs right here,
 * before the write.
 */
export async function recordRefund(input: {
  id: string;
  amountCents: number;
  actor: Actor;
  note?: string;
}): Promise<OrderDTO> {
  if (!Types.ObjectId.isValid(input.id)) throw new OrderNotFoundError(input.id);
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new RefundError('A refund has to be a positive whole number of cents.');
  }

  await connectToDatabase();

  const order = await Order.findById(input.id);
  if (!order) throw new OrderNotFoundError(input.id);

  if (order.status === 'pending' || order.status === 'payment_failed') {
    throw new RefundError('This order was never paid, so there is nothing to refund.');
  }

  const already = order.refundedCents ?? 0;
  if (already + input.amountCents > order.totalCents) {
    throw new RefundError(
      `That would refund more than the order is worth. ` +
        `${formatRemaining(order.totalCents - already)} remains refundable.`,
    );
  }

  order.refundedCents = already + input.amountCents;
  order.statusHistory.push({
    status: order.status as OrderStatus,
    actor: input.actor.email,
    at: new Date(),
    note: `Refund recorded: ${formatRemaining(input.amountCents)}${input.note ? ` — ${input.note}` : ''}`,
  });

  await order.save();

  return toOrderDTO(order.toObject());
}

function formatRemaining(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function listOrdersForUser(userId: string): Promise<OrderRowDTO[]> {
  if (!Types.ObjectId.isValid(userId)) return [];

  await connectToDatabase();

  const orders = await Order.find({ userId }).sort({ createdAt: -1 }).limit(100).lean();
  return orders.map((order) => toRow(toOrderDTO(order)));
}

export const PAYMENT_SORTS = ['createdAt', 'amountCents'] as const;
export const PAYMENT_FILTERS = ['provider', 'status'] as const;

/**
 * Every payment the store has recorded, newest first.
 *
 * Read-only in the strictest sense: payment rows are written by a provider's
 * webhook and by nothing else, so this list has no counterpart that writes.
 */
export async function listPaymentsPaged(
  params: ListParams,
): Promise<Paged<PaymentDTO & { orderNumber: string; email: string }>> {
  await connectToDatabase();

  const query: Record<string, unknown> = {};
  if (params.filters.provider) query.provider = params.filters.provider;
  if (params.filters.status) query.status = params.filters.status;

  const needle = searchRegex(params.q);
  if (needle) query.providerPaymentId = needle;

  const { skip, limit } = pageWindow(params);

  const [total, payments] = await Promise.all([
    Payment.countDocuments(query),
    Payment.find(query).sort(sortStage(params.sort, params.direction)).skip(skip).limit(limit).lean(),
  ]);

  // The orders for this page only, so the list stays flat as payments pile up.
  const orders = await Order.find({ _id: { $in: payments.map((row) => row.orderId) } })
    .select('orderNumber email')
    .lean();

  const byId = new Map(orders.map((order) => [String(order._id), order]));

  return toPaged(
    payments.map((payment) => {
      const order = byId.get(String(payment.orderId));

      return {
        ...toPaymentDTO(payment),
        orderNumber: order?.orderNumber ?? 'Unknown order',
        email: order?.email ?? '',
      };
    }),
    total,
    params,
  );
}

/** Payments recorded against an order. Read-only: payment rows are written by
 *  the provider's webhook, never by an admin. */
export async function listPaymentsForOrder(orderId: string): Promise<PaymentDTO[]> {
  if (!Types.ObjectId.isValid(orderId)) return [];

  await connectToDatabase();

  const payments = await Payment.find({ orderId }).sort({ createdAt: -1 }).lean();
  return payments.map(toPaymentDTO);
}
