# Shrinkless

An online store for organic cotton tees that don't shrink — storefront,
checkout, and a back office to run it from.

Next.js App Router on the server, MongoDB for the data, Stripe for payment,
Cloudinary for photography, Resend for mail.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill it in — see Environment below
npm run dev
```

The site is at http://localhost:3000, the back office at `/admin`.

You need a database before either will load. Point `MONGODB_URI` at an Atlas
cluster, or run one locally:

```bash
npm run dev:db          # a local mongod on 127.0.0.1:27017
npm run seed:shrinkless # the catalogue, categories and site copy
npm run seed:admin      # an admin account to sign in with
```

## Environment

Every variable is documented in [`.env.example`](.env.example). Only two are
required to boot:

| Variable | Required | What it does |
| --- | --- | --- |
| `MONGODB_URI` | yes | Everything is stored here. |
| `AUTH_SECRET` | yes | Signs session cookies. |
| `RESEND_API_KEY`, `EMAIL_FROM` | for admin sign-in | The admin's second factor is emailed. Without it no admin can sign in. |
| `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | for checkout | Without them the checkout page says payments are unavailable rather than failing at the moment someone tries to pay. |
| `CLOUDINARY_*` | for image upload | Product and site photography. Reading existing images needs only the public cloud name. |
| `INSTAGRAM_ACCESS_TOKEN` | optional | The community band — above New arrivals on the homepage, above the footer elsewhere. Without it that band is a plain invitation to follow — see [`docs/instagram.md`](docs/instagram.md). |

Nothing here fails at import time. A missing optional key degrades one feature
and says so, rather than taking the site down.

## Layout

```
app/
  (shop)/       storefront — home, shop, product, cart, checkout
  (account)/    sign in, register, password reset
  (admin)/      the back office
  actions/      server actions, the only write path from the browser
  api/          NextAuth, and the Stripe webhook
components/     admin/ editorial/ shop/ site/ ui/
lib/
  services/     the business logic — everything else is a caller
  db/models/    Mongoose schemas
  validation/   Zod schemas; every server action parses its input
  media/        the crop model shared by the admin and the storefront
  security/     rate limiting, and the throttles around sign-in
scripts/        seeds and one-off maintenance, run with npm run …
tests/unit/     Vitest
docs/           the notes worth keeping
```

Three stylesheets, no component-level CSS: `app/globals.css` holds the tokens
and the reset, `app/storefront.css` the shop, `app/admin.css` the back office.
The admin file is deliberately unlayered so it outranks the base layer.

## Scripts

| Command | |
| --- | --- |
| `npm run dev` | Development server. |
| `npm run build` | Production build. |
| `npm test` | The whole suite, once. |
| `npm run test:watch` | The suite, watching. |
| `npm run lint` | ESLint. |
| `npm run dev:db` | A local MongoDB for development. |
| `npm run seed:shrinkless` | Catalogue, categories and site copy. |
| `npm run seed:admin` | An admin account. |
| `npm run seed:orders` | Sample orders, for the back office. |
| `npm run copy:refresh` | Rewrites product copy from `scripts/product-copy.ts`. |
| `npm run email:test` | Sends one message, to prove the mail path works. |

## Testing

```bash
npm test
```

Vitest, in a Node environment. Model and service tests run against an
in-memory MongoDB, so the suite needs no database of its own — the first run
downloads a mongod binary and is slower for it.

## Deployment

Vercel. Set the environment variables for Production and Preview, then
deploy — they are read at build and request time, so an existing deployment
will not pick up a new one on its own.

Two things need configuring outside the app:

- **The Stripe webhook** must point at `/api/webhooks/stripe`. It is the only
  thing allowed to mark an order paid, so without it every order stays
  `pending`.
- **The Instagram token** expires every 60 days. See
  [`docs/instagram.md`](docs/instagram.md).

## Documentation

- [`docs/admin-functionality.md`](docs/admin-functionality.md) — what the back
  office does, page by page.
- [`docs/instagram.md`](docs/instagram.md) — getting and keeping the token.
- `docs/superpowers/` — the design specs and implementation plans this was
  built from, kept as the record of why things are the way they are.
