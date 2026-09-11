import { Types } from 'mongoose';
import { hash, verify } from '@node-rs/argon2';
import { connectToDatabase } from '@/lib/db/connection';
import { Order } from '@/lib/db/models/order';
import { User } from '@/lib/db/models/user';
import { listOrdersForUser } from '@/lib/services/orders';
import type { RegisterInput } from '@/lib/validation/auth';
import {
  pageWindow,
  searchRegex,
  sortStage,
  toPaged,
  type ListParams,
  type Paged,
} from '@/lib/admin/query';
import type {
  CustomerDetailDTO,
  CustomerNoteDTO,
  CustomerRowDTO,
  OrderRowDTO,
  ShippingAddressDTO,
} from '@/types/dto';

export type UserDTO = {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'admin';
};

export class EmailTakenError extends Error {
  constructor(email: string) {
    super(`An account already exists for ${email}`);
    this.name = 'EmailTakenError';
  }
}

/**
 * A real argon2 hash of a throwaway value. When no user matches, we verify
 * against this so a missing account costs the same time as a wrong password
 * and cannot be detected by timing.
 *
 * Computed lazily and cached rather than with a top-level await: `tsx`
 * transforms scripts to CJS, which rejects top-level await outright.
 */
let dummyHashPromise: Promise<string> | null = null;

function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hash('shrinkless-dummy-password');
  return dummyHashPromise;
}

type UserShape = {
  _id: Types.ObjectId;
  email: string;
  name: string;
  role: string;
};

function toUserDTO(user: UserShape): UserDTO {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role === 'admin' ? 'admin' : 'customer',
  };
}

export async function createUser(input: RegisterInput): Promise<UserDTO> {
  await connectToDatabase();

  const existing = await User.findOne({ email: input.email }).lean();
  if (existing) throw new EmailTakenError(input.email);

  try {
    const created = await User.create({
      email: input.email,
      passwordHash: await hash(input.password),
      name: input.name,
      role: 'customer', // never taken from input
    });

    return toUserDTO(created as unknown as UserShape);
  } catch (error) {
    // The unique index is the real guard; the check above is only a nicety.
    if (error instanceof Error && error.message.includes('duplicate key')) {
      throw new EmailTakenError(input.email);
    }
    throw error;
  }
}

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<UserDTO | null> {
  await connectToDatabase();

  const normalised = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalised }).lean();

  if (!user) {
    await verify(await getDummyHash(), password).catch(() => false);
    return null;
  }

  const valid = await verify(user.passwordHash, password).catch(() => false);
  if (!valid) return null;

  return toUserDTO(user as unknown as UserShape);
}

export async function getUserById(id: string): Promise<UserDTO | null> {
  if (!Types.ObjectId.isValid(id)) return null;

  await connectToDatabase();
  const user = await User.findById(id).lean();

  return user ? toUserDTO(user as unknown as UserShape) : null;
}

/** Cancelled and failed orders are not revenue. */
const REVENUE_STATUSES = ['paid', 'shipped', 'delivered'];

export const CUSTOMER_SORTS = ['createdAt', 'email', 'name'] as const;
export const CUSTOMER_FILTERS = ['role', 'hasOrders'] as const;

type OrderRollup = {
  orderCount: number;
  lifetimeCents: number;
  lastOrderAt: Date | null;
};

/**
 * Order totals for a set of customers, in one grouped query.
 *
 * Scoped to the ids on the current page. The previous implementation loaded
 * every user and every one of their orders and reduced in JavaScript, which is
 * fine for a seeded database and quietly fatal for a real one.
 */
