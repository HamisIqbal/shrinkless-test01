# Shrinkless — planning handoff (2026-08-20)

Session paused mid-brainstorm. Resume from "Next step" below.

## Path
Architectural brainstorming (superpowers): questions -> approaches -> sectioned design -> written spec -> writing-plans -> implementation.

## Decisions locked (do not re-ask)
| Topic | Decision |
|---|---|
| V1 scope | Full store, single brand. Shirts w/ variants, cart, guest + account checkout, Stripe + PayPal, order emails, admin panel. No reviews/wishlist/blog/multi-vendor. |
| Auth | One `users` collection + `role` field ('customer'\|'admin'); Auth.js v5 credentials, argon2, JWT cookie. Admins seeded/promoted, never self-signup. |
| Payments | Custom on-brand checkout: Stripe Payment Element + PayPal JS Buttons. Webhook-confirmed orders. No raw card storage (PCI) — tokens + last4 only. |
| Stack | Next.js 16 App Router, TypeScript, Tailwind v4 + vintage tokens, Mongoose, Zod, Motion + Lenis. |
| Fulfillment | Own stock, variant-level inventory (size x color; per-variant SKU/price/stock). |
| Vintage direction | 1970s workwear / heritage print shop. Condensed grotesque + slab serif, letterpress ink texture, halftone photography, hairline rules, warm off-white paper stock, white/black base. |
| Infra | Vercel + MongoDB Atlas + Cloudinary + Resend. |

## Open item
Shipping & tax rules — US-based store, user will decide later. Designed as a pluggable pricing module; default flat-rate zones + free-shipping threshold, Stripe Tax as a documented swap-in. Not blocking.

## Design sections
1. **Architecture & data model — APPROVED 2026-08-20.**
   - One Next.js app, route groups `(shop)` / `(account)` / `(admin)`.
   - Components never touch Mongoose; all data access via `lib/services/*` returning serializable DTOs. Server Actions/Route Handlers stay thin (Zod validate -> service -> result).
   - `proxy.ts` (Next 16 renamed `middleware` -> `proxy`) gates `/admin/*` by role AND every admin action re-checks role server-side.
   - 7 collections: `users`, `products`, `variants`, `carts`, `orders`, `payments`, `settings`.
   - Order items are denormalized snapshots; all money stored as integer cents.
2. **Storefront UX + vintage design system — APPROVED 2026-08-20.** Mini-cart drawer is the primary add-to-cart surface; filters live in a horizontal bar above the grid, held in searchParams.
3. **Admin panel — APPROVED 2026-08-20.** Own dense layout sharing storefront tokens (no texture/motion); auto-generated variant matrix in the product editor; signed direct-to-Cloudinary uploads; refunds link out to Stripe/PayPal; stock decrements on webhook confirmation, no cart reservations; `/admin` dashboard kept.
4. **Checkout & payment flow — APPROVED 2026-08-20.** Single-page `/checkout` with progressive sections; `lib/pricing` pure function is the only amount source; webhook-confirmed orders for both providers; event-ID unique index for idempotency; `/checkout/processing` polls rather than trusting the redirect. Apple Pay / Google Pay enabled via Payment Element; checkout uses a focused shell (no full header/footer).
5. **Roadmap, phases & directory structure — APPROVED 2026-08-20.**

## Next step

Phases 0–4 are DONE. The **Phase 6 design pass has also been pulled forward** and
applied; Phase 5 (checkout and payments) is the only thing standing between this
build and taking money.

### Phase 4 — admin panel (complete)

All 12 tasks landed on `phase-4-admin-panel`:

1–7 (previous session): role guards + `proxy.ts`, admin shell, admin product
DTOs/read services, pure variant matrix, product write service with variant
reconciliation, product list + editor UI, signed direct-to-Cloudinary uploads.

8. `lib/services/orders.ts` — `canTransition` (pure), `listOrders`,
   `getOrderById`, `transitionOrder`, `listOrdersForUser`, `InvalidTransitionError`.
   Spec §7.4 transition table; every move appends to `statusHistory` with the
   actor. Plus `scripts/seed-orders.ts` and `npm run seed:orders`.
