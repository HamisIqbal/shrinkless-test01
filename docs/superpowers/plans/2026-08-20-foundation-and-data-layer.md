# Shrinkless Foundation & Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Next.js application and build the complete data layer — seven Mongoose models, Zod schemas, and the products, cart, and settings services — so the app deploys successfully and has a seeded database behind a green test suite.

**Architecture:** One Next.js 16 App Router application. Dependencies flow one way: `app/ → lib/services/ → lib/db/`. Mongoose documents never escape `lib/services`; services return plain serializable DTOs. All money is integer cents. Tests run against `mongodb-memory-server`, so no live Atlas connection is required.

**Tech Stack:** Next.js 16, TypeScript, Tailwind v4, Mongoose, Zod, Vitest, mongodb-memory-server.

**Spec:** `docs/superpowers/specs/2026-08-20-shrinkless-design.md`

## Global Constraints

- **Next.js 16, App Router only.** No `pages/` directory, no `src/` directory.
- **TypeScript strict mode.** No `any` in committed code.
- **Tailwind v4.** Design tokens live in `@theme` inside `app/globals.css`. There is no `tailwind.config.js`.
- **All money is integer cents.** No floats anywhere in the money path. Currency formatting happens only at render time.
- **Components never import Mongoose.** All data access goes through `lib/services/*`.
- **Services return plain serializable DTOs.** Never return Mongoose documents. `_id` becomes a string `id`.
- **Import alias is `@/`** mapping to the project root.
- **No styling in this plan.** Phase 2 markup is unstyled; the design system lands in Phase 6.
- **Commit after every task.**

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/env.ts` | Validates and types environment variables |
| `lib/money.ts` | Integer-cent helpers and currency formatting |
| `lib/db/connection.ts` | Cached Mongoose connection |
| `lib/db/models/*.ts` | One file per collection; schema and model only |
| `lib/validation/*.ts` | Zod schemas shared by client and server |
| `lib/services/products.ts` | Product and variant reads, returns DTOs |
| `lib/services/cart.ts` | Cart mutations, live pricing, guest→account merge |
| `lib/services/settings.ts` | Singleton store settings |
| `types/dto.ts` | Shared DTO types |
| `scripts/seed-*.ts` | Local database seeding |
| `tests/setup/db.ts` | In-memory MongoDB harness |

---

## Task 1: Scaffold the Next.js application

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing
- Produces: a buildable Next.js 16 app with the `@/` import alias

> **Important:** `create-next-app` refuses to run in a directory containing files it doesn't recognise. It tolerates `LICENSE`, `docs/`, and `.gitignore`, but **not** `skills-lock.json`. It also overwrites `.gitignore`, which would drop our custom entries. Steps 1 and 4 handle both.

- [ ] **Step 1: Move the conflicting file aside**

```bash
mv skills-lock.json ../skills-lock.json.bak
cp .gitignore ../gitignore.bak
```

- [ ] **Step 2: Scaffold in place**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm
```

Answer "No" if asked about Turbopack. Expected: the command completes and `package.json` exists.

- [ ] **Step 3: Restore the moved file**

```bash
mv ../skills-lock.json.bak skills-lock.json
```

- [ ] **Step 4: Re-apply our custom gitignore entries**

Append to `.gitignore` (create-next-app wrote its own and dropped ours):

```gitignore
# local tool config (machine-specific)
.claude/settings.local.json
.impeccable/
```

- [ ] **Step 5: Strip the boilerplate homepage**

Replace `app/page.tsx` entirely:

```tsx
export default function HomePage() {
  return (
    <main>
      <h1>Shrinkless</h1>
      <p>Coming soon.</p>
    </main>
  );
}
```

Replace `app/globals.css` entirely (Tailwind v4 — no config file, tokens land here in Phase 6):

```css
@import "tailwindcss";
```

- [ ] **Step 6: Verify the build passes**

Run: `npm run build`
Expected: build completes with no errors, and `/` is listed as a static route.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 16 app with TypeScript and Tailwind v4"
```

---

## Task 2: Test harness

**Files:**
- Create: `vitest.config.mts`, `tests/unit/smoke.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 1's `tsconfig.json` path alias
- Produces: `npm test` runs Vitest with `@/` resolution

- [ ] **Step 1: Install the test dependencies**

```bash
npm install -D vitest mongodb-memory-server
```

- [ ] **Step 2: Write the config**

Create `vitest.config.mts` (the `.mts` extension matters — Vitest 4 loads a plain
`.ts` config as CommonJS and warns about the ESM syntax):

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
```

The 30-second timeout matters: `mongodb-memory-server` downloads a MongoDB binary on its first run, which is slow but happens only once.

- [ ] **Step 3: Add the scripts**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write the failing test**

Create `tests/unit/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('test harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: add Vitest harness with native tsconfig path resolution"
```

---

## Task 3: Environment validation

**Files:**
- Create: `lib/env.ts`, `tests/unit/env.test.ts`, `.env.example`

**Interfaces:**
- Consumes: nothing
- Produces: `loadServerEnv(source?: NodeJS.ProcessEnv): ServerEnv` — throws a listing error if any variable is missing

- [ ] **Step 1: Install Zod**

```bash
npm install zod
```

- [ ] **Step 2: Write the failing test**

Create `tests/unit/env.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadServerEnv } from '@/lib/env';

describe('loadServerEnv', () => {
  it('returns the parsed values when everything is present', () => {
    const env = loadServerEnv({
      MONGODB_URI: 'mongodb://localhost:27017/shrinkless',
      AUTH_SECRET: 'a-secret',
    } as NodeJS.ProcessEnv);

    expect(env.MONGODB_URI).toBe('mongodb://localhost:27017/shrinkless');
  });

  it('throws naming every missing variable', () => {
    expect(() => loadServerEnv({} as NodeJS.ProcessEnv)).toThrowError(
      /MONGODB_URI.*AUTH_SECRET|AUTH_SECRET.*MONGODB_URI/s,
    );
  });

  it('rejects an empty string as missing', () => {
    expect(() =>
      loadServerEnv({ MONGODB_URI: '', AUTH_SECRET: 'x' } as NodeJS.ProcessEnv),
    ).toThrowError(/MONGODB_URI/);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- env`
Expected: FAIL — cannot resolve `@/lib/env`.

- [ ] **Step 4: Implement**

Create `lib/env.ts`:

```ts
import { z } from 'zod';

const serverSchema = z.object({
  MONGODB_URI: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverSchema>;

export function loadServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const parsed = serverSchema.safeParse(source);

  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid or missing environment variables: ${names}`);
  }

  return parsed.data;
}
```

Only the variables needed *now* are validated. Later plans extend this schema as Stripe, PayPal, Cloudinary, and Resend arrive — adding them before they're used would block local development for no reason.

- [ ] **Step 5: Run the tests**

Run: `npm test -- env`
Expected: 3 passed.

- [ ] **Step 6: Document the variables**

Create `.env.example` (committed; `.env.local` is gitignored and never committed):

```bash
MONGODB_URI="mongodb+srv://user:password@cluster.mongodb.net/shrinkless"
AUTH_SECRET="generate with: openssl rand -base64 32"
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add validated environment loading"
```

---

## Task 4: Database connection

**Files:**
- Create: `lib/db/connection.ts`, `tests/setup/db.ts`, `tests/unit/connection.test.ts`

**Interfaces:**
- Consumes: `loadServerEnv` from Task 3
- Produces:
  - `connectToDatabase(uri?: string): Promise<typeof mongoose>`
  - `disconnectFromDatabase(): Promise<void>`
  - `withTestDatabase()` — test helper registering the in-memory server lifecycle

- [ ] **Step 1: Install Mongoose**

```bash
npm install mongoose
```

- [ ] **Step 2: Write the failing test**

Create `tests/unit/connection.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/db/connection';

let server: MongoMemoryServer;

beforeAll(async () => {
  server = await MongoMemoryServer.create();
});

afterAll(async () => {
  await disconnectFromDatabase();
  await server.stop();
});

describe('connectToDatabase', () => {
  it('connects and reuses the same connection on a second call', async () => {
    const first = await connectToDatabase(server.getUri());
    const second = await connectToDatabase(server.getUri());

    expect(first.connection.readyState).toBe(1);
    expect(second).toBe(first);
  });
});
```

Reuse is the point of the test. Next.js hot-reloads modules constantly in development, and without caching, every reload opens a new connection until Atlas refuses them.

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- connection`
Expected: FAIL — cannot resolve `@/lib/db/connection`.

- [ ] **Step 4: Implement**

Create `lib/db/connection.ts`:

```ts
import mongoose from 'mongoose';
import { loadServerEnv } from '@/lib/env';

type ConnectionCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as unknown as { _mongooseCache?: ConnectionCache };

const cache: ConnectionCache = globalForMongoose._mongooseCache ?? { conn: null, promise: null };
globalForMongoose._mongooseCache = cache;

export async function connectToDatabase(uri?: string): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  const resolvedUri = uri ?? loadServerEnv().MONGODB_URI;

  cache.promise ??= mongoose.connect(resolvedUri, { bufferCommands: false });
  cache.conn = await cache.promise;

  return cache.conn;
}

export async function disconnectFromDatabase(): Promise<void> {
  if (!cache.conn) return;

  await mongoose.disconnect();
  cache.conn = null;
  cache.promise = null;
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test -- connection`
Expected: 1 passed.

- [ ] **Step 6: Extract the reusable test harness**

Create `tests/setup/db.ts` — every later model and service test uses this:

```ts
import { afterAll, afterEach, beforeAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/db/connection';

export function withTestDatabase(): void {
  let server: MongoMemoryServer;

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    await connectToDatabase(server.getUri());

    // Mongoose builds indexes asynchronously. Without waiting, a test that
    // expects a duplicate-key error can run before the unique index exists
    // and see the insert succeed instead.
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  });

  afterEach(async () => {
    const { collections } = mongoose.connection;
    await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
  });

  afterAll(async () => {
    await disconnectFromDatabase();
    await server.stop();
  });
}
```

Clearing collections after each test — rather than restarting the server — keeps the suite fast while guaranteeing tests can't leak state into one another.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add cached Mongoose connection and in-memory test harness"
```

---

## Task 5: Money helpers

**Files:**
- Create: `lib/money.ts`, `tests/unit/money.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `formatCents(cents: number, currency?: string): string`
  - `parsePriceToCents(input: string): number` — throws on invalid input

- [ ] **Step 1: Write the failing test**

Create `tests/unit/money.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatCents, parsePriceToCents } from '@/lib/money';

describe('formatCents', () => {
  it('formats whole dollars', () => {
    expect(formatCents(4500)).toBe('$45.00');
  });

  it('formats zero', () => {
    expect(formatCents(0)).toBe('$0.00');
  });

  it('formats amounts over a thousand with a separator', () => {
    expect(formatCents(123456)).toBe('$1,234.56');
  });
});

describe('parsePriceToCents', () => {
  it('parses a decimal string', () => {
    expect(parsePriceToCents('45.00')).toBe(4500);
  });

  it('parses a value with a currency symbol', () => {
    expect(parsePriceToCents('$45.99')).toBe(4599);
  });

  it('rounds to the nearest cent rather than truncating', () => {
    expect(parsePriceToCents('45.005')).toBe(4501);
  });

  it('throws on non-numeric input', () => {
    expect(() => parsePriceToCents('free')).toThrowError(/invalid price/i);
  });

  it('throws on a negative price', () => {
    expect(() => parsePriceToCents('-5.00')).toThrowError(/invalid price/i);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- money`
Expected: FAIL — cannot resolve `@/lib/money`.

- [ ] **Step 3: Implement**

Create `lib/money.ts`:

```ts
export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

export function parsePriceToCents(input: string): number {
  const cleaned = input.replace(/[$,\s]/g, '');
  const value = Number(cleaned);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid price: ${input}`);
  }

  return Math.round(value * 100);
}
```

Division by 100 happens only inside `formatCents`, at the display boundary. Everywhere else in the codebase, money stays an integer.

- [ ] **Step 4: Run the tests**

Run: `npm test -- money`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add integer-cent money helpers"
```

---

## Task 6: Product and Variant models

**Files:**
- Create: `lib/db/models/product.ts`, `lib/db/models/variant.ts`, `tests/unit/models/catalogue.test.ts`

**Interfaces:**
- Consumes: `withTestDatabase` from Task 4
- Produces: `Product` and `Variant` Mongoose models, and the `ProductDoc` / `VariantDoc` types

> **The `models.X ?? model(...)` pattern below is required, not stylistic.** Next.js re-evaluates modules on hot reload, and calling `model()` twice for the same name throws `OverwriteModelError`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/models/catalogue.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { withTestDatabase } from '@/tests/setup/db';
import { Product } from '@/lib/db/models/product';
import { Variant } from '@/lib/db/models/variant';

withTestDatabase();

async function makeProduct() {
  return Product.create({
    title: 'Field Shirt',
    slug: 'field-shirt',
    category: 'shirts',
    status: 'published',
    optionSets: { sizes: ['s', 'm'], colors: ['sand'] },
  });
}

describe('Product model', () => {
  it('defaults to draft status', async () => {
    const product = await Product.create({ title: 'Draft Shirt', slug: 'draft-shirt', category: 'shirts' });
    expect(product.status).toBe('draft');
  });

  it('rejects a duplicate slug', async () => {
    await makeProduct();
    await expect(makeProduct()).rejects.toThrowError(/duplicate key/i);
  });

  it('rejects an unknown status', async () => {
    await expect(
      Product.create({ title: 'X', slug: 'x', category: 'shirts', status: 'archived' }),
    ).rejects.toThrowError(/validation failed/i);
  });
});

describe('Variant model', () => {
  it('rejects a duplicate size and colour on the same product', async () => {
    const product = await makeProduct();
    const base = { productId: product._id, size: 'm', color: 'sand', priceCents: 4500 };

    await Variant.create({ ...base, sku: 'FS-M-SAND' });
    await expect(Variant.create({ ...base, sku: 'FS-M-SAND-2' })).rejects.toThrowError(/duplicate key/i);
  });

  it('rejects a negative price', async () => {
    const product = await makeProduct();
    await expect(
      Variant.create({ productId: product._id, size: 'm', color: 'sand', sku: 'FS-M-2', priceCents: -1 }),
    ).rejects.toThrowError(/validation failed/i);
  });

  it('defaults stock to zero', async () => {
    const product = await makeProduct();
    const variant = await Variant.create({
      productId: product._id, size: 's', color: 'sand', sku: 'FS-S-SAND', priceCents: 4500,
    });
    expect(variant.stock).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- catalogue`
Expected: FAIL — cannot resolve `@/lib/db/models/product`.

- [ ] **Step 3: Implement the Product model**

Create `lib/db/models/product.ts`:

```ts
import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const imageSchema = new Schema(
  {
    publicId: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    alt: { type: String, default: '' },
  },
  { _id: false },
);

const productSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    category: { type: String, required: true, index: true },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    images: { type: [imageSchema], default: [] },
    optionSets: {
      sizes: { type: [String], default: [] },
      colors: { type: [String], default: [] },
    },
  },
  { timestamps: true },
);

export type ProductDoc = InferSchemaType<typeof productSchema>;

export const Product: Model<ProductDoc> =
  (models.Product as Model<ProductDoc>) ?? model<ProductDoc>('Product', productSchema);
```

- [ ] **Step 4: Implement the Variant model**

Create `lib/db/models/variant.ts`:

```ts
import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const variantSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    size: { type: String, required: true, lowercase: true, trim: true },
    color: { type: String, required: true, lowercase: true, trim: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    priceCents: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

variantSchema.index({ productId: 1, size: 1, color: 1 }, { unique: true });

export type VariantDoc = InferSchemaType<typeof variantSchema>;

export const Variant: Model<VariantDoc> =
  (models.Variant as Model<VariantDoc>) ?? model<VariantDoc>('Variant', variantSchema);
```

Price and stock live here, never on the product — this is what makes per-size inventory possible.

- [ ] **Step 5: Run the tests**

Run: `npm test -- catalogue`
Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Product and Variant models with uniqueness constraints"
```

---

## Task 7: Cart model

**Files:**
- Create: `lib/db/models/cart.ts`, `tests/unit/models/cart.test.ts`

**Interfaces:**
- Consumes: `withTestDatabase` from Task 4
- Produces: `Cart` model, `CartDoc` type

- [ ] **Step 1: Write the failing test**

Create `tests/unit/models/cart.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { withTestDatabase } from '@/tests/setup/db';
import { Cart } from '@/lib/db/models/cart';

withTestDatabase();

describe('Cart model', () => {
  it('creates an empty guest cart with a null userId', async () => {
    const cart = await Cart.create({});
    expect(cart.userId).toBeNull();
    expect(cart.items).toHaveLength(0);
  });

  it('rejects a quantity below one', async () => {
    await expect(
      Cart.create({ items: [{ variantId: new Types.ObjectId(), quantity: 0 }] }),
    ).rejects.toThrowError(/validation failed/i);
  });

  it('stores no price on the item', async () => {
    const cart = await Cart.create({ items: [{ variantId: new Types.ObjectId(), quantity: 2 }] });
    expect(cart.items[0]).not.toHaveProperty('priceCents');
  });
});
```

The last test looks odd but is deliberate: it pins the design decision that carts never hold prices, so a stale cart cannot lock in an old one.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- models/cart`
Expected: FAIL — cannot resolve `@/lib/db/models/cart`.

- [ ] **Step 3: Implement**

Create `lib/db/models/cart.ts`:

```ts
import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const cartItemSchema = new Schema(
  {
    variantId: { type: Schema.Types.ObjectId, ref: 'Variant', required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const cartSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true },
);

export type CartDoc = InferSchemaType<typeof cartSchema>;

export const Cart: Model<CartDoc> =
  (models.Cart as Model<CartDoc>) ?? model<CartDoc>('Cart', cartSchema);
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- models/cart`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Cart model with priceless line items"
```

---

## Task 8: User, Order, Payment, and Settings models

**Files:**
- Create: `lib/db/models/user.ts`, `lib/db/models/order.ts`, `lib/db/models/payment.ts`, `lib/db/models/settings.ts`, `tests/unit/models/orders.test.ts`

**Interfaces:**
- Consumes: `withTestDatabase` from Task 4
- Produces: `User`, `Order`, `Payment`, `Settings` models and their `*Doc` types

- [ ] **Step 1: Write the failing test**

Create `tests/unit/models/orders.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { withTestDatabase } from '@/tests/setup/db';
import { User } from '@/lib/db/models/user';
import { Order } from '@/lib/db/models/order';
import { Payment } from '@/lib/db/models/payment';
import { Settings } from '@/lib/db/models/settings';

withTestDatabase();

const orderFixture = {
  orderNumber: 'SHR-1001',
  email: 'buyer@example.com',
  items: [{
    title: 'Field Shirt', size: 'm', color: 'sand', sku: 'FS-M-SAND',
    unitPriceCents: 4500, quantity: 2, imagePublicId: 'shrinkless/field-shirt',
  }],
  shippingAddress: {
    name: 'A Buyer', line1: '1 Main St', city: 'Austin',
    state: 'TX', postalCode: '78701', country: 'US',
  },
  subtotalCents: 9000, shippingCents: 500, taxCents: 743, totalCents: 10243,
};

describe('User model', () => {
  it('defaults to the customer role', async () => {
    const user = await User.create({ email: 'a@b.com', passwordHash: 'hash' });
    expect(user.role).toBe('customer');
  });

  it('rejects a duplicate email', async () => {
    await User.create({ email: 'a@b.com', passwordHash: 'hash' });
    await expect(User.create({ email: 'a@b.com', passwordHash: 'other' })).rejects.toThrowError(/duplicate key/i);
  });
});

describe('Order model', () => {
  it('defaults to pending status', async () => {
    const order = await Order.create(orderFixture);
    expect(order.status).toBe('pending');
  });

  it('keeps the item snapshot independent of the catalogue', async () => {
    const order = await Order.create(orderFixture);
    expect(order.items[0].unitPriceCents).toBe(4500);
    expect(order.items[0].title).toBe('Field Shirt');
  });

  it('rejects a duplicate order number', async () => {
    await Order.create(orderFixture);
    await expect(Order.create(orderFixture)).rejects.toThrowError(/duplicate key/i);
  });
});

describe('Payment model', () => {
  it('rejects a duplicate provider event id', async () => {
    const base = {
      orderId: new Types.ObjectId(), provider: 'stripe',
      providerPaymentId: 'pi_1', providerEventId: 'evt_1',
      amountCents: 10243, status: 'succeeded',
    };
    await Payment.create(base);
    await expect(Payment.create(base)).rejects.toThrowError(/duplicate key/i);
  });
});

describe('Settings model', () => {
  it('allows only one singleton document', async () => {
    await Settings.create({ key: 'store', storeEmail: 'hi@shrinkless.com' });
    await expect(Settings.create({ key: 'store', storeEmail: 'other@shrinkless.com' }))
      .rejects.toThrowError(/duplicate key/i);
  });
});
```

The `providerEventId` uniqueness test is the single most important test in this task — it is the mechanism that stops a replayed webhook from double-decrementing stock and sending duplicate emails.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- models/orders`
Expected: FAIL — cannot resolve `@/lib/db/models/user`.

- [ ] **Step 3: Implement the User model**

Create `lib/db/models/user.ts`:

```ts
import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const addressSchema = new Schema(
  {
    name: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String, default: '' },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true, default: 'US' },
    phone: { type: String, default: '' },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, default: '' },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer', index: true },
    addresses: { type: [addressSchema], default: [] },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema>;
export type AddressDoc = InferSchemaType<typeof addressSchema>;

export const User: Model<UserDoc> =
  (models.User as Model<UserDoc>) ?? model<UserDoc>('User', userSchema);
```

One collection for both roles; `role` is the only distinction. Admins are never self-registered.

- [ ] **Step 4: Implement the Order model**

Create `lib/db/models/order.ts`:

```ts
import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

export const ORDER_STATUSES = [
  'pending', 'paid', 'shipped', 'delivered', 'cancelled', 'payment_failed',
] as const;

const orderItemSchema = new Schema(
  {
    title: { type: String, required: true },
    size: { type: String, required: true },
    color: { type: String, required: true },
    sku: { type: String, required: true },
    unitPriceCents: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    imagePublicId: { type: String, default: '' },
  },
  { _id: false },
);

const statusEventSchema = new Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    actor: { type: String, default: 'system' },
    at: { type: Date, default: () => new Date() },
    note: { type: String, default: '' },
  },
  { _id: false },
);

const shippingAddressSchema = new Schema(
  {
    name: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String, default: '' },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true, default: 'US' },
    phone: { type: String, default: '' },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    items: { type: [orderItemSchema], required: true },
    shippingAddress: { type: shippingAddressSchema, required: true },
    subtotalCents: { type: Number, required: true, min: 0 },
    shippingCents: { type: Number, required: true, min: 0 },
    taxCents: { type: Number, required: true, min: 0 },
    totalCents: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ORDER_STATUSES, default: 'pending', index: true },
    statusHistory: { type: [statusEventSchema], default: [] },
    trackingNumber: { type: String, default: '' },
  },
  { timestamps: true },
);

export type OrderDoc = InferSchemaType<typeof orderSchema>;

export const Order: Model<OrderDoc> =
  (models.Order as Model<OrderDoc>) ?? model<OrderDoc>('Order', orderSchema);
```

Items are snapshots. Editing or deleting a product must never change what a past order says someone bought and paid.

- [ ] **Step 5: Implement the Payment model**

Create `lib/db/models/payment.ts`:

```ts
import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const paymentSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    provider: { type: String, enum: ['stripe', 'paypal'], required: true },
    providerPaymentId: { type: String, required: true, index: true },
    providerEventId: { type: String, required: true, unique: true },
    amountCents: { type: Number, required: true, min: 0 },
    status: { type: String, required: true },
    last4: { type: String, default: '' },
    brand: { type: String, default: '' },
    raw: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export type PaymentDoc = InferSchemaType<typeof paymentSchema>;

export const Payment: Model<PaymentDoc> =
  (models.Payment as Model<PaymentDoc>) ?? model<PaymentDoc>('Payment', paymentSchema);
```

One document per processed webhook event, not per order. **Never store a raw card number here** — `last4` and `brand` only.

- [ ] **Step 6: Implement the Settings model**

Create `lib/db/models/settings.ts`:

```ts
import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const shippingZoneSchema = new Schema(
  {
    name: { type: String, required: true },
    states: { type: [String], default: [] },
    rateCents: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const settingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: 'store' },
    storeEmail: { type: String, required: true },
    announcement: { type: String, default: '' },
    shippingZones: { type: [shippingZoneSchema], default: [] },
    freeShippingThresholdCents: { type: Number, default: null },
    taxMode: { type: String, enum: ['none', 'flat', 'stripe'], default: 'none' },
    flatTaxRateBasisPoints: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

export type SettingsDoc = InferSchemaType<typeof settingsSchema>;

export const Settings: Model<SettingsDoc> =
  (models.Settings as Model<SettingsDoc>) ?? model<SettingsDoc>('Settings', settingsSchema);
```

The unique `key` field is what enforces singleton-ness. Tax rates are stored in **basis points** (integers) rather than percentages, keeping floats out of the money path. The deferred shipping/tax decision lands entirely inside this document.

- [ ] **Step 7: Run the tests**

Run: `npm test -- models/orders`
Expected: 8 passed.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add User, Order, Payment, and Settings models"
```

---

## Task 9: DTO types and Zod schemas

**Files:**
- Create: `types/dto.ts`, `lib/validation/catalogue.ts`, `tests/unit/validation.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `ProductDTO`, `VariantDTO`, `CartViewDTO`, `CartLineDTO`, `SettingsDTO`
  - `productFilterSchema` — parses and normalises URL searchParams

- [ ] **Step 1: Define the DTO types**

Create `types/dto.ts`:

```ts
export type ImageDTO = {
  publicId: string;
  width: number;
  height: number;
  alt: string;
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
};

export type ProductDTO = {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  status: 'draft' | 'published';
  images: ImageDTO[];
  sizes: string[];
  colors: string[];
  variants: VariantDTO[];
  minPriceCents: number;
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
};

export type CartViewDTO = {
  id: string;
  lines: CartLineDTO[];
  subtotalCents: number;
  itemCount: number;
};

export type SettingsDTO = {
  storeEmail: string;
  announcement: string;
  shippingZones: { name: string; states: string[]; rateCents: number }[];
  freeShippingThresholdCents: number | null;
  taxMode: 'none' | 'flat' | 'stripe';
  flatTaxRateBasisPoints: number;
};
```

Every field is a primitive, array, or plain object. No `ObjectId`, no `Date` — these cross the server/client boundary and must survive serialization.

- [ ] **Step 2: Write the failing test**

Create `tests/unit/validation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { productFilterSchema } from '@/lib/validation/catalogue';

describe('productFilterSchema', () => {
  it('applies defaults to an empty query', () => {
    const parsed = productFilterSchema.parse({});
    expect(parsed).toEqual({ sizes: [], colors: [], sort: 'newest' });
  });

  it('splits a comma-separated size list and lowercases it', () => {
    expect(productFilterSchema.parse({ size: 'M,L' }).sizes).toEqual(['m', 'l']);
  });

  it('accepts a single colour', () => {
    expect(productFilterSchema.parse({ color: 'Sand' }).colors).toEqual(['sand']);
  });

  it('falls back to the default sort when given an unknown value', () => {
    expect(productFilterSchema.parse({ sort: 'sideways' }).sort).toBe('newest');
  });

  it('accepts a known sort', () => {
    expect(productFilterSchema.parse({ sort: 'price-asc' }).sort).toBe('price-asc');
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- validation`
Expected: FAIL — cannot resolve `@/lib/validation/catalogue`.

- [ ] **Step 4: Implement**

Create `lib/validation/catalogue.ts`:

```ts
import { z } from 'zod';

const csvToArray = z
  .string()
  .optional()
  .transform((value) =>
    value
      ? value.split(',').map((part) => part.trim().toLowerCase()).filter(Boolean)
      : [],
  );

export const PRODUCT_SORTS = ['newest', 'price-asc', 'price-desc'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const productFilterSchema = z
  .object({
    size: csvToArray,
    color: csvToArray,
    sort: z
      .string()
      .optional()
      .transform((value): ProductSort =>
        PRODUCT_SORTS.includes(value as ProductSort) ? (value as ProductSort) : 'newest',
      ),
  })
  .transform(({ size, color, sort }) => ({ sizes: size, colors: color, sort }));

export type ProductFilter = z.infer<typeof productFilterSchema>;
```

Unknown sort values are coerced to the default rather than throwing. URL parameters are user-controlled, and a hand-edited URL should never produce a 500.

- [ ] **Step 5: Run the tests**

Run: `npm test -- validation`
Expected: 5 passed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add DTO types and catalogue filter validation"
```

---

## Task 10: Products service

**Files:**
- Create: `lib/services/products.ts`, `tests/unit/services/products.test.ts`

**Interfaces:**
- Consumes: `Product`, `Variant` (Task 6), `ProductDTO`/`VariantDTO` (Task 9), `ProductFilter` (Task 9)
- Produces:
  - `listPublishedProducts(filter: ProductFilter, category?: string): Promise<ProductDTO[]>`
  - `getPublishedProductBySlug(slug: string): Promise<ProductDTO | null>`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/services/products.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { withTestDatabase } from '@/tests/setup/db';
import { Product } from '@/lib/db/models/product';
import { Variant } from '@/lib/db/models/variant';
import { getPublishedProductBySlug, listPublishedProducts } from '@/lib/services/products';

withTestDatabase();

const noFilter = { sizes: [], colors: [], sort: 'newest' as const };

async function seedCatalogue() {
  const shirt = await Product.create({
    title: 'Field Shirt', slug: 'field-shirt', category: 'shirts', status: 'published',
    optionSets: { sizes: ['s', 'm'], colors: ['sand'] },
  });
  await Variant.create({ productId: shirt._id, size: 's', color: 'sand', sku: 'FS-S', priceCents: 4500, stock: 3 });
  await Variant.create({ productId: shirt._id, size: 'm', color: 'sand', sku: 'FS-M', priceCents: 5500, stock: 0 });

  const draft = await Product.create({ title: 'Secret', slug: 'secret', category: 'shirts', status: 'draft' });
  await Variant.create({ productId: draft._id, size: 'm', color: 'black', sku: 'SEC-M', priceCents: 9900, stock: 5 });
}

beforeEach(seedCatalogue);

describe('listPublishedProducts', () => {
  it('excludes drafts', async () => {
    const products = await listPublishedProducts(noFilter);
    expect(products.map((p) => p.slug)).toEqual(['field-shirt']);
  });

  it('reports the lowest variant price', async () => {
    const [product] = await listPublishedProducts(noFilter);
    expect(product.minPriceCents).toBe(4500);
  });

  it('returns serializable ids as strings', async () => {
    const [product] = await listPublishedProducts(noFilter);
    expect(typeof product.id).toBe('string');
    expect(typeof product.variants[0].id).toBe('string');
  });

  it('filters by size', async () => {
    expect(await listPublishedProducts({ ...noFilter, sizes: ['xl'] })).toHaveLength(0);
    expect(await listPublishedProducts({ ...noFilter, sizes: ['s'] })).toHaveLength(1);
  });

  it('filters by category', async () => {
    expect(await listPublishedProducts(noFilter, 'hats')).toHaveLength(0);
    expect(await listPublishedProducts(noFilter, 'shirts')).toHaveLength(1);
  });
});

describe('getPublishedProductBySlug', () => {
  it('marks an out-of-stock variant as unavailable but still returns it', async () => {
    const product = await getPublishedProductBySlug('field-shirt');
    const medium = product?.variants.find((v) => v.size === 'm');

    expect(medium?.inStock).toBe(false);
    expect(medium).toBeDefined();
  });

  it('returns null for a draft product', async () => {
    expect(await getPublishedProductBySlug('secret')).toBeNull();
  });

  it('returns null for an unknown slug', async () => {
    expect(await getPublishedProductBySlug('nope')).toBeNull();
  });
});
```

The out-of-stock test encodes a real product decision: sold-out sizes are returned and rendered disabled, never hidden.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- services/products`
Expected: FAIL — cannot resolve `@/lib/services/products`.

- [ ] **Step 3: Implement**

Create `lib/services/products.ts`:

```ts
import { Product, type ProductDoc } from '@/lib/db/models/product';
import { Variant, type VariantDoc } from '@/lib/db/models/variant';
import type { ProductFilter } from '@/lib/validation/catalogue';
import type { ProductDTO, VariantDTO } from '@/types/dto';

type WithId<T> = T & { _id: unknown };

function toVariantDTO(variant: WithId<VariantDoc>): VariantDTO {
  return {
    id: String(variant._id),
    size: variant.size,
    color: variant.color,
    sku: variant.sku,
    priceCents: variant.priceCents,
    stock: variant.stock,
    inStock: variant.stock > 0,
    enabled: variant.enabled,
  };
}

function toProductDTO(product: WithId<ProductDoc>, variants: WithId<VariantDoc>[]): ProductDTO {
  const variantDTOs = variants.map(toVariantDTO);
  const sellable = variantDTOs.filter((v) => v.enabled);

  return {
    id: String(product._id),
    title: product.title,
    slug: product.slug,
    description: product.description,
    category: product.category,
    status: product.status as 'draft' | 'published',
    images: product.images.map((image) => ({
      publicId: image.publicId,
      width: image.width,
      height: image.height,
      alt: image.alt,
    })),
    sizes: product.optionSets.sizes,
    colors: product.optionSets.colors,
    variants: variantDTOs,
    minPriceCents: sellable.length ? Math.min(...sellable.map((v) => v.priceCents)) : 0,
  };
}

async function loadVariantsByProduct(productIds: unknown[]) {
  const variants = await Variant.find({ productId: { $in: productIds } }).lean();
  const grouped = new Map<string, WithId<VariantDoc>[]>();

  for (const variant of variants as WithId<VariantDoc>[]) {
    const key = String(variant.productId);
    grouped.set(key, [...(grouped.get(key) ?? []), variant]);
  }

  return grouped;
}

export async function listPublishedProducts(
  filter: ProductFilter,
  category?: string,
): Promise<ProductDTO[]> {
  const query: Record<string, unknown> = { status: 'published' };
  if (category) query.category = category;

  const products = (await Product.find(query).lean()) as WithId<ProductDoc>[];
  const grouped = await loadVariantsByProduct(products.map((p) => p._id));

  const dtos = products.map((product) =>
    toProductDTO(product, grouped.get(String(product._id)) ?? []),
  );

  const matching = dtos.filter((product) => {
    const sizeOk =
      !filter.sizes.length || product.variants.some((v) => v.enabled && filter.sizes.includes(v.size));
    const colorOk =
      !filter.colors.length || product.variants.some((v) => v.enabled && filter.colors.includes(v.color));
    return sizeOk && colorOk;
  });

  if (filter.sort === 'price-asc') {
    return matching.sort((a, b) => a.minPriceCents - b.minPriceCents);
  }
  if (filter.sort === 'price-desc') {
    return matching.sort((a, b) => b.minPriceCents - a.minPriceCents);
  }
  return matching.reverse();
}

export async function getPublishedProductBySlug(slug: string): Promise<ProductDTO | null> {
  const product = (await Product.findOne({ slug, status: 'published' }).lean()) as WithId<ProductDoc> | null;
  if (!product) return null;

  const variants = (await Variant.find({ productId: product._id }).lean()) as WithId<VariantDoc>[];
  return toProductDTO(product, variants);
}
```

`.lean()` is used everywhere — it returns plain objects instead of hydrated Mongoose documents, which is both faster and exactly what a DTO boundary wants.

- [ ] **Step 4: Run the tests**

Run: `npm test -- services/products`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add products service returning serializable DTOs"
```

---

## Task 11: Cart service

**Files:**
- Create: `lib/services/cart.ts`, `tests/unit/services/cart.test.ts`

**Interfaces:**
- Consumes: `Cart` (Task 7), `Variant` (Task 6), `Product` (Task 6), `CartViewDTO` (Task 9)
- Produces:
  - `createCart(userId?: string | null): Promise<string>`
  - `addItemToCart(cartId, variantId, quantity): Promise<CartViewDTO>` — throws on insufficient stock
  - `updateCartItemQuantity(cartId, variantId, quantity): Promise<CartViewDTO>` — quantity 0 removes
  - `getCartView(cartId): Promise<CartViewDTO | null>`
  - `mergeGuestCartIntoUserCart(guestCartId, userId): Promise<string>`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/services/cart.test.ts`:

```ts
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
```

The merge test pins two decisions at once: quantities are summed rather than replaced, and the sum is capped at real stock so a merge can never create an unfulfillable cart.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- services/cart`
Expected: FAIL — cannot resolve `@/lib/services/cart`.

- [ ] **Step 3: Implement**

Create `lib/services/cart.ts`:

```ts
import { Types } from 'mongoose';
import { Cart } from '@/lib/db/models/cart';
import { Product } from '@/lib/db/models/product';
import { Variant } from '@/lib/db/models/variant';
import type { CartLineDTO, CartViewDTO } from '@/types/dto';

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) throw new Error(`Invalid id: ${id}`);
  return new Types.ObjectId(id);
}

export async function createCart(userId: string | null = null): Promise<string> {
  const cart = await Cart.create({ userId: userId ? toObjectId(userId) : null });
  return String(cart._id);
}

export async function getCartView(cartId: string): Promise<CartViewDTO | null> {
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

export async function addItemToCart(
  cartId: string,
  variantId: string,
  quantity: number,
): Promise<CartViewDTO> {
  const variant = await requireVariant(variantId);
  const cart = await Cart.findById(toObjectId(cartId));
  if (!cart) throw new Error(`Cart not found: ${cartId}`);

  const existing = cart.items.find((item) => String(item.variantId) === variantId);
  const desired = (existing?.quantity ?? 0) + quantity;

  if (desired > variant.stock) {
    throw new Error(`Insufficient stock: only ${variant.stock} available`);
  }

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
  const cart = await Cart.findById(toObjectId(cartId));
  if (!cart) throw new Error(`Cart not found: ${cartId}`);

  if (quantity <= 0) {
    cart.items = cart.items.filter((item) => String(item.variantId) !== variantId);
  } else {
    const variant = await requireVariant(variantId);
    if (quantity > variant.stock) {
      throw new Error(`Insufficient stock: only ${variant.stock} available`);
    }

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

    if (existing) {
      existing.quantity = capped;
    } else {
      userCart.items.push({ variantId: guestItem.variantId, quantity: capped });
    }
  }

  await userCart.save();
  await Cart.deleteOne({ _id: guestCart._id });

  return String(userCart._id);
}
```

`getCartView` recomputes every price from the variant on every call. That is what makes the "carts hold no prices" rule real rather than aspirational.

- [ ] **Step 4: Run the tests**

Run: `npm test -- services/cart`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add cart service with live pricing and guest cart merge"
```

---

## Task 12: Settings service

**Files:**
- Create: `lib/services/settings.ts`, `tests/unit/services/settings.test.ts`

**Interfaces:**
- Consumes: `Settings` (Task 8), `SettingsDTO` (Task 9)
- Produces: `getStoreSettings(): Promise<SettingsDTO>` — creates defaults if absent

- [ ] **Step 1: Write the failing test**

Create `tests/unit/services/settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { withTestDatabase } from '@/tests/setup/db';
import { Settings } from '@/lib/db/models/settings';
import { getStoreSettings } from '@/lib/services/settings';

withTestDatabase();

describe('getStoreSettings', () => {
  it('creates a default document when none exists', async () => {
    const settings = await getStoreSettings();

    expect(settings.taxMode).toBe('none');
    expect(settings.shippingZones).toEqual([]);
    expect(await Settings.countDocuments()).toBe(1);
  });

  it('does not create a second document on a repeat call', async () => {
    await getStoreSettings();
    await getStoreSettings();

    expect(await Settings.countDocuments()).toBe(1);
  });

  it('returns the stored values once configured', async () => {
    await Settings.create({
      key: 'store', storeEmail: 'hi@shrinkless.com', taxMode: 'flat',
      flatTaxRateBasisPoints: 825, freeShippingThresholdCents: 10000,
      shippingZones: [{ name: 'Domestic', states: [], rateCents: 500 }],
    });

    const settings = await getStoreSettings();
    expect(settings.flatTaxRateBasisPoints).toBe(825);
    expect(settings.shippingZones[0].rateCents).toBe(500);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- services/settings`
Expected: FAIL — cannot resolve `@/lib/services/settings`.

- [ ] **Step 3: Implement**

Create `lib/services/settings.ts`:

```ts
import { Settings } from '@/lib/db/models/settings';
import type { SettingsDTO } from '@/types/dto';

const DEFAULT_STORE_EMAIL = 'orders@shrinkless.com';

export async function getStoreSettings(): Promise<SettingsDTO> {
  const settings = await Settings.findOneAndUpdate(
    { key: 'store' },
    { $setOnInsert: { key: 'store', storeEmail: DEFAULT_STORE_EMAIL } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean();

  // `upsert: true` with `returnDocument: 'after'` always returns a document, but the
  // Mongoose types cannot express that, so narrow it explicitly.
  if (!settings) throw new Error('Failed to load store settings');

  return {
    storeEmail: settings.storeEmail,
    announcement: settings.announcement,
    shippingZones: settings.shippingZones.map((zone) => ({
      name: zone.name,
      states: zone.states,
      rateCents: zone.rateCents,
    })),
    freeShippingThresholdCents: settings.freeShippingThresholdCents ?? null,
    taxMode: settings.taxMode as 'none' | 'flat' | 'stripe',
    flatTaxRateBasisPoints: settings.flatTaxRateBasisPoints,
  };
}
```

The upsert means no seed step is required for settings and no caller ever has to handle a missing document.

- [ ] **Step 4: Run the tests**

Run: `npm test -- services/settings`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add settings service with self-creating defaults"
```

---

## Task 13: Seed scripts

**Files:**
- Create: `scripts/seed-products.ts`, `scripts/seed-admin.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: all models, `connectToDatabase` (Task 4)
- Produces: `npm run seed:products`, `npm run seed:admin`

- [ ] **Step 1: Install the runner and argon2**

```bash
npm install -D tsx
npm install @node-rs/argon2
```

`@node-rs/argon2` is the argon2 implementation used from Phase 3 onward for real authentication. It is introduced here so the seeded admin has a valid password hash rather than a placeholder.

- [ ] **Step 2: Add the scripts**

In `package.json`, add to `"scripts"`:

```json
"seed:products": "tsx scripts/seed-products.ts",
"seed:admin": "tsx scripts/seed-admin.ts"
```

- [ ] **Step 3: Write the product seed**

Create `scripts/seed-products.ts`:

```ts
import 'dotenv/config';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/db/connection';
import { Product } from '@/lib/db/models/product';
import { Variant } from '@/lib/db/models/variant';

const SIZES = ['s', 'm', 'l', 'xl'];

const CATALOGUE = [
  { title: 'Field Shirt', slug: 'field-shirt', category: 'shirts', colors: ['sand', 'black'], priceCents: 8500 },
  { title: 'Shop Tee', slug: 'shop-tee', category: 'shirts', colors: ['bone'], priceCents: 4500 },
  { title: 'Press Overshirt', slug: 'press-overshirt', category: 'shirts', colors: ['navy', 'sand'], priceCents: 12500 },
];

async function main() {
  await connectToDatabase();

  await Variant.deleteMany({});
  await Product.deleteMany({});

  for (const entry of CATALOGUE) {
    const product = await Product.create({
      title: entry.title,
      slug: entry.slug,
      description: `${entry.title} — heavyweight cotton, cut for everyday wear.`,
      category: entry.category,
      status: 'published',
      optionSets: { sizes: SIZES, colors: entry.colors },
    });

    for (const color of entry.colors) {
      for (const size of SIZES) {
        await Variant.create({
          productId: product._id,
          size,
          color,
          sku: `${entry.slug.toUpperCase()}-${color.toUpperCase()}-${size.toUpperCase()}`,
          priceCents: entry.priceCents,
          stock: size === 'xl' ? 0 : 10,
        });
      }
    }

    console.log(`seeded ${entry.slug} (${entry.colors.length * SIZES.length} variants)`);
  }

  await disconnectFromDatabase();
}

main().catch(async (error) => {
  console.error(error);
  await disconnectFromDatabase();
  process.exit(1);
});
```

Every XL is seeded with zero stock deliberately, so the disabled-not-hidden behaviour is visible the moment the storefront is built in Phase 2.

- [ ] **Step 4: Write the admin seed**

Create `scripts/seed-admin.ts`:

```ts
import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/db/connection';
import { User } from '@/lib/db/models/user';

async function main() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error('Usage: npm run seed:admin -- <email> <password>');
    process.exit(1);
  }

  await connectToDatabase();

  const passwordHash = await hash(password);
  await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { $set: { passwordHash, role: 'admin' }, $setOnInsert: { email: email.toLowerCase() } },
    { upsert: true, returnDocument: 'after' },
  );

  console.log(`admin ready: ${email}`);
  await disconnectFromDatabase();
}

main().catch(async (error) => {
  console.error(error);
  await disconnectFromDatabase();
  process.exit(1);
});
```

This script is the **only** way an admin comes into existence. There is no self-signup path to the admin role, by design.

- [ ] **Step 5: Verify against a real database**

Set `MONGODB_URI` in `.env.local`, then run:

```bash
npm run seed:products
npm run seed:admin -- admin@shrinkless.com "a-strong-password"
```

Expected: three products seeded with their variant counts, then `admin ready:`.

If `tsx` cannot resolve the `@/` alias, add `"tsx": { "tsconfig": "./tsconfig.json" }` handling by running the scripts with `tsx --tsconfig tsconfig.json` instead.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add product and admin seed scripts"
```

---

## Task 14: Full verification

**Files:**
- Modify: none (verification only)

**Interfaces:**
- Consumes: everything above
- Produces: a verified green build ready for Phase 2

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all tests pass across env, money, connection, validation, models, and services. No skipped tests.

- [ ] **Step 2: Run the type checker**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the linter**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Run the production build**

Run: `npm run build`
Expected: build completes.

- [ ] **Step 5: Confirm the deploy**

Push and confirm the Vercel deployment succeeds and `/` renders "Shrinkless — Coming soon" instead of a 404.

```bash
git push origin main
```

Set `MONGODB_URI` and `AUTH_SECRET` in the Vercel project's environment variables first. The build does not connect to the database, but Phase 2 will.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "chore: verify foundation and data layer"
```

---

## Definition of Done

- [ ] `npm test` passes with real coverage of models, services, and helpers
- [ ] `npx tsc --noEmit` is clean
- [ ] `npm run build` succeeds
- [ ] The Vercel deploy serves a page instead of a 404
- [ ] `npm run seed:products` and `npm run seed:admin` populate a real Atlas database
- [ ] No Mongoose import exists anywhere under `app/`
- [ ] No floating-point arithmetic exists anywhere in the money path

## Not In This Plan

Deferred to the phases that consume them:

| Deferred | Lands in |
|---|---|
| Users service | Phase 3 (auth) |
| Orders and payments services | Phase 5 (checkout) |
| `lib/pricing` | Phase 5 (checkout) |
| Any UI beyond the placeholder homepage | Phase 2 |
| Design tokens, fonts, texture, motion | Phase 6 |