async function rollupForUsers(ids: Types.ObjectId[]): Promise<Map<string, OrderRollup>> {
  if (!ids.length) return new Map();

  const rows = await Order.aggregate<{
    _id: Types.ObjectId;
    orderCount: number;
    lifetimeCents: number;
    lastOrderAt: Date | null;
  }>([
    { $match: { userId: { $in: ids } } },
    {
      $group: {
        _id: '$userId',
        orderCount: { $sum: 1 },
        lifetimeCents: {
          $sum: {
            $cond: [{ $in: ['$status', REVENUE_STATUSES] }, '$totalCents', 0],
          },
        },
        lastOrderAt: { $max: '$createdAt' },
      },
    },
  ]);

  return new Map(
    rows.map((row) => [
      String(row._id),
      {
        orderCount: row.orderCount,
        lifetimeCents: row.lifetimeCents,
        lastOrderAt: row.lastOrderAt ?? null,
      },
    ]),
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toCustomerRow(user: any, rollup: OrderRollup | undefined): CustomerRowDTO {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name ?? '',
    role: user.role === 'admin' ? 'admin' : 'customer',
    createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : '',
    orderCount: rollup?.orderCount ?? 0,
    lifetimeCents: rollup?.lifetimeCents ?? 0,
    lastOrderAt: rollup?.lastOrderAt ? new Date(rollup.lastOrderAt).toISOString() : null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function listCustomersPaged(params: ListParams): Promise<Paged<CustomerRowDTO>> {
  await connectToDatabase();

  const query: Record<string, unknown> = {};
  if (params.filters.role === 'admin' || params.filters.role === 'customer') {
    query.role = params.filters.role;
  }

  const needle = searchRegex(params.q);
  if (needle) query.$or = [{ email: needle }, { name: needle }];

  const { skip, limit } = pageWindow(params);

  const [total, users] = await Promise.all([
    User.countDocuments(query),
    User.find(query)
      .select('email name role createdAt')
      .sort(sortStage(params.sort, params.direction))
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const rollup = await rollupForUsers(users.map((user) => user._id));
  const rows = users.map((user) => toCustomerRow(user, rollup.get(String(user._id))));

  // "Has ordered" is a property of the rollup, not of the user document, so it
  // filters the page rather than the query. Honest about what it is: a
  // convenience on top of a paged list, not a scalable index.
  const filtered =
    params.filters.hasOrders === 'true' ? rows.filter((row) => row.orderCount > 0) : rows;

  return toPaged(filtered, total, params);
}

/** Every customer, newest first. Bounded, because nothing good happens when an
 *  unbounded list meets a real customer base. */
export async function listCustomers(limit = 200): Promise<CustomerRowDTO[]> {
  await connectToDatabase();

  const users = await User.find({})
    .select('email name role createdAt')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const rollup = await rollupForUsers(users.map((user) => user._id));

  return users.map((user) => toCustomerRow(user, rollup.get(String(user._id))));
}

/**
 * One customer, with their orders.
 *
 * `passwordHash` is excluded at the query, not filtered afterwards — the field
 * never enters the process, so no future change to a DTO mapper can leak it.
 */
export async function getCustomerDetail(
  id: string,
): Promise<{ customer: CustomerDetailDTO; orders: OrderRowDTO[] } | null> {
  if (!Types.ObjectId.isValid(id)) return null;

  await connectToDatabase();

  const user = await User.findById(id).select('-passwordHash').lean();
  if (!user) return null;

  const rollup = await rollupForUsers([user._id]);
  const row = toCustomerRow(user, rollup.get(String(user._id)));
  const orders = await listOrdersForUser(id);

  const notes: CustomerNoteDTO[] = ((user as { notes?: unknown[] }).notes ?? []).map(
    (note) => {
      const entry = note as { _id?: unknown; body: string; actorEmail?: string; at?: Date };
      return {
        id: String(entry._id ?? ''),
        body: entry.body,
        actorEmail: entry.actorEmail ?? 'system',
        at: entry.at ? new Date(entry.at).toISOString() : '',
      };
    },
  );

  const addresses: ShippingAddressDTO[] = ((user.addresses ?? []) as ShippingAddressDTO[]).map(
    (address) => ({
      name: address.name,
      line1: address.line1,
      line2: address.line2 ?? '',
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      phone: address.phone ?? '',
    }),
  );

  return {
    customer: {
      ...row,
      addresses,
      notes,
      averageOrderCents: row.orderCount ? Math.round(row.lifetimeCents / row.orderCount) : 0,
    },
    orders,
  };
}

export class CustomerNotFoundError extends Error {
  constructor(id: string) {
    super(`No customer with id ${id}`);
    this.name = 'CustomerNotFoundError';
  }
}

/** An internal note about a customer. Shop-side only. */
export async function addCustomerNote(input: {
  id: string;
  body: string;
  actor: { id: string; email: string };
}): Promise<void> {
  if (!Types.ObjectId.isValid(input.id)) throw new CustomerNotFoundError(input.id);

  const body = input.body.trim();
  if (!body) throw new Error('A note needs something in it');

  await connectToDatabase();

  const updated = await User.findByIdAndUpdate(input.id, {
    $push: {
      notes: { body, actorId: input.actor.id, actorEmail: input.actor.email, at: new Date() },
    },
  });

  if (!updated) throw new CustomerNotFoundError(input.id);
}

/** Total customers, and how many arrived since a date. Counts, not scans. */
export async function customerCounts(since: Date): Promise<{ total: number; recent: number }> {
  await connectToDatabase();

  const [total, recent] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ createdAt: { $gte: since } }),
  ]);

  return { total, recent };
}
