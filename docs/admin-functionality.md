# Admin panel: functional foundation

What exists behind the admin panel, why it is shaped this way, and what is
deliberately not built yet. The UI is intentionally plain — the visual pass
comes next; everything below is the machinery it will dress.

## Architecture, unchanged

Nothing was replaced. This builds on what the store already had:

| Concern | Stays as it was |
|---|---|
| Framework | Next 16, App Router, Server Components + Server Actions |
| Database | MongoDB via Mongoose 9, models in `lib/db/models` |
| Auth | NextAuth v5, JWT sessions, credentials provider, admin 2FA |
| Validation | Zod schemas in `lib/validation` |
| Images | Cloudinary, signed direct uploads |
| Email | Resend, via `lib/email` |

## The four layers

```
app/(admin)/**/page.tsx     Server Components. Read-only. Guarded by permission.
app/actions/admin/*.ts      Server Actions. Authorize → validate → call a service.
lib/services/*.ts           Business logic. The only place that touches models.
lib/db/models/*.ts          Schemas and indexes.
```

A page never writes. An action never queries. A service never reads a request.

### One shape for every mutation

`lib/admin/action.ts` wraps every admin action:

```ts
export const saveDiscountAction = adminAction(
  { permission: 'discounts:write', schema: discountInputSchema, translate },
  async (input, actor) => { … },
);
```

It authorizes **first** — before validation, before any read — so an
unauthorized caller learns nothing about the shape of the input. Then it
validates, then it runs, then it returns `AdminResult<T>`: `{ ok: true, data }`
or `{ ok: false, error, fieldErrors? }`. Unknown errors are logged server-side
and replaced with a generic message, so a stack trace never reaches a toast.

### Permissions, not roles

`lib/auth/permissions.ts` maps a role to named permissions
(`orders:write`, `inventory:read`, …). Guards ask for a permission, never for a
role. Adding a "fulfilment" or "support" role later is a change to that one
table — no guard has to be found and rewritten.

`requireAdminPage(permission)` for pages, `requirePermission(permission)` for
actions. `proxy.ts` also gates `/admin/*`, but it is an optimistic convenience:
a Server Action is a POST to whatever route imported it, so the enforcing check
is always the one inside the action.

## What each area does

### Products
Create, edit, publish/unpublish, archive/restore. Title, slug, description,
category, price and SKU per variant, images (ordered — position 0 is the
featured image), tags, base SKU, SEO title/description/keywords, featured and
badge flags.

**Quantity rules.** A product states how it is sold: `min`, `step`, `max`. A
step of 12 with a minimum of 12 sells in 12, 24, 36. The product page offers
only legal quantities and the cart service refuses anything else — the picker
is a convenience, the server is the rule.

Products are never hard-deleted. Carts hold variant ids and past orders were
priced from them, so a delete would rewrite history. Archive is the delete.

### Inventory
`Variant.stock` is the running total; `InventoryAdjustment` is how it got
there — an append-only ledger with delta, resulting stock, reason, actor and
the order that caused it.

Every movement goes through `adjustStock`, one `findOneAndUpdate` with the
guard inside the filter:

```ts
if (delta < 0) filter.stock = { $gte: -delta };
```

Two requests racing for the last unit cannot both match. Read-then-write would
be the obvious shape and would be wrong. Overselling is not supported; the
floor is zero.

Orders take stock when marked **paid** and give it back when **cancelled**.
Both are idempotent. `commitStockForOrder` compensates its own partial
failures rather than using a multi-document transaction — that would need a
replica set and would make local development impossible against a standalone
`mongod`.

Low-stock threshold is store-wide with an optional per-variant override.

### Orders
The lifecycle map is unchanged and lives in one place:

```
pending → paid | cancelled | payment_failed
paid    → shipped | cancelled
shipped → delivered
delivered, cancelled, payment_failed → terminal
```

Every transition is validated; there is no force flag. The fulfilment buttons
are rendered from `allowedTransitions` the server reports, so the UI cannot
drift from the rule. Plus: internal notes (append-only, staff-only), recorded
refunds, and a read-only payments view.