9. Orders UI: `/admin/orders`, `/admin/orders/[id]`, `transitionOrderAction`,
   `FulfillmentPanel`. Refunds deep-link to Stripe/PayPal, as specified.
10. Customers (read-only): `listCustomers`, `getCustomerDetail`,
    `/admin/customers`, `/admin/customers/[id]`. Lifetime value counts only
    `paid | shipped | delivered`. No role control anywhere, by design.
11. Store settings: `settingsInputSchema`, `updateStoreSettings`,
    `saveSettingsAction`, `SettingsForm`, `/admin/settings`.
12. Dashboard: `lib/services/stats.ts` (`getAdminStats`, injectable `now`),
    rendered at `/admin`.

### Design pass (Phase 6, applied early)

Tokens live in `app/globals.css` under Tailwind v4 `@theme` and are the single
source of truth; `app/storefront.css` and `app/admin.css` consume them and
invent no colours of their own.

- Oswald (condensed grotesque) for headings/nav, Zilla Slab for body, tabular
  numerals everywhere money appears. Fixed six-step scale, no fluid clamps.
- Warm kraft paper stock, warm near-black ink (never `#000`), one saturated
  spot ink reserved for price, sale flags and the primary button.
- Generated SVG paper grain over the storefront; the admin is explicitly
  exempt (`body:has(.admin)::before { display: none }`) per spec §3.
- 12-column grid collapsing to 4, catalogue label rails, hairline rules, no
  shadows, no rounded corners.
- Signature device: the **spec strip** — four fixed workwear-tag fields
  (Fabric / Weight / Cut / Run) printed hairline-ruled under the hero.
- Entrance reveals run through `components/ui/Reveal.tsx` (Motion's
  `whileInView`, `once: true`, capped 40ms stagger); `components/ui/SmoothScroll.tsx`
  mounts Lenis in the `(shop)` layout only. Both bail out entirely under
  `prefers-reduced-motion` rather than merely shortening.

Spec §6 is now met in full: `motion` and `lenis` are installed and the CSS-only
`.reveal` / `.reveal-list` keyframes are gone. Lenis' own stylesheet rules are
inlined at the foot of `app/globals.css` (no import, so nothing crosses into the
admin bundle). The admin stays motion-free by construction — neither component
is mounted under `(admin)`.

Also added this pass: `app/error.tsx` (a global error boundary that names a
failed database connection specifically, since that was surfacing as a blank
screen) and `app/not-found.tsx`, both styled with `.errorpage` in
`app/storefront.css`.

### Verified

- `npx tsc --noEmit` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeds; all 12 admin routes and the storefront compile.
  Compiled CSS carries every design class and token.
- `npm run test` — **24 files, 158 tests, all green** (2026-08-21), including
  Tasks 8–12. See the mongodb-memory-server note under Gotchas.

### NOT verified

- **Runtime walkthrough is now partly done** (2026-08-21), against a *local*
  database rather than Atlas — see "Running locally" below. Verified serving
  real data: `/` 200 with hero, spec strip and three seeded products, `/shop`
  200 with the same grid, `/product/field-shirt` 200, `/cart` 200, `/login`
  200, an unknown path 404s into `app/not-found.tsx`, and `/admin` 307s to
  `/login?from=%2Fadmin` for a signed-out visitor. Dev log clean.
  Still owed: signed-in admin walkthrough of the 12 admin routes, the
  step-8 proxy-bypass proof (a *customer*-role session hitting `/admin`), and
  a real add-to-cart/checkout pass in a browser.
- Guest -> account cart merge (carried over from Phase 3) is still unproven in
  a browser.

### Redesign (Phase 6) — SHIPPED 2026-08-21

The storefront has been rebuilt to the monochrome editorial direction in
`2026-08-21-shrinkless-redesign-design.md`. Live on `main`. 211 tests green,
`tsc` and lint clean, 21 routes build, every page smoke-tested against a local
database.

