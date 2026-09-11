# Shrinkless — design spec

**Date:** 2026-08-20
**Status:** Approved (Sections 1–5)
**Repo:** https://github.com/HamisIqbal/shrinkless

Shrinkless is a single-brand ecommerce store selling shirts. This document is the
validated design produced by architectural brainstorming. It describes what is being
built and why. The implementation plan is a separate document.

---

## 1. Scope

**In scope for v1:** product catalogue with size/colour variants, cart, guest and
account checkout, Stripe and PayPal payment, transactional order emails, and an admin
panel for products, orders, and store settings.

**Explicitly out of scope for v1:** reviews, wishlists, blog, multi-vendor, discount
codes, subscriptions, multi-currency, and in-app refunds.

**Deferred decision:** shipping and tax rules. The store is US-based. Pricing is built
as a pluggable module with flat-rate zones plus a free-shipping threshold as the
default, and Stripe Tax documented as the swap-in. This does not block any phase.

---

## 2. Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16, App Router, TypeScript |
| Styling | Tailwind v4 with custom design tokens under `@theme` |
| Database | MongoDB Atlas via Mongoose |
| Validation | Zod, shared between client and server |
| Auth | Auth.js v5, credentials provider, argon2, JWT cookie |
| Payments | Stripe Payment Element + PayPal JS Buttons |
| Images | Cloudinary, signed direct-from-browser upload |
| Email | Resend |
| Motion | Motion + Lenis |
| Hosting | Vercel |

---

## 3. Architecture

### 3.1 Layering

One Next.js application. Route groups: `(shop)`, `(checkout)`, `(account)`, `(admin)`.

Dependencies flow one way and never backwards:

```
app/ ──▶ lib/services/ ──▶ lib/db/
```

- **Components never import Mongoose.** All data access goes through `lib/services/*`.
- Services return plain serializable DTOs. Mongoose documents never escape `lib/services`.
- Server Actions and Route Handlers stay thin: Zod validate → call service → return result.
- `lib/pricing` is pure and depends on nothing but its arguments.

### 3.2 Authorization

`proxy.ts` rejects non-admins at `/admin/*`. (Next 16 renamed the `middleware`
convention to `proxy`; the file is `proxy.ts` at the project root exporting a `proxy`
function, and it runs on the Node runtime only.) **The proxy is a convenience, not the
security boundary** — every admin Server Action independently re-reads the session and
re-checks `role === 'admin'` before touching data. Next's own docs are explicit that
proxy "should not be used as a full session management or authorization solution",
which is exactly why the real check lives in the actions. Admins are never self-registered; the
first admin comes from `scripts/seed-admin.ts`, and further admins are promoted by an
existing admin.

### 3.3 Money

All monetary values are stored and computed as **integer cents**. No floats anywhere in
the money path. Formatting to a currency string happens only at render time.

---

## 4. Data model

Seven collections.

**`users`** — `email` (unique), `passwordHash` (argon2), `name`, `role`
(`'customer' | 'admin'`), `addresses[]`, timestamps. One collection for both roles;
`role` is the only distinction.

**`products`** — `title`, `slug` (unique), `description`, `category`, `status`
(`'draft' | 'published'`), `images[]` (Cloudinary `public_id`, width, height, alt),
`optionSets` (available sizes and colours), timestamps.

**`variants`** — `productId`, `size`, `color`, `sku` (unique), `priceCents`, `stock`,
`enabled`. One document per size × colour combination. **Price and stock live here, not
on the product.**

**`carts`** — `userId` (nullable for guests), `items[]` of `{ variantId, quantity }`,
`updatedAt`. **Carts never store prices.** Price is re-read from the variant at every
render and again at checkout, so a stale cart cannot lock in an old price.

**`orders`** — `orderNumber` (human-readable, unique), `userId` (nullable), `email`,
`items[]` as denormalized snapshots (`title`, `size`, `color`, `sku`, `unitPriceCents`,
`quantity`, `imagePublicId`), `shippingAddress`, `subtotalCents`, `shippingCents`,
`taxCents`, `totalCents`, `status`, `statusHistory[]`, timestamps.

Order items are **snapshots**, so editing or deleting a product never mutates the
historical record of what someone bought and what they paid.

Order status: `pending → paid → shipped → delivered`, plus `cancelled` and
`payment_failed`. Every transition appends to `statusHistory` with actor and timestamp.

