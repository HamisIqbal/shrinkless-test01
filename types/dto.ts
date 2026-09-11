export type ImageDTO = {
  publicId: string;
  width: number;
  height: number;
  alt: string;
  /** `object-position` — which part of the photograph the frame keeps. */
  focus: string;
  /** How far it is scaled up about that point. 1 is untouched `cover`. */
  zoom: number;
  /** The same pair for the phone, empty and undefined while it follows the
   *  desktop crop. All four are set by the crop stages in the admin; see
   *  `lib/media/crop.ts`. */
  mobileFocus: string;
  mobileZoom?: number;
};

export type VariantDTO = {
  id: string;
  size: string;
  color: string;
  sku: string;
  priceCents: number;
  stock: number;
  inStock: boolean;
  enabled: boolean;
  /** Null means the store-wide threshold applies. */
  lowStockThreshold: number | null;
  imagePublicId: string;
};

export type SeoDTO = {
  title: string;
  description: string;
  keywords: string[];
};

/** How this product may be bought: quantities start at `min`, move in steps
 *  of `step`, and stop at `max` when one is set. */
export type QuantityRuleDTO = {
  min: number;
  step: number;
  max: number | null;
};

export type ProductDTO = {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  status: 'draft' | 'published';
  featured: boolean;
  /** Editorial flag drawn on the card. Sold out is derived from stock. */
  badge: 'none' | 'new';
  /** Out of 5. Zero means unrated, and draws no badge at all. */
  rating: number;
  images: ImageDTO[];
  sizes: string[];
  colors: string[];
  variants: VariantDTO[];
  minPriceCents: number;
  tags: string[];
  baseSku: string;
  seo: SeoDTO;
  quantityRule: QuantityRuleDTO;
  archived: boolean;
};

export type CartLineDTO = {
  variantId: string;
  productTitle: string;
  productSlug: string;
  size: string;
  color: string;
  imagePublicId: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  availableStock: number;
  /** The product's own rule, carried on the line so the cart can offer legal
   *  quantities without re-fetching the product. */
  quantityRule: QuantityRuleDTO;
};

export type CartViewDTO = {
  id: string;
  lines: CartLineDTO[];
  subtotalCents: number;
  itemCount: number;
};

export type AdminProductRowDTO = {
  id: string;
  title: string;
  slug: string;
  category: string;
  status: 'draft' | 'published';
  featured: boolean;
  archived: boolean;
  imagePublicId: string;
  variantCount: number;
  totalStock: number;
  minPriceCents: number;
  updatedAt: string;
};

export type CategoryDTO = {
  id: string;
  name: string;
  slug: string;
  description: string;
  visible: boolean;
  sortOrder: number;
  seo: SeoDTO;
  archived: boolean;
  /** Live products carrying this slug. Drives the "cannot delete" rule. */
  productCount: number;
};

export type DiscountDTO = {
  id: string;
  code: string;
  description: string;
  type: 'percentage' | 'fixed';
  /** Basis points for a percentage, cents for a fixed amount. */
  value: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  usedCount: number;
  minOrderCents: number;
  productIds: string[];
  categorySlugs: string[];
  archived: boolean;
  /** Derived: active, in-window, and not exhausted. */
  redeemable: boolean;
};

export type ShippingMethodDTO = {
  id: string;
  name: string;
  code: string;
  description: string;
  rateCents: number;
  freeOverCents: number | null;
  countries: string[];
  states: string[];
  estimate: string;
  active: boolean;
  sortOrder: number;
  archived: boolean;
};

export type ShippingQuoteDTO = {
  code: string;
  name: string;
  description: string;
  estimate: string;
  rateCents: number;
  /** True when the rate was waived by a threshold rather than being zero. */
  free: boolean;
};

export type PricingBreakdownDTO = {
  subtotalCents: number;
  discountCode: string;
  discountCents: number;
  shippingCents: number;
  shippingMethodCode: string;
  shippingMethodName: string;
  taxCents: number;
  totalCents: number;
  /** Set when a supplied code was refused, with the reason. */
  discountError: string;
};

export type InventoryRowDTO = {
  variantId: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  sku: string;
  size: string;
  color: string;
  stock: number;
  threshold: number;
  enabled: boolean;
  state: 'in_stock' | 'low' | 'out';
};

export type InventoryAdjustmentDTO = {
  id: string;
  variantId: string;
  sku: string;
  delta: number;
  resultingStock: number;
  reason: string;
  note: string;
  actorEmail: string;
  orderId: string | null;
  at: string;
};

export type SettingsDTO = {
  storeEmail: string;
  announcement: string;
  shippingZones: { name: string; states: string[]; rateCents: number }[];
  freeShippingThresholdCents: number | null;
  lowStockThreshold: number;
  taxMode: 'none' | 'flat' | 'stripe';
  flatTaxRateBasisPoints: number;
};

export type OrderStatus =
  | 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'payment_failed';

export type ShippingAddressDTO = {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
};

export type OrderItemDTO = {
  title: string;
  size: string;
  color: string;
  sku: string;
  unitPriceCents: number;
  quantity: number;
  imagePublicId: string;
};