**One thing is outstanding and it is data, not code:** production Atlas still
holds the old vintage catalogue (Field Shirt, Press Overshirt, Shop Tee in
sand/bone/navy). The redesign is live but showing those products. Running
`npm run seed:shrinkless` against Atlas replaces them with the Organic Tee in
black/white/charcoal — it needs a machine whose IP is on the Atlas access list,
which this one is not.

Also outstanding, all recorded in spec §11: the $48 price is an assumption, the
`[TBC]` markers in the FAQ and PDP accordions need real numbers, the
testimonials are placeholders, and every photograph is Unsplash stock rendered
black and white — no Shrinkless product appears anywhere on the site yet.

### Production (live 2026-08-21)

`main` is deployed at **https://shrinkless.vercel.app** and serving real Atlas
data — `/`, `/shop`, `/product/[slug]`, `/cart`, `/login`, `/register` and
`/api/auth/*` all 200, `/admin` 307s a signed-out visitor to `/login`, unknown
paths 404. Eight consecutive `/shop` requests, all 200.

Getting there turned up three things worth keeping:

- **A rejected `mongoose.connect()` used to stay in the module cache**, so one
  failed cold start poisoned that serverless instance for its whole life. Fixed
  in `lib/db/connection.ts`; regression test in `tests/unit/connection.test.ts`.
- **`app/error.tsx` cannot catch a throw from `app/(shop)/layout.tsx`.** A
  layout's errors bubble past the boundary beside it, so a database outage
  reached the browser as a bare Next 500. `app/global-error.tsx` is the backstop
  and deliberately inlines its styles.
- **Vercel env vars were present but empty**, which read as
  `Invalid or missing environment variables: MONGODB_URI, AUTH_SECRET` plus
  Auth.js `MissingSecret`. Note Atlas was never the problem in production —
  the app threw before opening a socket.

### Running locally

**Atlas is currently unreachable from this machine** and that is not a code
bug: all three shards close the connection with `SSL alert number 80` during
the TLS handshake, which is how Atlas rejects an IP that is not on its access
list. Mongoose reports it as `MongooseServerSelectionError`, and `app/error.tsx`
now surfaces it as "Cannot reach the database" instead of a blank page. Fix:
Atlas -> Network Access -> Add IP Address (this machine was `119.73.19.40` on
2026-08-21), then re-enable the Atlas `MONGODB_URI` line in `.env.local`.

Until then, `.env.local` points at a local database:

```
npm run dev:db      # scripts/dev-db.mjs — mongod on :27017, data in .mongo-data/
npm run seed:products
npm run seed:admin -- <email> <password>
npm run dev
```

`dev:db` reuses the MongoDB binary `mongodb-memory-server` caches for the tests,
but with a persistent `dbPath`, so seeded data survives a restart. It is a
standalone server, not a replica set — fine until something needs transactions.

### Gotchas found this phase

- Mongoose 9 types query filters against the schema literal union. A
  `const X = ['paid', 'shipped']` widens to `string[]` and fails
  `$in`; annotate as `OrderStatus[]`. Same for test seed helpers — typing a
  `status` parameter as `string` will not compile.
- `PageProps<'/admin/orders/[id]'>` does not exist until route types are
  regenerated. Run `npx next typegen` after adding a dynamic route.
- `mongodb-memory-server` cannot finish its own download here: the ~820MB
  MongoDB 8.2.6 zip takes longer than the 60s `beforeAll` hook, so every run
  restarted a partial and every db-backed suite timed out. Fixed by fetching
  the archive once with `curl -C -` and dropping the binary where the library
  looks for it: `~/.cache/mongodb-binaries/mongod-x64-win32-8.2.6.exe`
  (`mongod-<arch>-<os>-<version>[.exe]`). No config change; it is a machine-local
  cache, so a fresh machine needs the same one-off.
- Mongoose marks `createdAt` **immutable** under `timestamps: true`, so
  `Model.updateOne({ $set: { createdAt } })` is dropped *silently* — the stats
  tests looked like service bugs when the seed data was simply never backdated.
  Backdate through `Model.collection.updateOne` (raw driver).