**`payments`** — `orderId`, `provider` (`'stripe' | 'paypal'`), `providerPaymentId`,
`providerEventId` (**unique index — the idempotency mechanism**), `amountCents`,
`status`, `last4`, `brand`, `raw` (trimmed provider payload), timestamps.

One document is written **per processed webhook event**, not per order, so a single
order may have several payment records over its lifetime (intent created, succeeded,
and so on). The order's own `status` remains the single answer to "is this paid".
**No raw card numbers are ever stored.** Tokens and last4 only, which keeps PCI scope
minimal.

**`settings`** — a singleton document: shipping zones, free-shipping threshold, tax
mode, store contact email, announcement-bar text. This is where the deferred
shipping/tax decision lands.

---

## 5. Storefront

### 5.1 Routes

| Route | Purpose |
|---|---|
| `/` | Hero, featured drop, category strip, brand story |
| `/shop`, `/shop/[category]` | Grid with filters and sorting |
| `/product/[slug]` | Gallery, variant picker, stock state, add to cart |
| `/cart` | Full cart page; the mini-cart drawer is the primary surface |
| `/about`, `/contact`, `/policies/[slug]` | Static content |

### 5.2 Browse

Filters live in the URL as searchParams (`?size=m&color=sand`), making filtered grids
shareable and back-button-correct. The grid is a Server Component reading from
`lib/services/products`; only the filter bar is a client island, and it pushes
searchParams rather than holding local state. Filters render as a **horizontal bar above
the grid** rather than a sidebar, which survives mobile better.

### 5.3 Product detail

The variant picker is a client island. Selecting size and colour resolves to a specific
variant, and price, SKU, and stock come from that variant. **Out-of-stock combinations
render disabled, not hidden** — a shopper should see that their size exists and is gone.

Add-to-cart is a Server Action that re-validates stock server-side. The mini-cart drawer
opens optimistically and reconciles when the action returns.

### 5.4 Cart persistence

Guests get a signed `cartId` cookie pointing at a `carts` document. On login the guest
cart **merges** into the account cart — quantities summed, capped at available stock —
rather than replacing it.

---

## 6. Design system

**1970s workwear / heritage print shop.**

**Type.** Two families, no third. A condensed grotesque for headings and navigation, set
tight and uppercase. A slab serif for body and product copy. Tabular numerals wherever
money appears. A fixed six-step scale rather than fluid clamps — printed matter does not
fluidly resize.

**Colour.** Warm off-white paper stock as the page ground. Near-black ink for text,
never pure `#000`. A single saturated accent used sparingly, for price, sale tags, and
the primary button only. Two muted supporting tones for surfaces and rules. All defined
as CSS custom properties under Tailwind v4's `@theme` in `app/globals.css`, which is the
only source of truth — **no hardcoded colours anywhere else in the app.**

**Texture.** Restraint, not filters. Hairline 1px rules dividing sections. A subtle
paper grain as a single tiled background asset. Halftone treatment on editorial and
lifestyle photography via a CSS blend layer, not per-image editing. **Product shots stay
clean** — halftone is for editorial imagery only.

**Layout.** A visible 12-column grid with hairline gutters on wide screens, collapsing
to 4 on mobile. Section headers sit in a left-aligned label column, like a catalogue
page. Cards have no shadows and no rounded corners; separation comes from rules and
whitespace.

**Motion.** Lenis for smooth scroll. Motion for staggered, short, once-only entrance
reveals on section headers and grid items. Drawers and modals transition in ~180ms,
eased out. Everything respects `prefers-reduced-motion`: reveals become instant and
Lenis is disabled.

**Primitives.** `Button`, `Input`, `Select`, `Rule`, `Tag`, `PriceTag`, `ProductCard`,
`Drawer`, `Dialog`, `Toast` — all in `components/ui/*`, consuming tokens only.

---

## 7. Admin panel

The `(admin)` group has its own layout: fixed left sidebar, dense tables, no Lenis, no
scroll reveals. It uses the **same design tokens** as the storefront at a working
density — smaller type, tighter spacing, tabular numerals, no paper grain or halftone.
The back office of the same shop, not the shop floor.

### 7.1 Routes

| Route | Purpose |
|---|---|
| `/admin` | Today's orders, weekly revenue, low-stock warnings |
| `/admin/products` | Table: image, title, status, variant count, total stock |
| `/admin/products/new`, `/admin/products/[id]` | Product editor |
| `/admin/orders`, `/admin/orders/[id]` | Orders and fulfillment |
| `/admin/customers`, `/admin/customers/[id]` | Read-only in v1 |
| `/admin/settings` | Store settings singleton |