export type StatusEventDTO = {
  status: OrderStatus;
  actor: string;
  at: string;
  note: string;
};

export type OrderNoteDTO = {
  id: string;
  body: string;
  actorEmail: string;
  at: string;
};

export type OrderRowDTO = {
  id: string;
  orderNumber: string;
  email: string;
  status: OrderStatus;
  totalCents: number;
  itemCount: number;
  createdAt: string;
};

export type OrderDTO = OrderRowDTO & {
  userId: string | null;
  items: OrderItemDTO[];
  shippingAddress: ShippingAddressDTO;
  subtotalCents: number;
  discountCode: string;
  discountCents: number;
  shippingCents: number;
  shippingMethodCode: string;
  shippingMethodName: string;
  taxCents: number;
  refundedCents: number;
  trackingNumber: string;
  statusHistory: StatusEventDTO[];
  notes: OrderNoteDTO[];
  /** Status values this order may legally move to right now. */
  allowedTransitions: OrderStatus[];
  payments: PaymentDTO[];
};

export type PaymentDTO = {
  id: string;
  orderId: string;
  provider: string;
  providerPaymentId: string;
  amountCents: number;
  status: string;
  /** Card metadata only. Nothing here can be used to charge anything. */
  last4: string;
  brand: string;
  at: string;
};

export type CustomerRowDTO = {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'admin';
  createdAt: string;
  orderCount: number;
  lifetimeCents: number;
  lastOrderAt: string | null;
};

export type CustomerNoteDTO = OrderNoteDTO;

export type CustomerDetailDTO = CustomerRowDTO & {
  addresses: ShippingAddressDTO[];
  notes: CustomerNoteDTO[];
  averageOrderCents: number;
};

export type LowStockRowDTO = {
  sku: string;
  title: string;
  size: string;
  color: string;
  stock: number;
};

export type BestSellerRowDTO = {
  productId: string;
  title: string;
  slug: string;
  unitsSold: number;
  revenueCents: number;
};

export type AdminStatsDTO = {
  revenueTotalCents: number;
  revenueTodayCents: number;
  revenueWeekCents: number;
  revenueMonthCents: number;
  ordersTotal: number;
  ordersToday: number;
  ordersPending: number;
  ordersCompleted: number;
  ordersCancelled: number;
  customersTotal: number;
  customersNewThisMonth: number;
  averageOrderCents: number;
  lowStockCount: number;
  outOfStockCount: number;
  lowStock: LowStockRowDTO[];
  bestSellers: BestSellerRowDTO[];
  recentOrders: OrderRowDTO[];
};

/** One rung of a style's price ladder, as the wholesale page prints it. */
export type WholesaleTierDTO = {
  tier: number;
  discountPercent: number;
  unitPriceCents: number;
  totalCents: number;
};

/**
 * A wholesale style. Deliberately not a `ProductDTO`: the trade page shows no
 * variants, no stock and no retail price, and sending the whole product would
 * ship a sold-out flag to a page where being sold out means nothing.
 */
export type WholesaleProductDTO = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  image: ImageDTO | null;
  colors: string[];
  sizes: string[];
  /** The retail price the ladder is struck from. Shown as the comparison. */
  retailCents: number;
  tiers: WholesaleTierDTO[];
};

/**
 * One wholesale style as its own page draws it.
 *
 * The line sheet card needs a frame, a title and an opening figure; the style
 * page needs everything the row used to carry inline — the whole gallery and
 * the full description rather than the clamped lead. Same shape plus the two
 * fields the listing has no use for, so the card and the page are never
 * reading two different records of the same style.
 */
export type WholesaleProductDetailDTO = WholesaleProductDTO & {
  images: ImageDTO[];
  /** The sellable variants behind the style, so the page can add to the cart. */
  variants: VariantDTO[];
};

/**
 * One row of the wholesale line sheet, as the admin list draws it.
 *
 * Carries the derived opening tier alongside the retail basis, because the
 * basis on its own is not the number the buyer is quoted and a list that only
 * showed it would be showing the wrong price.
 */
export type AdminWholesaleRowDTO = {
  id: string;
  title: string;
  slug: string;
  category: string;
  status: 'draft' | 'published';
  archived: boolean;
  imagePublicId: string;
  /** The frame's stored placement, so the list thumbnail sits as the sheet does. */
  image: ImageDTO | null;
  variantCount: number;
  retailCents: number;
  /** Per-unit at the smallest tier — the headline figure on the line sheet. */
  openingTier: number;
  openingUnitCents: number;
  updatedAt: string;
};

export type WholesaleEnquiryLineDTO = {
  slug: string;
  title: string;
  tier: number;
  unitPriceCents: number;
  totalCents: number;
};

export type WholesaleEnquiryDTO = {
  id: string;
  company: string;
  contactName: string;
  email: string;
  phone: string;
  country: string;
  message: string;
  lines: WholesaleEnquiryLineDTO[];
  units: number;
  totalCents: number;
  status: 'new' | 'answered' | 'closed';
};
