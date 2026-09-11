import { connectToDatabase } from '@/lib/db/connection';
import { Order } from '@/lib/db/models/order';
import { countStockStates, listLowStock } from '@/lib/services/inventory';
import { customerCounts } from '@/lib/services/users';
import { listOrdersPaged } from '@/lib/services/orders';
import { parseListParams } from '@/lib/admin/query';
import type { AdminStatsDTO, BestSellerRowDTO, OrderStatus } from '@/types/dto';

/** Money only counts once it has actually been taken. */
const REVENUE_STATUSES: OrderStatus[] = ['paid', 'shipped', 'delivered'];
const COMPLETED_STATUSES: OrderStatus[] = ['delivered'];

function startOfDay(now: Date): Date {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfMonth(now: Date): Date {
  const date = new Date(now);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Revenue over several windows in a single pass.
 *
 * `$facet` runs each window against the same matched set, so four figures cost
 * one trip and one scan instead of four of each. The alternative — four
 * `find()` calls reduced in JavaScript — is what this replaces.
 */
async function revenueFacets(now: Date): Promise<{
  total: number;
  today: number;
  week: number;
  month: number;
  paidOrders: number;
}> {
  const today = startOfDay(now);
  const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const month = startOfMonth(now);

  const sum = (from?: Date) => [
    ...(from ? [{ $match: { createdAt: { $gte: from } } }] : []),
    { $group: { _id: null, cents: { $sum: '$totalCents' }, count: { $sum: 1 } } },
  ];

  const [result] = await Order.aggregate<{
    total: { cents: number; count: number }[];
    today: { cents: number }[];
    week: { cents: number }[];
    month: { cents: number }[];
  }>([
    { $match: { status: { $in: REVENUE_STATUSES } } },
    {
      $facet: {
        total: sum(),
        today: sum(today),
        week: sum(week),
        month: sum(month),
      },
    },
  ]);

  return {
    total: result?.total[0]?.cents ?? 0,
    today: result?.today[0]?.cents ?? 0,
    week: result?.week[0]?.cents ?? 0,
    month: result?.month[0]?.cents ?? 0,
    paidOrders: result?.total[0]?.count ?? 0,
  };
}

/**
 * Units and revenue per product, from the order items themselves.
 *
 * Deliberately not from a counter on the product: a counter drifts the moment
 * an order is cancelled, and there is no way to audit it. This is derived from
 * the orders that actually earned money, so it is always exactly true.
 */
async function bestSellers(limit: number): Promise<BestSellerRowDTO[]> {
  const rows = await Order.aggregate<{
    _id: string;
    unitsSold: number;
    revenueCents: number;
    title: string;
  }>([
    { $match: { status: { $in: REVENUE_STATUSES } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.sku',
        unitsSold: { $sum: '$items.quantity' },
        revenueCents: { $sum: { $multiply: ['$items.unitPriceCents', '$items.quantity'] } },
        title: { $first: '$items.title' },
      },
    },
    {
      // Roll SKUs up to the product they describe. Order items record a title
      // rather than a product id, so the title is the join key available —
      // and it is the one a human reads on the dashboard anyway.
      $group: {
        _id: '$title',
        unitsSold: { $sum: '$unitsSold' },
        revenueCents: { $sum: '$revenueCents' },
        title: { $first: '$title' },
      },
    },
    { $sort: { unitsSold: -1 } },
    { $limit: limit },
  ]);

  return rows.map((row) => ({
    productId: '',
    title: row.title,
    slug: '',
    unitsSold: row.unitsSold,
    revenueCents: row.revenueCents,
  }));
}

/** Order counts by status, in one grouped query. */
async function statusCounts(): Promise<Map<string, number>> {
  const rows = await Order.aggregate<{ _id: string; count: number }>([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  return new Map(rows.map((row) => [row._id, row.count]));
}

/**
 * Everything the dashboard needs, in a handful of aggregations.
 *
 * Nothing here loads a collection into memory to count it, and nothing is
 * calculated in the browser. Each figure is either a `countDocuments` against
 * an indexed field or one stage of an aggregation that the database evaluates.
 */
export async function getAdminStats(now: Date = new Date()): Promise<AdminStatsDTO> {
  await connectToDatabase();

  const [revenue, counts, stock, customers, sellers, recent] = await Promise.all([
    revenueFacets(now),
    statusCounts(),
    countStockStates(),
    customerCounts(startOfMonth(now)),
    bestSellers(5),
    listOrdersPaged(
      parseListParams({ perPage: '5' }, { sorts: ['createdAt'], filters: [] }),
    ),
  ]);

  const ordersToday = await Order.countDocuments({ createdAt: { $gte: startOfDay(now) } });

  const ordersTotal = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const completed = COMPLETED_STATUSES.reduce((sum, status) => sum + (counts.get(status) ?? 0), 0);

  return {
    revenueTotalCents: revenue.total,
    revenueTodayCents: revenue.today,
    revenueWeekCents: revenue.week,
    revenueMonthCents: revenue.month,
    ordersTotal,
    ordersToday,
    ordersPending: counts.get('pending') ?? 0,
    ordersCompleted: completed,
    ordersCancelled: (counts.get('cancelled') ?? 0) + (counts.get('payment_failed') ?? 0),
    customersTotal: customers.total,
    customersNewThisMonth: customers.recent,
    // Average order value is measured over orders that earned money. Including
    // cancelled orders would drag it toward a number no shop ever banked.
    averageOrderCents: revenue.paidOrders
      ? Math.round(revenue.total / revenue.paidOrders)
      : 0,
    lowStockCount: stock.low,
    outOfStockCount: stock.out,
    lowStock: await listLowStock(10),
    bestSellers: sellers,
    recentOrders: recent.rows,
  };
}