### Customers
Paged, searchable, with an aggregation-backed order rollup (count, lifetime
value, last order). Detail adds addresses, average order value and internal
notes. `passwordHash` is excluded at the query, not filtered afterwards — the
field never enters the process.

### Categories
New `Category` collection. Products still reference a category by **slug**, the
same field they always used, so no product document had to change. Renaming a
slug reassigns every product in the same call. Archiving is refused while a
category still holds products — a category vanishing under a live product
would 404 its own listing page. `backfillCategoriesFromProducts()` imports the
slugs that already exist.

### Discounts
Percentage (basis points) or fixed (cents). Windows, total and per-customer
limits, minimum order, product and category restrictions. `evaluateDiscount`
is the only place an amount is produced: the browser sends a **code**, never an
amount. Refusals are typed (`expired`, `exhausted`, `customer_limit`, …).
Redemptions are a ledger with a unique `(discountId, orderId)` index, so a
retried checkout cannot burn a customer's allowance twice.

### Shipping
`ShippingMethod` with rate, free-over threshold, country/state scoping, active
flag and ordering. `quoteShipping` is server-side only. The legacy
`Settings.shippingZones` table still works as a fallback for a store with no
method configured.

### Pricing
`lib/services/pricing.ts` is the single place a total is computed. Order of
operations is fixed: discount off the subtotal, tax on the discounted goods,
shipping added last and untaxed.

### Dashboard
`getAdminStats` returns revenue (today / 7 days / month / all time), order
counts by state, customers, average order value, low and out-of-stock counts,
best sellers and recent orders. Revenue windows come from one `$facet`; best
sellers from `$unwind` over order items. Nothing loads a collection to count
it, and nothing is calculated in the browser.

### Lists
`lib/admin/query.ts` gives every list the same parse → page → sort → search
pipeline. The query string *is* the state, so every admin list is linkable and
works without JavaScript. Sort keys are allow-listed per list — a query string
can never choose which field the database sorts by. Search terms are regex
escaped and length capped. `perPage` is capped at 100.

## Security audit

| Check | Status |
|---|---|
| Broken access control | Every page and action names a permission; verified across all 14 pages and 20 actions |
| Client-side-only permissions | None. Buttons are convenience; actions re-check |
| Missing server-side authorization | None found; the wrapper makes it structural |
| IDOR | Admin reads are permission-gated. `listOrdersForUser` is scoped by session id, never by a request parameter |
| Injection | Sort fields allow-listed; search terms regex-escaped and capped; no `$where`, no string-built queries |
| Input validation | Zod on every action, re-validated server-side regardless of client checks |
| Client-supplied money | Never trusted. Prices come from variants, discounts from the coupon record, shipping from the method, tax from settings |
| Sensitive data leakage | `passwordHash` excluded at query; payment `raw` payload never mapped into a DTO; only brand + last4 exposed |
| Exposed secrets | Cloudinary and Resend secrets are server-only; the browser receives a signature, never a key |
| Insecure file upload | Signed, folder-scoped, direct to Cloudinary; the signature endpoint requires `products:write` |
| Rate limiting | Login (per email and per address), 2FA sends, and public sign-up forms. Fixed-window counters in Mongo, so they work across serverless instances |
| Session security | JWT, `AUTH_SECRET`-signed; role read from the signed token, not from a client-writable field |
| CSRF | Server Actions carry Next's built-in origin check; no custom cross-origin mutation endpoints exist |

## Deliberately not built

- **Checkout.** There is no checkout route and no payment provider. `Payment`
  rows are written by a provider webhook that does not exist yet. The admin
  panel therefore *exposes* payments read-only rather than inventing them.
- **Refunds that move money.** `recordRefund` keeps the shop's books straight
  and says plainly that it moves nothing. When a provider is wired up, its
  refund call belongs immediately before that write.
- **Shipping-confirmation email.** The transport exists (`lib/email`); the
  template does not. Marked `TODO` in `transitionOrder`.
- **Admin UI design.** Next phase.