### 7.2 Product editor

A single form owns the product and its variants. After entering the product fields and
defining the option sets, a **variant matrix generates automatically** — S/M/L/XL ×
Sand/Black yields eight rows, each with its own SKU, price, and stock. Rows can be
individually disabled for combinations that are not produced.

Editing a saved product **reconciles rather than regenerates**: adding a colour appends
new rows and leaves existing rows and their stock untouched.

### 7.3 Images

Uploads go directly from the browser to Cloudinary using a signature minted by a Server
Action. Image bytes never pass through our server. We store `public_id` and dimensions,
and derive every size through Cloudinary transform URLs. No image binaries in MongoDB,
no uploads written to `/public`.

### 7.4 Fulfillment

Order detail shows snapshot line items, shipping address, and the linked payment record.
Actions in v1 are deliberately few: **mark as shipped** with a tracking number, which
fires the shipping-confirmation email via Resend, **mark as delivered**, and **cancel**.
There is no carrier tracking integration in v1, so `delivered` is set manually by an
admin rather than derived from a carrier webhook.

**Refunds link out to the Stripe and PayPal dashboards** rather than being implemented
in-app. Partial refunds, restocking, and tax reversal are fiddly, and refunds are rare
enough in a v1 store that the surface area is not justified. The order page deep-links
to the relevant provider transaction.

### 7.5 Inventory timing

Stock decrements on **webhook payment confirmation**, never on add-to-cart. Carts hold
no reservation, so two shoppers can both hold the last shirt; the second to pay is
rejected at the payment-intent stage, before their card is charged. Checkout
re-validates stock at the moment it starts, so this failure is rare and caught early.

Reservations with expiry are deliberately deferred — they require a background expiry
job that v1 does not need. If oversells become a real problem in practice, that is the
upgrade.

---

## 8. Checkout and payments

### 8.1 Governing rule

**The browser never decides what an order costs, and never decides that an order is
paid.** The client sends a cart ID and an address. The server computes the amount from
the database, and the order is confirmed only when the provider's webhook says so.

### 8.2 Page structure

A single `/checkout` page with four stacked sections — contact email, shipping address,
delivery method, payment — rather than a multi-step wizard. Sections reveal
progressively as the one above becomes valid. The order summary is sticky alongside on
desktop and collapsible at the top on mobile.

Checkout uses a **focused shell**: logo and secure badge, no site navigation or footer.
Guests and logged-in customers use the identical page; logged-in customers get their
saved address prefilled and their email locked.

### 8.3 Pricing module

`lib/pricing` is a pure function:

```
(cart, settings, address) → { subtotalCents, shippingCents, taxCents, totalCents }
```

It reads live variant prices, never cart prices. It is called in exactly three places —
the order summary, payment-intent creation, and webhook verification — so the number
shown, the number charged, and the number recorded cannot drift apart. The deferred
shipping/tax decision lands here, behind a stable interface.

### 8.4 Stripe flow

1. Address valid → Server Action creates a `pending` order and a PaymentIntent, amount
   from `lib/pricing`, `orderId` in metadata. Only the client secret is returned.
2. Payment Element collects the card. Card data goes browser → Stripe directly and never
   touches our server. We store the token and last4.
3. Confirmation redirects to `/checkout/processing?order=…`.
4. `POST /api/webhooks/stripe` verifies the signature, recomputes the expected amount,
   and only then marks the order `paid`, decrements stock, and queues the email.

Apple Pay and Google Pay are enabled through the Payment Element, including domain
verification.

### 8.5 PayPal flow

The same skeleton with a different SDK. `createOrder` calls a Server Action that creates
the PayPal order from our computed total. `onApprove` calls a Server Action that
captures it. **Capture success does not confirm the order** — the PayPal webhook does,
through the same confirmation logic as Stripe. Two providers, one confirmation path.

### 8.6 The redirect/webhook race

The webhook and the browser redirect arrive in unpredictable order.
`/checkout/processing` polls order status for up to roughly 20 seconds. On `paid` it
redirects to `/order/[number]`. On timeout it shows "payment received, confirmation on
its way" rather than an error — at that point the money has almost certainly moved, and
reporting a failure would be false. The webhook still lands and the email still sends.

### 8.7 Idempotency

Every webhook event ID is written to `payments` under a unique index. A replayed event
hits the duplicate-key error and exits early. Without this, provider retries would
double-decrement stock and send duplicate emails. Providers retry aggressively; this is
not theoretical.