- **Do not pipe a secret into `vercel env add` from Windows PowerShell.**
  `Get-Content -Raw | npx vercel env add ...` corrupted the connection string —
  the next deploy failed with `MongoParseError: Invalid scheme`. Use a shell
  redirect so the bytes arrive untouched:
  `cmd /c "npx vercel env add NAME production < value.txt"`, with the file
  written BOM-less and without a trailing newline. Env changes need a
  `vercel redeploy` before they take effect.
- `tests/setup/db.ts` used to crash in `afterAll` with "Cannot read properties
  of undefined (reading 'stop')" when `MongoMemoryServer.create()` failed,
  masking the real error. `server` is now optional and stopped with `?.`.

### Next: Phase 5 — checkout and payments

`lib/pricing`, `/checkout`, Stripe Payment Element, PayPal Buttons, both
webhooks, event-ID idempotency, `/checkout/processing` polling, order emails via
Resend. Riskiest phase; give it its own branch.

Note `/cart` already links to `/checkout`, which does not exist yet — that link
404s until Phase 5 lands.

---

## 2026-08-24 — image-led storefront rebuild

The storefront was rebuilt around photography and a six-product catalogue.
Live at https://shrinkless.vercel.app.

### What changed structurally

- **Photography is no longer monochrome.** `sat=-100` was appended to every URL
  in `lib/brand/images.ts`, so the black and white was in the *data*, not the
  CSS. It is gone and `tests/unit/images.test.ts` fails if it returns. Frames
  now carry an optional `focus` (`object-position`), because a wide hero crops
  a portrait source to a narrow band and the default centre lands it on the
  model's chin rather than the garment.
- **Catalogue: 1 product → 6**, across two real categories (`men`, `women`).
  `scripts/seed-shrinkless.ts` is the source of truth and reads
  `PRODUCT_IMAGES` keyed by slug. Colours are positional against that array —
  reorder one without the other and the black tee gets the white photograph.
- **`featured` is a new product field**, set in the admin editor. The homepage
  "Featured" band reads it. Deliberately not "best sellers": there is no sales
  history, so ranking would have been invented.
- **`lib/shop/navigation.ts` must stay free of service imports.** `Header` is a
  client component and imports `PRIMARY_NAV` from it; the DB query lives in
  `lib/shop/menu.server.ts`. Merging them drags mongoose into the browser
  bundle and the build fails.

### Two traps worth knowing about

- **globals.css rules sit in `@layer shrinkless-base`.** `@import` must come
  first in a stylesheet, which meant every rule in globals.css was *later* in
  the cascade than all of storefront.css — 85 class pairs collided, and
  `.masthead__search { display: none }` silently lost to `.ulink`. If you
  unwrap that layer, the mobile header sprouts desktop utilities again.
- **Never branch rendered output on `useReducedMotion()`.** It cannot know the
  preference during SSR, so it returns `false` on the server and the truth on
  the client — every component that branched hydrated mismatched, and `Reveal`
  mismatched *structurally* by swapping `<div>` for `<motion.div>`. Policy now
  lives in one `<MotionConfig reducedMotion="user">`
  (`components/ui/Motion.tsx`). The hook is still fine inside effects, which is
  how the hero suppresses its auto-advance.
- **`.hero__stack` needs `z-index: 0`.** It makes the stack its own stacking
  context so the slide z-indices compete only with each other. Without it the
  active frame paints over the scrim and the entire headline.

### Still open

- `/cart` still links to `/checkout`, which still does not exist. Unchanged by
  this work and still the biggest gap — see Phase 5 above.
- All photography is Unsplash placeholder. Every frame was opened and checked
  for competitor wordmarks before use, but it is still someone else's garment.
- Prices, fabric weights and the `[TBC]` claims on the product page are
  assumptions and need the real numbers.
- Reviews on the homepage are labelled "Placeholder review" verbatim.