### 8.8 Failure handling

| Failure | Behaviour |
|---|---|
| Card declined | Stay on `/checkout`, show provider message, order stays `pending`, cart intact |
| Stock gone at checkout start | Block before payment, name the sold-out item, offer removal |
| Stock gone at webhook time | Confirm the order, flag for admin — never take money and silently fail |
| Price changed since cart | Recomputed total shown before payment; carts hold no prices |
| Webhook never arrives | Order stays `pending`, surfaced in an admin "needs attention" filter |

### 8.9 Security

Webhook signatures verified for both providers, with the raw request body preserved for
verification. Amounts recomputed server-side at every stage. No raw card data on our
servers or in our database at any point.

---

## 9. Directory structure

```
shrinkless/
├─ app/
│  ├─ (shop)/          header, footer, announcement bar
│  │  ├─ page.tsx
│  │  ├─ shop/[[...category]]/page.tsx
│  │  ├─ product/[slug]/page.tsx
│  │  ├─ cart/page.tsx
│  │  └─ policies/[slug]/page.tsx
│  ├─ (checkout)/      minimal shell
│  │  ├─ checkout/page.tsx
│  │  ├─ checkout/processing/page.tsx
│  │  └─ order/[number]/page.tsx
│  ├─ (account)/account/…
│  ├─ (admin)/admin/…
│  ├─ api/
│  │  ├─ auth/[...nextauth]/route.ts
│  │  └─ webhooks/{stripe,paypal}/route.ts
│  ├─ layout.tsx · globals.css · not-found.tsx · error.tsx
├─ components/
│  ├─ ui/       Button, Input, Select, Rule, Tag, PriceTag, Drawer, Dialog, Toast
│  ├─ shop/     ProductCard, VariantPicker, FilterBar, MiniCart, Gallery
│  └─ admin/    DataTable, VariantMatrix, ImageUploader, StatusBadge
├─ lib/
│  ├─ db/         connection.ts, models/
│  ├─ services/   products, cart, orders, payments, users, settings
│  ├─ pricing/    index.ts, shipping.ts, tax.ts
│  ├─ validation/ Zod schemas
│  ├─ auth/       Auth.js config, role guards
│  ├─ email/      Resend client and templates
│  └─ cloudinary/ signature minting, transform helpers
├─ scripts/  seed-admin.ts, seed-products.ts
├─ tests/    unit/ (Vitest) · e2e/ (Playwright)
├─ types/
└─ proxy.ts
```

---

## 10. Phases

| Phase | Content | Deliverable |
|---|---|---|
| 0 | Next.js 16, TypeScript, Tailwind v4, lint/format, Atlas connection, env scaffolding | The Vercel deploy stops 404-ing |
| 1 | All seven models, Zod schemas, services returning DTOs, seed scripts, unit tests. No UI. | Seeded database, green test suite |
| 2 | Storefront skeleton: home, grid, filters, PDP, variant picker, cart drawer, cart merge. **Unstyled** — semantic HTML and layout only. | Browse and fill a cart |
| 3 | Auth.js credentials, argon2, admin seed, account pages, route protection | Sign in and see order history |
| 4 | Admin panel: product editor with variant matrix, Cloudinary uploads, orders, settings | Manage the store |
| 5 | `lib/pricing`, checkout page, both providers, both webhooks, idempotency, order emails | Take real money |
| 6 | Design pass: the entire vintage system applied at once | The store looks like itself |
| 7 | SEO, accessibility, performance, error boundaries, rate limiting, Playwright coverage | Launch-ready |

Styling is deliberately deferred to Phase 6. Applying the design system in one pass over
working markup is cheaper than styling as we go and restyling as structure changes.
Phase 5 is the riskiest and warrants its own branch.

---

## 11. Testing

Vitest for `lib/pricing` and the services, running against `mongodb-memory-server` so
tests require no live Atlas connection. **Pricing gets the heaviest coverage** — it is
pure, it decides money, and it is cheap to test exhaustively.

Playwright covers the critical path end to end (browse → cart → pay) using Stripe test
cards. Webhooks are exercised locally through the Stripe CLI.

---

## 12. Environment variables

`MONGODB_URI`, `AUTH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`,
`PAYPAL_WEBHOOK_ID`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
`CLOUDINARY_API_SECRET`, `RESEND_API_KEY`, `NEXT_PUBLIC_SITE_URL`.

Set per-environment in Vercel. `.env.local` is gitignored and never committed.
