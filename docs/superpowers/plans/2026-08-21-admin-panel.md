# Shrinkless Admin Panel Implementation Plan (Phase 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give an admin a working back office — product editor with an auto-generated variant matrix, direct-to-Cloudinary image uploads, order fulfillment, read-only customers, store settings, and a dashboard — all reachable only by `role === 'admin'`.

**Architecture:** A new `(admin)` route group with its own dense layout. `proxy.ts` turns anonymous and customer traffic away from `/admin/*` as a convenience; the real boundary is `requireAdminActor()` / `requireAdminPage()` called inside every admin page and every admin Server Action. All data access continues to flow `app/ → lib/services/ → lib/db/`; the two genuinely tricky pieces — variant-matrix reconciliation and the Cloudinary signature — are extracted as pure modules (`lib/admin/variant-matrix.ts`, `lib/cloudinary/signature.ts`) so they can be tested exhaustively without a request or a network.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts`), Auth.js v5 beta.32, Mongoose 9, Zod 4, Vitest 4 + `mongodb-memory-server`, Node `crypto` (no Cloudinary SDK).

**Spec:** `docs/superpowers/specs/2026-08-20-shrinkless-design.md` (sections 3.2, 4, 7, 10)

## Global Constraints

- **The proxy is not the security boundary.** Next's own docs: proxy "should not be used as a full session management or authorization solution", and a matcher change or a Server Function moving route can silently remove proxy coverage. Every admin page AND every admin Server Action re-reads the session and re-checks the role server-side. No exceptions.
- **Roles are never self-assigned.** Nothing in this phase writes `role`. Admins come only from `scripts/seed-admin.ts`.
- **Components never import Mongoose.** All data access goes through `lib/services/*`, which return plain serializable DTOs. Dates cross the boundary as ISO strings, never as `Date` objects.
- **All money is integer cents.** No floats in the money path. `formatCents` from `lib/money.ts` at render time only.
- **Variants are never deleted.** Carts hold `variantId` references and orders were priced from them; a combination removed from the option sets is disabled, not destroyed.
- **No image bytes touch our server.** The browser uploads straight to Cloudinary with a signature minted by a Server Action. We store `public_id`, width, height, alt.
- **Refunds are out of scope.** Order detail deep-links to the Stripe/PayPal dashboard.
- **Emails are Phase 5.** Mark-as-shipped records the transition and tracking number; the Resend call is a documented TODO, not a stub module.
- **NO STYLING.** Semantic HTML and layout only. The vintage design system lands in Phase 6.
- **Commit after every task.** Run `npx tsc --noEmit` and `npm run lint` before each commit.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/auth/guards.ts` | `isAdminSession` (pure), `requireAdminPage`, `requireAdminActor`, `NotAuthorizedError` |
| `proxy.ts` | Optimistic redirect of non-admins away from `/admin/*` |
| `lib/admin/variant-matrix.ts` | Pure SKU derivation + matrix generation/reconciliation |
| `lib/validation/product.ts` | Zod schemas for the product editor payload |
| `lib/validation/settings.ts` | Zod schema for the settings form |
| `lib/cloudinary/signature.ts` | Pure signature payload + SHA-1 signing, env loading |
| `lib/cloudinary/config.ts` | Upload folder and endpoint |
| `lib/cloudinary/url.ts` | Transform-URL helper used by admin thumbnails |
| `lib/services/products.ts` | *(extended)* admin listing, admin fetch by id, save |
| `lib/services/orders.ts` | Order listing, detail, and status transitions |
| `lib/services/users.ts` | *(extended)* customer listing and customer detail |
| `lib/services/settings.ts` | *(extended)* `updateStoreSettings` |
| `lib/services/stats.ts` | Dashboard metrics |
| `types/dto.ts` | *(extended)* admin DTOs |
| `app/(admin)/layout.tsx` | Admin shell: role gate + sidebar |
| `app/(admin)/admin/page.tsx` | Dashboard |
| `app/(admin)/admin/products/page.tsx` | Product table |
| `app/(admin)/admin/products/new/page.tsx` | New-product editor |
| `app/(admin)/admin/products/[id]/page.tsx` | Edit-product editor |
| `app/(admin)/admin/orders/page.tsx` | Order table |
| `app/(admin)/admin/orders/[id]/page.tsx` | Order detail + fulfillment |
| `app/(admin)/admin/customers/page.tsx` | Customer table |
| `app/(admin)/admin/customers/[id]/page.tsx` | Customer detail |
| `app/(admin)/admin/settings/page.tsx` | Settings form |
| `app/actions/admin/products.ts` | Save product, mint upload signature |
| `app/actions/admin/orders.ts` | Fulfillment transitions |
| `app/actions/admin/settings.ts` | Save settings |
| `components/admin/DataTable.tsx` | Generic table |
| `components/admin/StatusBadge.tsx` | Order/product status label |
| `components/admin/ProductEditor.tsx` | Client form owning product + matrix |
| `components/admin/VariantMatrix.tsx` | Editable matrix rows |
| `components/admin/ImageUploader.tsx` | Signed direct-to-Cloudinary upload |
| `components/admin/FulfillmentPanel.tsx` | Ship / deliver / cancel controls |
| `components/admin/SettingsForm.tsx` | Store settings form |
| `scripts/seed-orders.ts` | Dev fixtures so the orders UI is exercisable before Phase 5 |

---

## Task 1: Role guards and the admin proxy

**Files:**
- Create: `lib/auth/guards.ts`, `proxy.ts`, `tests/unit/auth/guards.test.ts`

**Interfaces:**
- Consumes: `auth` from `@/auth`; the augmented session type from `types/next-auth.d.ts`
- Produces:
  - `type AdminActor = { id: string; email: string; name: string }`
  - `isAdminSession(session: { user?: { role?: string } } | null | undefined): boolean`
  - `requireAdminPage(): Promise<AdminActor>` — redirects, never returns for non-admins
  - `requireAdminActor(): Promise<AdminActor>` — throws `NotAuthorizedError`
  - `class NotAuthorizedError extends Error`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/auth/guards.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isAdminSession } from '@/lib/auth/guards';

describe('isAdminSession', () => {
  it('accepts a session whose user has the admin role', () => {
    expect(isAdminSession({ user: { role: 'admin' } })).toBe(true);
  });

  it('rejects a signed-in customer', () => {
    expect(isAdminSession({ user: { role: 'customer' } })).toBe(false);
  });

  it('rejects an anonymous visitor', () => {
    expect(isAdminSession(null)).toBe(false);
  });

  it('rejects a session with no user', () => {
    expect(isAdminSession({})).toBe(false);
  });

  it('rejects a missing role rather than defaulting to admin', () => {
    expect(isAdminSession({ user: {} })).toBe(false);
  });

  it('is not fooled by a role that merely contains "admin"', () => {
    expect(isAdminSession({ user: { role: 'not-admin' } })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/auth/guards.test.ts`
Expected: FAIL — cannot resolve `@/lib/auth/guards`.

- [ ] **Step 3: Write the guards**

Create `lib/auth/guards.ts`:

```ts
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export type AdminActor = { id: string; email: string; name: string };

export class NotAuthorizedError extends Error {
  constructor() {
    super('Admin privileges are required for this action.');
    this.name = 'NotAuthorizedError';
  }
}

type SessionLike = { user?: { role?: string } } | null | undefined;

/**
 * Pure, so the rule itself is testable without a request context. Exact match
 * only — never a substring test, and never a default of 'admin'.
 */
export function isAdminSession(session: SessionLike): boolean {
  return session?.user?.role === 'admin';
}

async function currentActor(): Promise<AdminActor | null> {
  const session = await auth();
  if (!isAdminSession(session)) return null;

  return {
    id: session?.user?.id ?? '',
    email: session?.user?.email ?? '',
    name: session?.user?.name ?? '',
  };
}

/** For Server Components. Sends non-admins away instead of rendering. */
export async function requireAdminPage(): Promise<AdminActor> {
  const actor = await currentActor();
  if (!actor) redirect('/login');
  return actor;
}

/**
 * For Server Actions. The proxy can be bypassed — a Server Function is a POST
 * to whatever route imported it — so this is the check that actually enforces.
 */
export async function requireAdminActor(): Promise<AdminActor> {
  const actor = await currentActor();
  if (!actor) throw new NotAuthorizedError();
  return actor;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/auth/guards.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Write the proxy**

Next 16 renamed the `middleware` convention to `proxy`: a `proxy.ts` at the project root exporting `proxy` (or a default). It runs on the Node.js runtime, and setting the `runtime` config option inside a proxy file throws.

Create `proxy.ts`:

```ts
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdminSession } from '@/lib/auth/guards';

/**
 * An optimistic gate only. Next's docs are explicit that proxy "should not be
 * used as a full session management or authorization solution", and Server
 * Functions are POSTs to the route that imported them, so a matcher change can
 * silently drop coverage. The enforcing check lives in requireAdminActor().
 */
export const proxy = auth((request) => {
  if (isAdminSession(request.auth)) return NextResponse.next();

  const target = new URL('/login', request.nextUrl.origin);
  target.searchParams.set('from', request.nextUrl.pathname);
  return NextResponse.redirect(target);
});

export const config = {
  matcher: ['/admin/:path*'],
};
```

- [ ] **Step 6: Verify the proxy at runtime**

Start the dev server (`npm run dev`) and, in another shell:

```bash
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3000/admin
```

Expected: `307 http://localhost:3000/login?from=%2Fadmin`. `/admin` does not exist yet, but proxy runs before routing, so the redirect must still happen.

If the dev server fails while bundling `proxy.ts` — `@/auth` pulls in Mongoose and the native `@node-rs/argon2` binding — split the config: create `auth.config.ts` holding everything except `providers`, build a second `NextAuth(authConfig)` there, and import `auth` from that file in `proxy.ts` only. Record whichever path you took in the commit message.

- [ ] **Step 7: Run the full suite, typecheck and lint**

```bash
npm run test && npx tsc --noEmit && npm run lint
```
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add lib/auth/guards.ts proxy.ts tests/unit/auth/guards.test.ts
git commit -m "feat: gate /admin behind role guards and proxy"
```

---

## Task 2: Admin shell

**Files:**
- Create: `app/(admin)/layout.tsx`, `app/(admin)/admin/page.tsx`, `components/admin/DataTable.tsx`, `components/admin/StatusBadge.tsx`

**Interfaces:**
- Consumes: `requireAdminPage` from Task 1
- Produces:
  - `type Column<T> = { key: string; header: string; cell: (row: T) => ReactNode }`
  - `<DataTable columns={Column<T>[]} rows={T[]} rowKey={(row: T) => string} empty={string} />`
  - `<StatusBadge status={string} />`

Route-group layouts type as `LayoutProps<'/'>`, not the child path — this bit us in Phase 3.

- [ ] **Step 1: Build the layout**

Create `app/(admin)/layout.tsx`:

```tsx
import Link from 'next/link';
import { requireAdminPage } from '@/lib/auth/guards';

export const metadata = { title: 'Shrinkless admin' };

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/settings', label: 'Settings' },
];

export default async function AdminLayout({ children }: LayoutProps<'/'>) {
  const actor = await requireAdminPage();

  return (
    <div>
      <aside>
        <Link href="/admin">Shrinkless admin</Link>
        <nav aria-label="Admin">
          <ul>
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <p>Signed in as {actor.email}</p>
        <Link href="/">Back to store</Link>
      </aside>

      <main>{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Build the shared table and badge**

Create `components/admin/DataTable.tsx`:

```tsx
import type { ReactNode } from 'react';

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty: string;
};

export function DataTable<T>({ columns, rows, rowKey, empty }: Props<T>) {
  if (!rows.length) return <p>{empty}</p>;

  return (
    <table>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} scope="col">{column.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)}>
            {columns.map((column) => (
              <td key={column.key}>{column.cell(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

Create `components/admin/StatusBadge.tsx`:

```tsx
export function StatusBadge({ status }: { status: string }) {
  return <span data-status={status}>{status.replace('_', ' ')}</span>;
}
```

- [ ] **Step 3: Add a placeholder dashboard**

Create `app/(admin)/admin/page.tsx`:

```tsx
export default async function AdminDashboardPage() {
  return (
    <section>
      <h1>Dashboard</h1>
      <p>Metrics arrive with the stats service.</p>
    </section>
  );
}
```

- [ ] **Step 4: Verify at runtime**

With `npm run dev` running:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/admin
```
Expected: `307` (anonymous).

Then seed an admin (`npm run seed:admin -- admin@shrinkless.test <password>`), sign in through the browser at `/login`, and load `/admin`. Expected: the sidebar renders and "Signed in as admin@shrinkless.test" appears. Sign in as a **customer** and load `/admin`. Expected: redirected to `/login`.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add "app/(admin)" components/admin
git commit -m "feat: add admin shell layout and shared table primitives"
```

---

## Task 3: Admin product DTOs and read services

**Files:**
- Modify: `types/dto.ts`, `lib/services/products.ts`
- Create: `tests/unit/services/admin-products.test.ts`

**Interfaces:**
- Consumes: `Product`, `Variant` models; the private `WithId`, `toProductDTO`, `loadVariantsByProduct` already in `lib/services/products.ts`
- Produces:
  - `type AdminProductRowDTO = { id: string; title: string; slug: string; status: 'draft' | 'published'; imagePublicId: string; variantCount: number; totalStock: number }`
  - `listProductsForAdmin(): Promise<AdminProductRowDTO[]>` — drafts included, newest first
  - `getProductForAdmin(id: string): Promise<ProductDTO | null>` — any status

- [ ] **Step 1: Write the failing test**

Create `tests/unit/services/admin-products.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Product } from '@/lib/db/models/product';
import { Variant } from '@/lib/db/models/variant';
import { getProductForAdmin, listProductsForAdmin } from '@/lib/services/products';
import { withTestDatabase } from '@/tests/setup/db';

withTestDatabase();

async function seedProduct(overrides: Record<string, unknown> = {}) {
  return Product.create({
    title: 'Field Tee',
    slug: 'field-tee',
    category: 'tees',
    status: 'draft',
    images: [{ publicId: 'shrinkless/field-tee', width: 1200, height: 1500, alt: 'Field tee' }],
    optionSets: { sizes: ['s', 'm'], colors: ['sand'] },
    ...overrides,
  });
}

describe('listProductsForAdmin', () => {
  it('includes drafts, which the storefront listing hides', async () => {
    await seedProduct();

    const rows = await listProductsForAdmin();

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('draft');
  });

  it('summarises variant count and total stock', async () => {
    const product = await seedProduct();
    await Variant.create([
      { productId: product._id, size: 's', color: 'sand', sku: 'FT-S-SAND', priceCents: 4200, stock: 3 },
      { productId: product._id, size: 'm', color: 'sand', sku: 'FT-M-SAND', priceCents: 4200, stock: 4 },
    ]);

    const [row] = await listProductsForAdmin();

    expect(row.variantCount).toBe(2);
    expect(row.totalStock).toBe(7);
    expect(row.imagePublicId).toBe('shrinkless/field-tee');
  });

  it('returns an empty array when nothing exists', async () => {
    expect(await listProductsForAdmin()).toEqual([]);
  });
});

describe('getProductForAdmin', () => {
  it('returns a draft product with its variants', async () => {
    const product = await seedProduct();
    await Variant.create({
      productId: product._id, size: 's', color: 'sand', sku: 'FT-S-SAND', priceCents: 4200, stock: 1,
    });

    const dto = await getProductForAdmin(String(product._id));

    expect(dto?.slug).toBe('field-tee');
    expect(dto?.variants).toHaveLength(1);
  });

  it('returns null for an id that is not a valid ObjectId', async () => {
    expect(await getProductForAdmin('not-an-id')).toBeNull();
  });

  it('returns null for a well-formed id that matches nothing', async () => {
    expect(await getProductForAdmin('64b7f3c2a1b2c3d4e5f60718')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/services/admin-products.test.ts`
Expected: FAIL — `listProductsForAdmin is not a function`.

- [ ] **Step 3: Add the DTO**

Append to `types/dto.ts`:

```ts
export type AdminProductRowDTO = {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  imagePublicId: string;
  variantCount: number;
  totalStock: number;
};
```

- [ ] **Step 4: Implement the services**

Append to `lib/services/products.ts`, and add `AdminProductRowDTO` to its existing `import type { ProductDTO, VariantDTO } from '@/types/dto';` line:

```ts
export async function listProductsForAdmin(): Promise<AdminProductRowDTO[]> {
  await connectToDatabase();

  const products = (await Product.find({}).sort({ createdAt: -1 }).lean()) as WithId<ProductDoc>[];
  const grouped = await loadVariantsByProduct(products.map((p) => p._id));

  return products.map((product) => {
    const variants = grouped.get(String(product._id)) ?? [];

    return {
      id: String(product._id),
      title: product.title,
      slug: product.slug,
      status: product.status as 'draft' | 'published',
      imagePublicId: product.images[0]?.publicId ?? '',
      variantCount: variants.length,
      totalStock: variants.reduce((sum, variant) => sum + variant.stock, 0),
    };
  });
}

export async function getProductForAdmin(id: string): Promise<ProductDTO | null> {
  if (!Types.ObjectId.isValid(id)) return null;

  await connectToDatabase();

  const product = (await Product.findById(id).lean()) as WithId<ProductDoc> | null;
  if (!product) return null;

  const variants = (await Variant.find({ productId: product._id }).lean()) as WithId<VariantDoc>[];
  return toProductDTO(product, variants);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/services/admin-products.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
npx tsc --noEmit && npm run lint
git add types/dto.ts lib/services/products.ts tests/unit/services/admin-products.test.ts
git commit -m "feat: add admin product read services"
```

---

## Task 4: Variant matrix (pure)

**Files:**
- Create: `lib/admin/variant-matrix.ts`, `tests/unit/admin/variant-matrix.test.ts`

**Interfaces:**
- Consumes: `VariantDTO` from `types/dto.ts`
- Produces:
  - `type MatrixRow = { key: string; size: string; color: string; sku: string; priceCents: number; stock: number; enabled: boolean; variantId: string | null; orphan: boolean }`
  - `skuFor(slug: string, size: string, color: string): string`
  - `buildVariantMatrix(input: { slug: string; sizes: string[]; colors: string[]; existing: VariantDTO[]; defaultPriceCents: number }): MatrixRow[]`

The reconciliation rules this module exists to enforce:
1. The matrix is the cross product of sizes × colours, in `sizes` order then `colors` order.
2. A combination that already has a variant keeps **its** sku, price, stock and enabled flag. Editing a saved product must never reset stock.
3. A new combination gets a derived SKU, `defaultPriceCents`, `stock: 0`, `enabled: true`.
4. A variant whose combination is no longer in the option sets is **not dropped**. It is appended with `orphan: true`, forced `enabled: false`, and keeps its stock. Deleting it would break carts holding its id and orders priced from it.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/admin/variant-matrix.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildVariantMatrix, skuFor } from '@/lib/admin/variant-matrix';
import type { VariantDTO } from '@/types/dto';

function variant(overrides: Partial<VariantDTO>): VariantDTO {
  return {
    id: 'v1', size: 's', color: 'sand', sku: 'FIELD-TEE-S-SAND',
    priceCents: 4200, stock: 5, inStock: true, enabled: true,
    ...overrides,
  };
}

describe('skuFor', () => {
  it('derives an uppercase dash-joined sku', () => {
    expect(skuFor('field-tee', 's', 'sand')).toBe('FIELD-TEE-S-SAND');
  });

  it('normalises spaces and case in the option values', () => {
    expect(skuFor('Field Tee', 'XL', 'Off White')).toBe('FIELD-TEE-XL-OFF-WHITE');
  });
});

describe('buildVariantMatrix', () => {
  const base = { slug: 'field-tee', existing: [], defaultPriceCents: 4200 };

  it('generates the full cross product in option order', () => {
    const rows = buildVariantMatrix({ ...base, sizes: ['s', 'm'], colors: ['sand', 'black'] });

    expect(rows.map((row) => row.key)).toEqual(['s:sand', 's:black', 'm:sand', 'm:black']);
  });

  it('gives new rows the default price, zero stock, and enabled true', () => {
    const [row] = buildVariantMatrix({ ...base, sizes: ['s'], colors: ['sand'] });

    expect(row).toMatchObject({
      sku: 'FIELD-TEE-S-SAND', priceCents: 4200, stock: 0,
      enabled: true, variantId: null, orphan: false,
    });
  });

  it('preserves stock, price, sku and enabled on an existing combination', () => {
    const rows = buildVariantMatrix({
      ...base,
      sizes: ['s', 'm'],
      colors: ['sand'],
      existing: [variant({ id: 'abc', sku: 'LEGACY-1', priceCents: 3900, stock: 12, enabled: false })],
    });

    expect(rows[0]).toMatchObject({
      key: 's:sand', variantId: 'abc', sku: 'LEGACY-1',
      priceCents: 3900, stock: 12, enabled: false,
    });
    expect(rows[1]).toMatchObject({ key: 'm:sand', variantId: null, stock: 0 });
  });

  it('appends a colour without disturbing existing rows', () => {
    const rows = buildVariantMatrix({
      ...base,
      sizes: ['s'],
      colors: ['sand', 'black'],
      existing: [variant({ id: 'abc', stock: 12 })],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0].stock).toBe(12);
    expect(rows[1]).toMatchObject({ key: 's:black', stock: 0, variantId: null });
  });

  it('keeps a removed combination as a disabled orphan rather than deleting it', () => {
    const rows = buildVariantMatrix({
      ...base,
      sizes: ['m'],
      colors: ['sand'],
      existing: [variant({ id: 'abc', size: 's', color: 'sand', stock: 12 })],
    });

    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      key: 's:sand', variantId: 'abc', orphan: true, enabled: false, stock: 12,
    });
  });

  it('matches existing variants case-insensitively', () => {
    const rows = buildVariantMatrix({
      ...base,
      sizes: ['S'],
      colors: ['Sand'],
      existing: [variant({ id: 'abc', size: 's', color: 'sand' })],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].variantId).toBe('abc');
  });

  it('returns nothing when either option set is empty', () => {
    expect(buildVariantMatrix({ ...base, sizes: [], colors: ['sand'] })).toEqual([]);
    expect(buildVariantMatrix({ ...base, sizes: ['s'], colors: [] })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/admin/variant-matrix.test.ts`
Expected: FAIL — cannot resolve `@/lib/admin/variant-matrix`.

- [ ] **Step 3: Implement the module**

Create `lib/admin/variant-matrix.ts`:

```ts
import type { VariantDTO } from '@/types/dto';

export type MatrixRow = {
  key: string;
  size: string;
  color: string;
  sku: string;
  priceCents: number;
  stock: number;
  enabled: boolean;
  /** null for a combination that has never been saved. */
  variantId: string | null;
  /** True when the variant exists but its combination left the option sets. */
  orphan: boolean;
};

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

function slugify(value: string): string {
  return normalise(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function skuFor(slug: string, size: string, color: string): string {
  return [slug, size, color].map(slugify).filter(Boolean).join('-').toUpperCase();
}

function keyFor(size: string, color: string): string {
  return `${normalise(size)}:${normalise(color)}`;
}

export function buildVariantMatrix(input: {
  slug: string;
  sizes: string[];
  colors: string[];
  existing: VariantDTO[];
  defaultPriceCents: number;
}): MatrixRow[] {
  const { slug, sizes, colors, existing, defaultPriceCents } = input;

  const byKey = new Map(existing.map((variant) => [keyFor(variant.size, variant.color), variant]));
  const rows: MatrixRow[] = [];
  const claimed = new Set<string>();

  for (const size of sizes) {
    for (const color of colors) {
      const key = keyFor(size, color);
      claimed.add(key);
      const match = byKey.get(key);

      rows.push({
        key,
        size: normalise(size),
        color: normalise(color),
        sku: match?.sku ?? skuFor(slug, size, color),
        priceCents: match?.priceCents ?? defaultPriceCents,
        stock: match?.stock ?? 0,
        enabled: match ? match.enabled : true,
        variantId: match?.id ?? null,
        orphan: false,
      });
    }
  }

  // Combinations that left the option sets survive as disabled rows: carts hold
  // their ids and past orders were priced from them.
  for (const variant of existing) {
    const key = keyFor(variant.size, variant.color);
    if (claimed.has(key)) continue;

    rows.push({
      key,
      size: normalise(variant.size),
      color: normalise(variant.color),
      sku: variant.sku,
      priceCents: variant.priceCents,
      stock: variant.stock,
      enabled: false,
      variantId: variant.id,
      orphan: true,
    });
  }

  return rows;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/admin/variant-matrix.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit && npm run lint
git add lib/admin/variant-matrix.ts tests/unit/admin/variant-matrix.test.ts
git commit -m "feat: add pure variant matrix generation and reconciliation"
```

---

## Task 5: Product write service and validation

**Files:**
- Create: `lib/validation/product.ts`, `tests/unit/validation/product.test.ts`, `tests/unit/services/product-write.test.ts`
- Modify: `lib/services/products.ts`

**Interfaces:**
- Consumes: `MatrixRow` shape from Task 4; `getProductForAdmin` from Task 3
- Produces:
  - `productInputSchema` and `type ProductInput` — `{ title, slug, description, category, status, images, sizes, colors, variants }`
  - `type VariantInput = { variantId: string | null; size: string; color: string; sku: string; priceCents: number; stock: number; enabled: boolean }`
  - `saveProduct(input: ProductInput & { id?: string }): Promise<string>` — returns the product id
  - `class SlugTakenError extends Error`

`saveProduct` upserts variants by `(productId, size, color)` — the pair the unique index covers — and never deletes one.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/validation/product.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { productInputSchema } from '@/lib/validation/product';

const valid = {
  title: 'Field Tee',
  slug: 'Field-Tee',
  description: '',
  category: 'tees',
  status: 'draft',
  images: [],
  sizes: ['S', ' m '],
  colors: ['Sand'],
  variants: [
    { variantId: null, size: 'S', color: 'Sand', sku: 'field-tee-s-sand', priceCents: 4200, stock: 3, enabled: true },
  ],
};

describe('productInputSchema', () => {
  it('lowercases the slug and option values, and uppercases the sku', () => {
    const parsed = productInputSchema.parse(valid);

    expect(parsed.slug).toBe('field-tee');
    expect(parsed.sizes).toEqual(['s', 'm']);
    expect(parsed.variants[0].sku).toBe('FIELD-TEE-S-SAND');
  });

  it('rejects a negative price', () => {
    const result = productInputSchema.safeParse({
      ...valid,
      variants: [{ ...valid.variants[0], priceCents: -1 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a fractional price, because money is integer cents', () => {
    const result = productInputSchema.safeParse({
      ...valid,
      variants: [{ ...valid.variants[0], priceCents: 42.5 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty title', () => {
    expect(productInputSchema.safeParse({ ...valid, title: '  ' }).success).toBe(false);
  });

  it('rejects a slug with spaces or capitals left in it', () => {
    expect(productInputSchema.safeParse({ ...valid, slug: 'field tee' }).success).toBe(false);
  });
});
```

Create `tests/unit/services/product-write.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Variant } from '@/lib/db/models/variant';
import { SlugTakenError, getProductForAdmin, saveProduct } from '@/lib/services/products';
import { withTestDatabase } from '@/tests/setup/db';

withTestDatabase();

const input = {
  title: 'Field Tee',
  slug: 'field-tee',
  description: 'Heavyweight cotton.',
  category: 'tees',
  status: 'draft' as const,
  images: [{ publicId: 'shrinkless/field-tee', width: 1200, height: 1500, alt: 'Field tee' }],
  sizes: ['s', 'm'],
  colors: ['sand'],
  variants: [
    { variantId: null, size: 's', color: 'sand', sku: 'FIELD-TEE-S-SAND', priceCents: 4200, stock: 3, enabled: true },
    { variantId: null, size: 'm', color: 'sand', sku: 'FIELD-TEE-M-SAND', priceCents: 4200, stock: 4, enabled: true },
  ],
};

describe('saveProduct', () => {
  it('creates a product with its variants', async () => {
    const id = await saveProduct(input);
    const dto = await getProductForAdmin(id);

    expect(dto?.title).toBe('Field Tee');
    expect(dto?.variants).toHaveLength(2);
    expect(dto?.sizes).toEqual(['s', 'm']);
  });

  it('updates the product in place rather than creating a second one', async () => {
    const id = await saveProduct(input);
    await saveProduct({ ...input, id, title: 'Field Tee II', status: 'published' });

    const dto = await getProductForAdmin(id);
    expect(dto?.title).toBe('Field Tee II');
    expect(dto?.status).toBe('published');
    expect(await Variant.countDocuments({})).toBe(2);
  });

  it('appends a new colour without touching existing stock', async () => {
    const id = await saveProduct(input);
    const saved = await getProductForAdmin(id);
    const existing = saved!.variants.map((variant) => ({
      variantId: variant.id, size: variant.size, color: variant.color, sku: variant.sku,
      priceCents: variant.priceCents, stock: variant.stock, enabled: variant.enabled,
    }));

    await saveProduct({
      ...input,
      id,
      colors: ['sand', 'black'],
      variants: [
        ...existing,
        { variantId: null, size: 's', color: 'black', sku: 'FIELD-TEE-S-BLACK', priceCents: 4200, stock: 0, enabled: true },
      ],
    });

    const dto = await getProductForAdmin(id);
    expect(dto?.variants).toHaveLength(3);
    expect(dto?.variants.find((v) => v.sku === 'FIELD-TEE-S-SAND')?.stock).toBe(3);
  });

  it('disables a variant without deleting it, so cart references survive', async () => {
    const id = await saveProduct(input);
    const saved = await getProductForAdmin(id);
    const target = saved!.variants.find((v) => v.size === 'm')!;

    await saveProduct({
      ...input,
      id,
      variants: saved!.variants.map((variant) => ({
        variantId: variant.id, size: variant.size, color: variant.color, sku: variant.sku,
        priceCents: variant.priceCents, stock: variant.stock,
        enabled: variant.id !== target.id,
      })),
    });

    const dto = await getProductForAdmin(id);
    expect(dto?.variants).toHaveLength(2);
    expect(dto?.variants.find((v) => v.id === target.id)?.enabled).toBe(false);
  });

  it('rejects a slug that belongs to a different product', async () => {
    await saveProduct(input);

    await expect(
      saveProduct({ ...input, title: 'Copy', variants: [] }),
    ).rejects.toBeInstanceOf(SlugTakenError);
  });

  it('allows a product to keep its own slug on re-save', async () => {
    const id = await saveProduct(input);
    await expect(saveProduct({ ...input, id })).resolves.toBe(id);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/validation/product.test.ts tests/unit/services/product-write.test.ts`
Expected: FAIL — module not found / `saveProduct is not a function`.

- [ ] **Step 3: Write the schema**

Create `lib/validation/product.ts`:

```ts
import { z } from 'zod';

const optionValue = z.string().trim().toLowerCase().min(1);
const cents = z.number().int().min(0);

const imageSchema = z.object({
  publicId: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string().trim().default(''),
});

const variantInputSchema = z.object({
  variantId: z.string().min(1).nullable().default(null),
  size: optionValue,
  color: optionValue,
  sku: z.string().trim().toUpperCase().min(1),
  priceCents: cents,
  stock: z.number().int().min(0),
  enabled: z.boolean().default(true),
});

export const productInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  slug: z.string().trim().toLowerCase().min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug may contain lowercase letters, numbers and dashes only'),
  description: z.string().trim().default(''),
  category: z.string().trim().toLowerCase().min(1, 'Category is required'),
  status: z.enum(['draft', 'published']),
  images: z.array(imageSchema).default([]),
  sizes: z.array(optionValue).default([]),
  colors: z.array(optionValue).default([]),
  variants: z.array(variantInputSchema).default([]),
});

export type ProductInput = z.infer<typeof productInputSchema>;
export type VariantInput = z.infer<typeof variantInputSchema>;
```

- [ ] **Step 4: Write the service**

Append to `lib/services/products.ts`, adding `import type { ProductInput } from '@/lib/validation/product';`:

```ts
export class SlugTakenError extends Error {
  constructor(slug: string) {
    super(`Another product already uses the slug "${slug}"`);
    this.name = 'SlugTakenError';
  }
}

export async function saveProduct(input: ProductInput & { id?: string }): Promise<string> {
  await connectToDatabase();

  const clash = await Product.findOne({ slug: input.slug }).select('_id').lean();
  if (clash && (!input.id || String(clash._id) !== input.id)) {
    throw new SlugTakenError(input.slug);
  }

  const fields = {
    title: input.title,
    slug: input.slug,
    description: input.description,
    category: input.category,
    status: input.status,
    images: input.images,
    optionSets: { sizes: input.sizes, colors: input.colors },
  };

  const product = input.id
    ? await Product.findByIdAndUpdate(input.id, { $set: fields }, { returnDocument: 'after' })
    : await Product.create(fields);

  if (!product) throw new Error(`No product with id ${input.id}`);

  // Upsert by (productId, size, color) — the pair the unique index covers — so a
  // re-save never duplicates a row, and never deletes one either: carts hold
  // variant ids and past orders were priced from them.
  for (const variant of input.variants) {
    await Variant.findOneAndUpdate(
      { productId: product._id, size: variant.size, color: variant.color },
      {
        $set: {
          sku: variant.sku,
          priceCents: variant.priceCents,
          stock: variant.stock,
          enabled: variant.enabled,
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
  }

  return String(product._id);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/validation/product.test.ts tests/unit/services/product-write.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 6: Commit**

```bash
npm run test && npx tsc --noEmit && npm run lint
git add lib/validation/product.ts lib/services/products.ts tests/unit/validation/product.test.ts tests/unit/services/product-write.test.ts
git commit -m "feat: add product save service with variant reconciliation"
```

---

## Task 6: Product list page and editor UI

**Files:**
- Create: `app/actions/admin/products.ts`, `components/admin/VariantMatrix.tsx`, `components/admin/ProductEditor.tsx`, `app/(admin)/admin/products/page.tsx`, `app/(admin)/admin/products/new/page.tsx`, `app/(admin)/admin/products/[id]/page.tsx`

**Interfaces:**
- Consumes: `listProductsForAdmin`, `getProductForAdmin`, `saveProduct`, `SlugTakenError`, `productInputSchema`, `buildVariantMatrix`, `MatrixRow`, `requireAdminPage`, `requireAdminActor`, `NotAuthorizedError`, `DataTable`, `Column`, `StatusBadge`
- Produces:
  - `saveProductAction(payload: unknown): Promise<{ ok: true; id: string } | { ok: false; error: string }>`
  - `<VariantMatrix rows={MatrixRow[]} onChange={(rows: MatrixRow[]) => void} />`
  - `<ProductEditor product={ProductDTO | null} />`

- [ ] **Step 1: Write the Server Action**

Create `app/actions/admin/products.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { NotAuthorizedError, requireAdminActor } from '@/lib/auth/guards';
import { SlugTakenError, saveProduct } from '@/lib/services/products';
import { productInputSchema } from '@/lib/validation/product';

export type SaveProductResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function saveProductAction(payload: unknown): Promise<SaveProductResult> {
  try {
    // The proxy is a convenience; this is the check that matters.
    await requireAdminActor();
  } catch (error) {
    if (error instanceof NotAuthorizedError) return { ok: false, error: 'Not authorised.' };
    throw error;
  }

  const parsed = productInputSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the product details.' };
  }

  const rawId = (payload as { id?: unknown }).id;
  const id = typeof rawId === 'string' && rawId ? rawId : undefined;

  try {
    const savedId = await saveProduct({ ...parsed.data, id });

    revalidatePath('/admin/products');
    revalidatePath('/shop');
    revalidatePath(`/product/${parsed.data.slug}`);

    return { ok: true, id: savedId };
  } catch (error) {
    if (error instanceof SlugTakenError) return { ok: false, error: error.message };
    return { ok: false, error: 'Could not save the product.' };
  }
}
```

- [ ] **Step 2: Build the matrix component**

Create `components/admin/VariantMatrix.tsx`:

```tsx
'use client';

import type { MatrixRow } from '@/lib/admin/variant-matrix';

type Props = {
  rows: MatrixRow[];
  onChange: (rows: MatrixRow[]) => void;
};

export function VariantMatrix({ rows, onChange }: Props) {
  function update(key: string, patch: Partial<MatrixRow>) {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  if (!rows.length) {
    return <p>Add at least one size and one colour to generate variants.</p>;
  }

  return (
    <table>
      <caption>Variants</caption>
      <thead>
        <tr>
          <th scope="col">Size</th>
          <th scope="col">Colour</th>
          <th scope="col">SKU</th>
          <th scope="col">Price (cents)</th>
          <th scope="col">Stock</th>
          <th scope="col">Enabled</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} data-orphan={row.orphan || undefined}>
            <td>{row.size}</td>
            <td>{row.color}{row.orphan ? ' (removed option)' : ''}</td>
            <td>
              <input
                aria-label={`SKU for ${row.size} ${row.color}`}
                value={row.sku}
                onChange={(event) => update(row.key, { sku: event.target.value })}
              />
            </td>
            <td>
              <input
                type="number" min={0} step={1}
                aria-label={`Price for ${row.size} ${row.color}`}
                value={row.priceCents}
                onChange={(event) => update(row.key, { priceCents: Number(event.target.value) })}
              />
            </td>
            <td>
              <input
                type="number" min={0} step={1}
                aria-label={`Stock for ${row.size} ${row.color}`}
                value={row.stock}
                onChange={(event) => update(row.key, { stock: Number(event.target.value) })}
              />
            </td>
            <td>
              <input
                type="checkbox"
                aria-label={`Enable ${row.size} ${row.color}`}
                checked={row.enabled}
                onChange={(event) => update(row.key, { enabled: event.target.checked })}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 3: Build the editor**

Create `components/admin/ProductEditor.tsx`:

```tsx
'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveProductAction } from '@/app/actions/admin/products';
import { buildVariantMatrix, type MatrixRow } from '@/lib/admin/variant-matrix';
import { VariantMatrix } from '@/components/admin/VariantMatrix';
import type { ProductDTO } from '@/types/dto';

const DEFAULT_PRICE_CENTS = 4200;

function toList(value: string): string[] {
  return value.split(',').map((part) => part.trim().toLowerCase()).filter(Boolean);
}

export function ProductEditor({ product }: { product: ProductDTO | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const [title, setTitle] = useState(product?.title ?? '');
  const [slug, setSlug] = useState(product?.slug ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [status, setStatus] = useState<'draft' | 'published'>(product?.status ?? 'draft');
  const [sizesText, setSizesText] = useState((product?.sizes ?? []).join(', '));
  const [colorsText, setColorsText] = useState((product?.colors ?? []).join(', '));
  const [edited, setEdited] = useState<Record<string, MatrixRow>>({});

  const sizes = useMemo(() => toList(sizesText), [sizesText]);
  const colors = useMemo(() => toList(colorsText), [colorsText]);

  // Regenerating from the option sets on every render is what makes "add a
  // colour" append rows; per-row edits are layered back on by key.
  const rows = useMemo(() => {
    const generated = buildVariantMatrix({
      slug: slug || 'product',
      sizes,
      colors,
      existing: product?.variants ?? [],
      defaultPriceCents: DEFAULT_PRICE_CENTS,
    });
    return generated.map((row) => edited[row.key] ?? row);
  }, [slug, sizes, colors, product, edited]);

  function handleMatrixChange(next: MatrixRow[]) {
    setEdited((current) => {
      const merged = { ...current };
      for (const row of next) merged[row.key] = row;
      return merged;
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    startTransition(async () => {
      const result = await saveProductAction({
        id: product?.id,
        title, slug, description, category, status,
        images: product?.images ?? [],
        sizes, colors,
        variants: rows.map((row) => ({
          variantId: row.variantId,
          size: row.size,
          color: row.color,
          sku: row.sku,
          priceCents: row.priceCents,
          stock: row.stock,
          enabled: row.enabled,
        })),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push('/admin/products');
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>

      <label>Slug
        <input value={slug} onChange={(e) => setSlug(e.target.value)} required />
      </label>

      <label>Category
        <input value={category} onChange={(e) => setCategory(e.target.value)} required />
      </label>

      <label>Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>

      <label>Status
        <select value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </label>

      <label>Sizes (comma separated)
        <input value={sizesText} onChange={(e) => setSizesText(e.target.value)} />
      </label>

      <label>Colours (comma separated)
        <input value={colorsText} onChange={(e) => setColorsText(e.target.value)} />
      </label>

      <VariantMatrix rows={rows} onChange={handleMatrixChange} />

      <button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save product'}</button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
```

- [ ] **Step 4: Build the pages**

Create `app/(admin)/admin/products/page.tsx`:

```tsx
import Link from 'next/link';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { requireAdminPage } from '@/lib/auth/guards';
import { listProductsForAdmin } from '@/lib/services/products';
import type { AdminProductRowDTO } from '@/types/dto';

const columns: Column<AdminProductRowDTO>[] = [
  { key: 'title', header: 'Title', cell: (row) => <Link href={`/admin/products/${row.id}`}>{row.title}</Link> },
  { key: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
  { key: 'variants', header: 'Variants', cell: (row) => row.variantCount },
  { key: 'stock', header: 'Total stock', cell: (row) => row.totalStock },
];

export default async function AdminProductsPage() {
  await requireAdminPage();
  const rows = await listProductsForAdmin();

  return (
    <section>
      <h1>Products</h1>
      <Link href="/admin/products/new">New product</Link>
      <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} empty="No products yet." />
    </section>
  );
}
```

Create `app/(admin)/admin/products/new/page.tsx`:

```tsx
import { ProductEditor } from '@/components/admin/ProductEditor';
import { requireAdminPage } from '@/lib/auth/guards';

export default async function NewProductPage() {
  await requireAdminPage();

  return (
    <section>
      <h1>New product</h1>
      <ProductEditor product={null} />
    </section>
  );
}
```

Create `app/(admin)/admin/products/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { ProductEditor } from '@/components/admin/ProductEditor';
import { requireAdminPage } from '@/lib/auth/guards';
import { getProductForAdmin } from '@/lib/services/products';

export default async function EditProductPage({ params }: PageProps<'/admin/products/[id]'>) {
  await requireAdminPage();

  const { id } = await params;
  const product = await getProductForAdmin(id);
  if (!product) notFound();

  return (
    <section>
      <h1>{product.title}</h1>
      <ProductEditor product={product} />
    </section>
  );
}
```

- [ ] **Step 5: Verify at runtime**

Signed in as the admin, in a browser:
1. `/admin/products` lists the seeded products, drafts included.
2. `/admin/products/new` → title `Test Tee`, slug `test-tee`, category `tees`, sizes `s, m`, colours `sand, black` → the matrix shows **four** rows → save → back on the list with the new product present.
3. Reopen it, add `olive` to colours → **six** rows, and the four original rows keep their stock values.
4. Set one row's stock to 9, save, reopen → the 9 is still there.
5. Set the status to `published` → the product appears on `/shop`.

- [ ] **Step 6: Typecheck, lint, commit**

```bash
npm run test && npx tsc --noEmit && npm run lint
git add "app/(admin)/admin/products" app/actions/admin components/admin
git commit -m "feat: add admin product list and editor with variant matrix"
```

---

## Task 7: Signed direct-to-Cloudinary uploads

**Files:**
- Create: `lib/cloudinary/signature.ts`, `lib/cloudinary/url.ts`, `lib/cloudinary/config.ts`, `components/admin/ImageUploader.tsx`, `tests/unit/cloudinary/signature.test.ts`
- Modify: `app/actions/admin/products.ts`, `components/admin/ProductEditor.tsx`, `.env.local`

**Interfaces:**
- Consumes: `requireAdminActor`, `NotAuthorizedError`
- Produces:
  - `signatureBase(params: Record<string, string | number>): string`
  - `signParams(params: Record<string, string | number>, apiSecret: string): string`
  - `loadCloudinaryEnv(source?: NodeJS.ProcessEnv): { cloudName: string; apiKey: string; apiSecret: string }`
  - `cloudinaryUrl(publicId: string, transform?: string, cloudName?: string): string`
  - `UPLOAD_FOLDER`, `uploadEndpoint(cloudName: string): string`
  - `createUploadSignatureAction(): Promise<{ ok: true; cloudName: string; apiKey: string; timestamp: number; folder: string; signature: string } | { ok: false; error: string }>`
  - `<ImageUploader images={ImageDTO[]} onChange={(images: ImageDTO[]) => void} />`

Cloudinary's rule: take every parameter you will send *except* `file`, `api_key` and `resource_type`, sort by key, join as `k=v` with `&`, append the API secret, SHA-1, hex-encode. No SDK needed.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/cloudinary/signature.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadCloudinaryEnv, signParams, signatureBase } from '@/lib/cloudinary/signature';
import { cloudinaryUrl } from '@/lib/cloudinary/url';

describe('signatureBase', () => {
  it('sorts parameters by key and joins them as a query string', () => {
    expect(signatureBase({ timestamp: 1700000000, folder: 'shrinkless/products' }))
      .toBe('folder=shrinkless/products&timestamp=1700000000');
  });

  it('omits the parameters Cloudinary excludes from the signature', () => {
    expect(signatureBase({ timestamp: 1, api_key: 'k', file: 'x', resource_type: 'image' }))
      .toBe('timestamp=1');
  });

  it('omits empty values', () => {
    expect(signatureBase({ timestamp: 1, folder: '' })).toBe('timestamp=1');
  });
});

describe('signParams', () => {
  it('produces the SHA-1 of the base string plus the secret', () => {
    const signature = signParams(
      { folder: 'shrinkless/products', timestamp: 1700000000 },
      'test-secret',
    );
    expect(signature).toBe('deae93466bf86c21c0563633710ae4077d1183e1');
  });

  it('changes when the secret changes', () => {
    const params = { timestamp: 1700000000 };
    expect(signParams(params, 'a')).not.toBe(signParams(params, 'b'));
  });
});

describe('loadCloudinaryEnv', () => {
  it('reads the three variables', () => {
    expect(loadCloudinaryEnv({
      CLOUDINARY_CLOUD_NAME: 'shrinkless',
      CLOUDINARY_API_KEY: '123',
      CLOUDINARY_API_SECRET: 'secret',
    } as NodeJS.ProcessEnv)).toEqual({
      cloudName: 'shrinkless', apiKey: '123', apiSecret: 'secret',
    });
  });

  it('names the missing variables when one is absent', () => {
    expect(() => loadCloudinaryEnv({ CLOUDINARY_CLOUD_NAME: 'shrinkless' } as NodeJS.ProcessEnv))
      .toThrow(/CLOUDINARY_API_KEY/);
  });
});

describe('cloudinaryUrl', () => {
  it('builds a delivery url with a transform', () => {
    expect(cloudinaryUrl('shrinkless/field-tee', 'w_120,c_fill', 'demo'))
      .toBe('https://res.cloudinary.com/demo/image/upload/w_120,c_fill/shrinkless/field-tee');
  });

  it('omits the transform segment when none is given', () => {
    expect(cloudinaryUrl('shrinkless/field-tee', undefined, 'demo'))
      .toBe('https://res.cloudinary.com/demo/image/upload/shrinkless/field-tee');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/cloudinary/signature.test.ts`
Expected: FAIL — the modules do not exist.

- [ ] **Step 3: Implement signing, env and urls**

Create `lib/cloudinary/signature.ts`:

```ts
import { createHash } from 'node:crypto';
import { z } from 'zod';

/** Cloudinary signs every upload parameter except these three. */
const EXCLUDED = new Set(['file', 'api_key', 'resource_type']);

export function signatureBase(params: Record<string, string | number>): string {
  return Object.entries(params)
    .filter(([key, value]) => !EXCLUDED.has(key) && value !== '' && value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

export function signParams(
  params: Record<string, string | number>,
  apiSecret: string,
): string {
  return createHash('sha1').update(signatureBase(params) + apiSecret).digest('hex');
}

const cloudinarySchema = z.object({
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
});

export type CloudinaryEnv = { cloudName: string; apiKey: string; apiSecret: string };

/**
 * Separate from lib/env.ts on purpose: these three are only needed by the admin
 * uploader, and the storefront must still boot on an environment without them.
 */
export function loadCloudinaryEnv(source: NodeJS.ProcessEnv = process.env): CloudinaryEnv {
  const parsed = cloudinarySchema.safeParse(source);

  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid or missing environment variables: ${names}`);
  }

  return {
    cloudName: parsed.data.CLOUDINARY_CLOUD_NAME,
    apiKey: parsed.data.CLOUDINARY_API_KEY,
    apiSecret: parsed.data.CLOUDINARY_API_SECRET,
  };
}
```

Create `lib/cloudinary/url.ts`. The cloud name has to be readable from a Client Component, so it falls back through the `NEXT_PUBLIC_` copy:

```ts
export function cloudinaryUrl(
  publicId: string,
  transform?: string,
  cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '',
): string {
  const segments = ['https://res.cloudinary.com', cloudName, 'image', 'upload'];
  if (transform) segments.push(transform);
  segments.push(publicId);

  return segments.join('/');
}
```

Create `lib/cloudinary/config.ts`:

```ts
export const UPLOAD_FOLDER = 'shrinkless/products';

export function uploadEndpoint(cloudName: string): string {
  return `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/cloudinary/signature.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Add the signature action**

Append to `app/actions/admin/products.ts`, adding the imports `import { UPLOAD_FOLDER } from '@/lib/cloudinary/config';` and `import { loadCloudinaryEnv, signParams } from '@/lib/cloudinary/signature';`:

```ts
export type UploadSignature = {
  ok: true;
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
};

export async function createUploadSignatureAction(): Promise<
  UploadSignature | { ok: false; error: string }
> {
  try {
    await requireAdminActor();
  } catch (error) {
    if (error instanceof NotAuthorizedError) return { ok: false, error: 'Not authorised.' };
    throw error;
  }

  let env;
  try {
    env = loadCloudinaryEnv();
  } catch {
    return { ok: false, error: 'Cloudinary is not configured on this environment.' };
  }

  const timestamp = Math.floor(Date.now() / 1000);

  // The secret is used here and never leaves the server; the browser receives
  // only the signature, so image bytes go straight to Cloudinary.
  return {
    ok: true,
    cloudName: env.cloudName,
    apiKey: env.apiKey,
    timestamp,
    folder: UPLOAD_FOLDER,
    signature: signParams({ folder: UPLOAD_FOLDER, timestamp }, env.apiSecret),
  };
}
```

- [ ] **Step 6: Build the uploader**

Create `components/admin/ImageUploader.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { createUploadSignatureAction } from '@/app/actions/admin/products';
import { uploadEndpoint } from '@/lib/cloudinary/config';
import { cloudinaryUrl } from '@/lib/cloudinary/url';
import type { ImageDTO } from '@/types/dto';

type Props = {
  images: ImageDTO[];
  onChange: (images: ImageDTO[]) => void;
};

export function ImageUploader({ images, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(file: File) {
    setBusy(true);
    setError('');

    try {
      const signed = await createUploadSignatureAction();
      if (!signed.ok) throw new Error(signed.error);

      const body = new FormData();
      body.set('file', file);
      body.set('api_key', signed.apiKey);
      body.set('timestamp', String(signed.timestamp));
      body.set('folder', signed.folder);
      body.set('signature', signed.signature);

      const response = await fetch(uploadEndpoint(signed.cloudName), { method: 'POST', body });
      if (!response.ok) throw new Error('Cloudinary rejected the upload.');

      const uploaded = (await response.json()) as {
        public_id: string; width: number; height: number;
      };

      onChange([
        ...images,
        { publicId: uploaded.public_id, width: uploaded.width, height: uploaded.height, alt: '' },
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset>
      <legend>Images</legend>

      <ul>
        {images.map((image, index) => (
          <li key={image.publicId}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cloudinaryUrl(image.publicId, 'w_120,h_150,c_fill')}
              alt={image.alt}
              width={120}
              height={150}
            />
            <label>Alt text
              <input
                value={image.alt}
                onChange={(event) => onChange(images.map((current, i) =>
                  i === index ? { ...current, alt: event.target.value } : current,
                ))}
              />
            </label>
            <button type="button" onClick={() => onChange(images.filter((_, i) => i !== index))}>
              Remove
            </button>
          </li>
        ))}
      </ul>

      <label>Add image
        <input
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = '';
          }}
        />
      </label>

      {busy ? <p>Uploading…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </fieldset>
  );
}
```

- [ ] **Step 7: Wire the uploader into the editor**

In `components/admin/ProductEditor.tsx`:
- add `import { ImageUploader } from '@/components/admin/ImageUploader';`
- change the DTO import to `import type { ImageDTO, ProductDTO } from '@/types/dto';`
- add `const [images, setImages] = useState<ImageDTO[]>(product?.images ?? []);`
- render `<ImageUploader images={images} onChange={setImages} />` immediately above `<VariantMatrix … />`
- change the action payload field `images: product?.images ?? []` to `images`.

- [ ] **Step 8: Verify at runtime**

Put real values for `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` and `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` in `.env.local` (gitignored — never commit it), restart dev, open a product editor, upload a JPEG.

Expected: a thumbnail appears; the asset shows up in the Cloudinary media library under `shrinkless/products`; after saving and reloading, the thumbnail still renders from the stored `public_id`.

In the browser Network tab, confirm the upload POST goes to `api.cloudinary.com` and **not** to localhost — no image bytes may pass through our server.

- [ ] **Step 9: Typecheck, lint, commit**

```bash
npm run test && npx tsc --noEmit && npm run lint
git add lib/cloudinary components/admin/ImageUploader.tsx components/admin/ProductEditor.tsx app/actions/admin/products.ts tests/unit/cloudinary
git commit -m "feat: add signed direct-to-Cloudinary image uploads"
```

---

## Task 8: Orders service

**Files:**
- Create: `lib/services/orders.ts`, `tests/unit/services/orders.test.ts`, `scripts/seed-orders.ts`
- Modify: `types/dto.ts`, `package.json`

**Interfaces:**
- Consumes: the `Order` model
- Produces:
  - `type OrderStatus`, `ShippingAddressDTO`, `OrderItemDTO`, `StatusEventDTO`, `OrderRowDTO`, `OrderDTO`
  - `canTransition(from: OrderStatus, to: OrderStatus): boolean` — pure
  - `listOrders(status?: OrderStatus): Promise<OrderRowDTO[]>`
  - `getOrderById(id: string): Promise<OrderDTO | null>`
  - `transitionOrder(input: { id: string; to: OrderStatus; actor: string; note?: string; trackingNumber?: string }): Promise<OrderDTO>`
  - `class InvalidTransitionError extends Error`
  - (added in Task 10) `listOrdersForUser(userId: string): Promise<OrderRowDTO[]>`

Allowed transitions (spec §7.4): `pending → paid | cancelled | payment_failed`; `paid → shipped | cancelled`; `shipped → delivered`; `delivered`, `cancelled` and `payment_failed` are terminal. Every transition appends to `statusHistory` with actor and timestamp.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/services/orders.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Order } from '@/lib/db/models/order';
import {
  InvalidTransitionError, canTransition, getOrderById, listOrders, transitionOrder,
} from '@/lib/services/orders';
import { withTestDatabase } from '@/tests/setup/db';

withTestDatabase();

async function seedOrder(overrides: Record<string, unknown> = {}) {
  return Order.create({
    orderNumber: 'SL-1001',
    email: 'buyer@example.com',
    items: [{
      title: 'Field Tee', size: 's', color: 'sand', sku: 'FIELD-TEE-S-SAND',
      unitPriceCents: 4200, quantity: 2, imagePublicId: 'shrinkless/field-tee',
    }],
    shippingAddress: {
      name: 'A Buyer', line1: '1 Main St', city: 'Austin',
      state: 'TX', postalCode: '78701', country: 'US',
    },
    subtotalCents: 8400, shippingCents: 500, taxCents: 0, totalCents: 8900,
    status: 'paid',
    ...overrides,
  });
}

describe('canTransition', () => {
  it('allows the fulfillment path', () => {
    expect(canTransition('pending', 'paid')).toBe(true);
    expect(canTransition('paid', 'shipped')).toBe(true);
    expect(canTransition('shipped', 'delivered')).toBe(true);
  });

  it('refuses to skip shipping', () => {
    expect(canTransition('paid', 'delivered')).toBe(false);
  });

  it('refuses to move backwards', () => {
    expect(canTransition('shipped', 'paid')).toBe(false);
  });

  it('treats delivered, cancelled and payment_failed as terminal', () => {
    expect(canTransition('delivered', 'shipped')).toBe(false);
    expect(canTransition('cancelled', 'paid')).toBe(false);
    expect(canTransition('payment_failed', 'paid')).toBe(false);
  });

  it('refuses a no-op transition', () => {
    expect(canTransition('paid', 'paid')).toBe(false);
  });
});

describe('listOrders', () => {
  it('summarises orders newest first', async () => {
    await seedOrder({ orderNumber: 'SL-1001' });
    await seedOrder({ orderNumber: 'SL-1002' });

    const rows = await listOrders();

    expect(rows.map((row) => row.orderNumber)).toEqual(['SL-1002', 'SL-1001']);
    expect(rows[0]).toMatchObject({ totalCents: 8900, itemCount: 2, status: 'paid' });
    expect(typeof rows[0].createdAt).toBe('string');
  });

  it('filters by status', async () => {
    await seedOrder({ orderNumber: 'SL-1001', status: 'paid' });
    await seedOrder({ orderNumber: 'SL-1002', status: 'shipped' });

    const rows = await listOrders('shipped');

    expect(rows).toHaveLength(1);
    expect(rows[0].orderNumber).toBe('SL-1002');
  });
});

describe('getOrderById', () => {
  it('returns snapshot items and a serialisable address', async () => {
    const order = await seedOrder();

    const dto = await getOrderById(String(order._id));

    expect(dto?.items[0].sku).toBe('FIELD-TEE-S-SAND');
    expect(dto?.shippingAddress.city).toBe('Austin');
    expect(typeof dto?.createdAt).toBe('string');
  });

  it('returns null for an unknown id', async () => {
    expect(await getOrderById('64b7f3c2a1b2c3d4e5f60718')).toBeNull();
  });

  it('returns null for a malformed id', async () => {
    expect(await getOrderById('nope')).toBeNull();
  });
});

describe('transitionOrder', () => {
  it('marks an order shipped and records the tracking number', async () => {
    const order = await seedOrder();

    const dto = await transitionOrder({
      id: String(order._id), to: 'shipped', actor: 'admin@shrinkless.test', trackingNumber: '1Z999',
    });

    expect(dto.status).toBe('shipped');
    expect(dto.trackingNumber).toBe('1Z999');
  });

  it('appends to the status history with the actor', async () => {
    const order = await seedOrder();

    const dto = await transitionOrder({
      id: String(order._id), to: 'shipped', actor: 'admin@shrinkless.test',
    });

    expect(dto.statusHistory).toHaveLength(1);
    expect(dto.statusHistory[0]).toMatchObject({
      status: 'shipped', actor: 'admin@shrinkless.test',
    });
    expect(typeof dto.statusHistory[0].at).toBe('string');
  });

  it('rejects an illegal transition and leaves the order untouched', async () => {
    const order = await seedOrder();

    await expect(
      transitionOrder({ id: String(order._id), to: 'delivered', actor: 'admin@shrinkless.test' }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);

    const dto = await getOrderById(String(order._id));
    expect(dto?.status).toBe('paid');
    expect(dto?.statusHistory).toHaveLength(0);
  });

  it('throws for an order that does not exist', async () => {
    await expect(
      transitionOrder({ id: '64b7f3c2a1b2c3d4e5f60718', to: 'shipped', actor: 'a@b.c' }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/services/orders.test.ts`
Expected: FAIL — cannot resolve `@/lib/services/orders`.

- [ ] **Step 3: Add the DTOs**

Append to `types/dto.ts`:

```ts
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
  shippingCents: number;
  taxCents: number;
  trackingNumber: string;
  statusHistory: StatusEventDTO[];
};
```

- [ ] **Step 4: Implement the service**

Create `lib/services/orders.ts`:

```ts
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db/connection';
import { Order } from '@/lib/db/models/order';
import type { OrderDTO, OrderRowDTO, OrderStatus } from '@/types/dto';

export class InvalidTransitionError extends Error {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`An order cannot move from ${from} to ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

/**
 * Spec §7.4. delivered/cancelled/payment_failed are terminal, and a no-op
 * transition is refused so the history never fills with duplicates.
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

function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date().toISOString();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toOrderDTO(order: any): OrderDTO {
  return {
    id: String(order._id),
    orderNumber: order.orderNumber,
    email: order.email,
    userId: order.userId ? String(order.userId) : null,
    status: order.status as OrderStatus,
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
    shippingCents: order.shippingCents,
    taxCents: order.taxCents,
    totalCents: order.totalCents,
    itemCount: order.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
    trackingNumber: order.trackingNumber ?? '',
    statusHistory: (order.statusHistory ?? []).map((event: any) => ({
      status: event.status as OrderStatus,
      actor: event.actor ?? 'system',
      at: toIso(event.at),
      note: event.note ?? '',
    })),
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

export async function listOrders(status?: OrderStatus): Promise<OrderRowDTO[]> {
  await connectToDatabase();

  const query = status ? { status } : {};
  const orders = await Order.find(query).sort({ createdAt: -1 }).lean();

  return orders.map((order) => toRow(toOrderDTO(order)));
}

export async function getOrderById(id: string): Promise<OrderDTO | null> {
  if (!Types.ObjectId.isValid(id)) return null;

  await connectToDatabase();

  const order = await Order.findById(id).lean();
  return order ? toOrderDTO(order) : null;
}

export async function transitionOrder(input: {
  id: string;
  to: OrderStatus;
  actor: string;
  note?: string;
  trackingNumber?: string;
}): Promise<OrderDTO> {
  if (!Types.ObjectId.isValid(input.id)) throw new Error(`Invalid id: ${input.id}`);

  await connectToDatabase();

  const order = await Order.findById(input.id);
  if (!order) throw new Error(`No order with id ${input.id}`);

  const from = order.status as OrderStatus;
  if (!canTransition(from, input.to)) throw new InvalidTransitionError(from, input.to);

  order.status = input.to;
  if (input.trackingNumber) order.trackingNumber = input.trackingNumber;
  order.statusHistory.push({
    status: input.to,
    actor: input.actor,
    at: new Date(),
    note: input.note ?? '',
  });

  await order.save();

  // TODO(Phase 5): when `to === 'shipped'`, fire the shipping-confirmation
  // email via Resend. Email infrastructure lands with checkout.
  return toOrderDTO(order.toObject());
}
```

Note the ordering inside `transitionOrder`: the id is validated **before** `Order.findById`, because Mongoose throws a `CastError` on a malformed id rather than returning null.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/services/orders.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 6: Add dev fixtures**

Checkout does not exist until Phase 5, so without fixtures the orders UI cannot be exercised at all.

Create `scripts/seed-orders.ts`:

```ts
import { connectToDatabase, disconnectFromDatabase } from '@/lib/db/connection';
import { Order } from '@/lib/db/models/order';

const ADDRESS = {
  name: 'A Buyer', line1: '1 Main St', line2: '', city: 'Austin',
  state: 'TX', postalCode: '78701', country: 'US', phone: '',
};

const ITEMS = [{
  title: 'Field Tee', size: 's', color: 'sand', sku: 'FIELD-TEE-S-SAND',
  unitPriceCents: 4200, quantity: 2, imagePublicId: '',
}];

async function main() {
  await connectToDatabase();

  for (const [index, status] of ['pending', 'paid', 'shipped'].entries()) {
    const orderNumber = `SL-90${index}`;

    await Order.findOneAndUpdate(
      { orderNumber },
      {
        $set: {
          email: 'buyer@example.com', items: ITEMS, shippingAddress: ADDRESS,
          subtotalCents: 8400, shippingCents: 500, taxCents: 0, totalCents: 8900,
          status,
        },
        $setOnInsert: { orderNumber },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );

    console.log(`seeded ${orderNumber} (${status})`);
  }

  await disconnectFromDatabase();
}

main().catch(async (error) => {
  console.error(error);
  await disconnectFromDatabase();
  process.exit(1);
});
```

Add to `package.json` scripts:

```json
"seed:orders": "tsx --env-file-if-exists=.env.local scripts/seed-orders.ts"
```

Run: `npm run seed:orders`
Expected: three `seeded SL-90n` lines.

- [ ] **Step 7: Commit**

```bash
npm run test && npx tsc --noEmit && npm run lint
git add lib/services/orders.ts types/dto.ts scripts/seed-orders.ts package.json tests/unit/services/orders.test.ts
git commit -m "feat: add orders service with guarded status transitions"
```

---

## Task 9: Orders UI and fulfillment

**Files:**
- Create: `app/actions/admin/orders.ts`, `components/admin/FulfillmentPanel.tsx`, `app/(admin)/admin/orders/page.tsx`, `app/(admin)/admin/orders/[id]/page.tsx`

**Interfaces:**
- Consumes: `listOrders`, `getOrderById`, `transitionOrder`, `InvalidTransitionError`, `requireAdminActor`, `requireAdminPage`, `DataTable`, `StatusBadge`, `formatCents`
- Produces: `transitionOrderAction(input: unknown): Promise<{ ok: true } | { ok: false; error: string }>`

- [ ] **Step 1: Write the action**

Create `app/actions/admin/orders.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { NotAuthorizedError, requireAdminActor } from '@/lib/auth/guards';
import { InvalidTransitionError, transitionOrder } from '@/lib/services/orders';

const schema = z.object({
  id: z.string().min(1),
  to: z.enum(['paid', 'shipped', 'delivered', 'cancelled', 'payment_failed']),
  trackingNumber: z.string().trim().default(''),
  note: z.string().trim().default(''),
});

export type TransitionResult = { ok: true } | { ok: false; error: string };

export async function transitionOrderAction(input: unknown): Promise<TransitionResult> {
  let actor;
  try {
    actor = await requireAdminActor();
  } catch (error) {
    if (error instanceof NotAuthorizedError) return { ok: false, error: 'Not authorised.' };
    throw error;
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid fulfillment request.' };

  try {
    await transitionOrder({
      id: parsed.data.id,
      to: parsed.data.to,
      actor: actor.email,
      note: parsed.data.note,
      trackingNumber: parsed.data.trackingNumber || undefined,
    });
  } catch (error) {
    if (error instanceof InvalidTransitionError) return { ok: false, error: error.message };
    return { ok: false, error: 'Could not update the order.' };
  }

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${parsed.data.id}`);
  revalidatePath('/admin');

  return { ok: true };
}
```

- [ ] **Step 2: Build the fulfillment panel**

Create `components/admin/FulfillmentPanel.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { transitionOrderAction } from '@/app/actions/admin/orders';
import type { OrderStatus } from '@/types/dto';

type Props = {
  orderId: string;
  status: OrderStatus;
  trackingNumber: string;
};

export function FulfillmentPanel({ orderId, status, trackingNumber }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tracking, setTracking] = useState(trackingNumber);
  const [error, setError] = useState('');

  function run(to: OrderStatus) {
    setError('');
    startTransition(async () => {
      const result = await transitionOrderAction({ id: orderId, to, trackingNumber: tracking });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="fulfillment-heading">
      <h2 id="fulfillment-heading">Fulfillment</h2>

      {status === 'paid' && (
        <>
          <label>Tracking number
            <input value={tracking} onChange={(event) => setTracking(event.target.value)} />
          </label>
          <button type="button" disabled={pending} onClick={() => run('shipped')}>
            Mark as shipped
          </button>
        </>
      )}

      {status === 'shipped' && (
        <button type="button" disabled={pending} onClick={() => run('delivered')}>
          Mark as delivered
        </button>
      )}

      {(status === 'pending' || status === 'paid') && (
        <button type="button" disabled={pending} onClick={() => run('cancelled')}>
          Cancel order
        </button>
      )}

      {['delivered', 'cancelled', 'payment_failed'].includes(status) && (
        <p>This order is closed. No further actions.</p>
      )}

      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
```

- [ ] **Step 3: Build the pages**

Create `app/(admin)/admin/orders/page.tsx`:

```tsx
import Link from 'next/link';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { requireAdminPage } from '@/lib/auth/guards';
import { formatCents } from '@/lib/money';
import { listOrders } from '@/lib/services/orders';
import type { OrderRowDTO } from '@/types/dto';

const columns: Column<OrderRowDTO>[] = [
  { key: 'number', header: 'Order', cell: (row) => <Link href={`/admin/orders/${row.id}`}>{row.orderNumber}</Link> },
  { key: 'email', header: 'Customer', cell: (row) => row.email },
  { key: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
  { key: 'items', header: 'Items', cell: (row) => row.itemCount },
  { key: 'total', header: 'Total', cell: (row) => formatCents(row.totalCents) },
  { key: 'placed', header: 'Placed', cell: (row) => new Date(row.createdAt).toLocaleDateString('en-US') },
];

export default async function AdminOrdersPage() {
  await requireAdminPage();
  const rows = await listOrders();

  return (
    <section>
      <h1>Orders</h1>
      <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} empty="No orders yet." />
    </section>
  );
}
```

Create `app/(admin)/admin/orders/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { FulfillmentPanel } from '@/components/admin/FulfillmentPanel';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { requireAdminPage } from '@/lib/auth/guards';
import { formatCents } from '@/lib/money';
import { getOrderById } from '@/lib/services/orders';

export default async function AdminOrderPage({ params }: PageProps<'/admin/orders/[id]'>) {
  await requireAdminPage();

  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();

  return (
    <section>
      <h1>{order.orderNumber}</h1>
      <StatusBadge status={order.status} />
      <p>{order.email}</p>

      <h2>Items</h2>
      <ul>
        {order.items.map((item) => (
          <li key={item.sku}>
            {item.title} — {item.size} / {item.color} × {item.quantity} ={' '}
            {formatCents(item.unitPriceCents * item.quantity)}
          </li>
        ))}
      </ul>

      <h2>Totals</h2>
      <dl>
        <dt>Subtotal</dt><dd>{formatCents(order.subtotalCents)}</dd>
        <dt>Shipping</dt><dd>{formatCents(order.shippingCents)}</dd>
        <dt>Tax</dt><dd>{formatCents(order.taxCents)}</dd>
        <dt>Total</dt><dd>{formatCents(order.totalCents)}</dd>
      </dl>

      <h2>Ship to</h2>
      <address>
        {order.shippingAddress.name}<br />
        {order.shippingAddress.line1}<br />
        {order.shippingAddress.line2 ? <>{order.shippingAddress.line2}<br /></> : null}
        {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}<br />
        {order.shippingAddress.country}
      </address>

      <FulfillmentPanel
        orderId={order.id}
        status={order.status}
        trackingNumber={order.trackingNumber}
      />

      <h2>History</h2>
      <ol>
        {order.statusHistory.map((event, index) => (
          <li key={`${event.status}-${index}`}>
            {event.status} — {event.actor} — {new Date(event.at).toLocaleString('en-US')}
          </li>
        ))}
      </ol>

      <h2>Refunds</h2>
      {/* Spec §7.4: refunds are handled in the provider dashboard, not in-app. */}
      <p>
        Issue refunds in the provider dashboard:{' '}
        <a href="https://dashboard.stripe.com/payments" target="_blank" rel="noreferrer">Stripe</a>
        {' · '}
        <a href="https://www.paypal.com/activity" target="_blank" rel="noreferrer">PayPal</a>
      </p>
    </section>
  );
}
```

- [ ] **Step 4: Verify at runtime**

`npm run seed:orders`, then as the admin:
1. `/admin/orders` lists three orders.
2. Open the `paid` one → enter tracking `1Z999` → **Mark as shipped** → the badge flips to `shipped`, the history gains a row naming your admin email, and the tracking number survives a reload.
3. On the now-shipped order, **Mark as delivered** works; afterwards the panel says "This order is closed."
4. On the `pending` one, **Cancel order** works.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
npm run test && npx tsc --noEmit && npm run lint
git add "app/(admin)/admin/orders" app/actions/admin/orders.ts components/admin/FulfillmentPanel.tsx
git commit -m "feat: add admin orders list, detail and fulfillment actions"
```

---

## Task 10: Customers (read-only)

**Files:**
- Create: `app/(admin)/admin/customers/page.tsx`, `app/(admin)/admin/customers/[id]/page.tsx`, `tests/unit/services/admin-customers.test.ts`
- Modify: `lib/services/users.ts`, `lib/services/orders.ts`, `types/dto.ts`

**Interfaces:**
- Consumes: `User` and `Order` models; `toOrderDTO` (private in `lib/services/orders.ts`)
- Produces:
  - `type CustomerRowDTO = { id: string; email: string; name: string; role: 'customer' | 'admin'; createdAt: string; orderCount: number; lifetimeCents: number }`
  - `listCustomers(): Promise<CustomerRowDTO[]>`
  - `getCustomerDetail(id: string): Promise<{ customer: CustomerRowDTO; orders: OrderRowDTO[] } | null>`
  - `listOrdersForUser(userId: string): Promise<OrderRowDTO[]>` (in `lib/services/orders.ts`)

Lifetime value counts only orders that reached `paid`, `shipped` or `delivered` — a cancelled or failed order is not revenue.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/services/admin-customers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Order } from '@/lib/db/models/order';
import { User } from '@/lib/db/models/user';
import { getCustomerDetail, listCustomers } from '@/lib/services/users';
import { withTestDatabase } from '@/tests/setup/db';

withTestDatabase();

async function seedCustomer(email = 'buyer@example.com') {
  return User.create({ email, passwordHash: 'x', name: 'A Buyer', role: 'customer' });
}

async function seedOrder(userId: unknown, orderNumber: string, status: string, totalCents: number) {
  return Order.create({
    orderNumber, userId, email: 'buyer@example.com',
    items: [{ title: 'Field Tee', size: 's', color: 'sand', sku: 'S1', unitPriceCents: totalCents, quantity: 1 }],
    shippingAddress: { name: 'A', line1: '1', city: 'Austin', state: 'TX', postalCode: '78701', country: 'US' },
    subtotalCents: totalCents, shippingCents: 0, taxCents: 0, totalCents, status,
  });
}

describe('listCustomers', () => {
  it('counts orders and sums lifetime value', async () => {
    const user = await seedCustomer();
    await seedOrder(user._id, 'SL-1', 'paid', 4200);
    await seedOrder(user._id, 'SL-2', 'delivered', 5800);

    const [row] = await listCustomers();

    expect(row).toMatchObject({ email: 'buyer@example.com', orderCount: 2, lifetimeCents: 10000 });
  });

  it('excludes cancelled and failed orders from lifetime value', async () => {
    const user = await seedCustomer();
    await seedOrder(user._id, 'SL-1', 'paid', 4200);
    await seedOrder(user._id, 'SL-2', 'cancelled', 9900);
    await seedOrder(user._id, 'SL-3', 'payment_failed', 9900);

    const [row] = await listCustomers();

    expect(row.orderCount).toBe(3);
    expect(row.lifetimeCents).toBe(4200);
  });

  it('returns a customer with no orders', async () => {
    await seedCustomer();

    const [row] = await listCustomers();

    expect(row).toMatchObject({ orderCount: 0, lifetimeCents: 0 });
  });
});

describe('getCustomerDetail', () => {
  it('returns the customer with their order rows', async () => {
    const user = await seedCustomer();
    await seedOrder(user._id, 'SL-1', 'paid', 4200);

    const detail = await getCustomerDetail(String(user._id));

    expect(detail?.customer.email).toBe('buyer@example.com');
    expect(detail?.orders.map((order) => order.orderNumber)).toEqual(['SL-1']);
  });

  it('returns null for an unknown id', async () => {
    expect(await getCustomerDetail('64b7f3c2a1b2c3d4e5f60718')).toBeNull();
  });

  it('returns null for a malformed id', async () => {
    expect(await getCustomerDetail('nope')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/services/admin-customers.test.ts`
Expected: FAIL — `listCustomers is not a function`.

- [ ] **Step 3: Add the DTO**

Append to `types/dto.ts`:

```ts
export type CustomerRowDTO = {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'admin';
  createdAt: string;
  orderCount: number;
  lifetimeCents: number;
};
```

- [ ] **Step 4: Add `listOrdersForUser`**

Append to `lib/services/orders.ts`:

```ts
export async function listOrdersForUser(userId: string): Promise<OrderRowDTO[]> {
  if (!Types.ObjectId.isValid(userId)) return [];

  await connectToDatabase();

  const orders = await Order.find({ userId }).sort({ createdAt: -1 }).lean();
  return orders.map((order) => toRow(toOrderDTO(order)));
}
```

- [ ] **Step 5: Add the customer services**

Append to `lib/services/users.ts`, with the imports:

```ts
import { Order } from '@/lib/db/models/order';
import { listOrdersForUser } from '@/lib/services/orders';
import type { CustomerRowDTO, OrderRowDTO } from '@/types/dto';
```

```ts
/** Cancelled and failed orders are not revenue. */
const REVENUE_STATUSES = ['paid', 'shipped', 'delivered'];

export async function listCustomers(): Promise<CustomerRowDTO[]> {
  await connectToDatabase();

  const users = await User.find({}).sort({ createdAt: -1 }).lean();
  const orders = await Order.find({ userId: { $in: users.map((user) => user._id) } })
    .select('userId status totalCents')
    .lean();

  return users.map((user) => {
    const theirs = orders.filter((order) => String(order.userId) === String(user._id));

    return {
      id: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role === 'admin' ? 'admin' : 'customer',
      createdAt: (user as { createdAt?: Date }).createdAt?.toISOString() ?? '',
      orderCount: theirs.length,
      lifetimeCents: theirs
        .filter((order) => REVENUE_STATUSES.includes(order.status))
        .reduce((sum, order) => sum + order.totalCents, 0),
    };
  });
}

export async function getCustomerDetail(
  id: string,
): Promise<{ customer: CustomerRowDTO; orders: OrderRowDTO[] } | null> {
  if (!Types.ObjectId.isValid(id)) return null;

  const customer = (await listCustomers()).find((row) => row.id === id);
  if (!customer) return null;

  return { customer, orders: await listOrdersForUser(id) };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/unit/services/admin-customers.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Build the pages**

Create `app/(admin)/admin/customers/page.tsx`:

```tsx
import Link from 'next/link';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { requireAdminPage } from '@/lib/auth/guards';
import { formatCents } from '@/lib/money';
import { listCustomers } from '@/lib/services/users';
import type { CustomerRowDTO } from '@/types/dto';

const columns: Column<CustomerRowDTO>[] = [
  { key: 'email', header: 'Email', cell: (row) => <Link href={`/admin/customers/${row.id}`}>{row.email}</Link> },
  { key: 'name', header: 'Name', cell: (row) => row.name || '—' },
  { key: 'role', header: 'Role', cell: (row) => row.role },
  { key: 'orders', header: 'Orders', cell: (row) => row.orderCount },
  { key: 'lifetime', header: 'Lifetime', cell: (row) => formatCents(row.lifetimeCents) },
];

export default async function AdminCustomersPage() {
  await requireAdminPage();
  const rows = await listCustomers();

  return (
    <section>
      <h1>Customers</h1>
      <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} empty="No customers yet." />
    </section>
  );
}
```

Create `app/(admin)/admin/customers/[id]/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/auth/guards';
import { formatCents } from '@/lib/money';
import { getCustomerDetail } from '@/lib/services/users';

export default async function AdminCustomerPage({ params }: PageProps<'/admin/customers/[id]'>) {
  await requireAdminPage();

  const { id } = await params;
  const detail = await getCustomerDetail(id);
  if (!detail) notFound();

  return (
    <section>
      <h1>{detail.customer.email}</h1>
      <dl>
        <dt>Name</dt><dd>{detail.customer.name || '—'}</dd>
        <dt>Role</dt><dd>{detail.customer.role}</dd>
        <dt>Lifetime value</dt><dd>{formatCents(detail.customer.lifetimeCents)}</dd>
      </dl>

      <h2>Orders</h2>
      {detail.orders.length ? (
        <ul>
          {detail.orders.map((order) => (
            <li key={order.id}>
              <Link href={`/admin/orders/${order.id}`}>{order.orderNumber}</Link>{' '}
              — {order.status} — {formatCents(order.totalCents)}
            </li>
          ))}
        </ul>
      ) : (
        <p>No orders yet.</p>
      )}
    </section>
  );
}
```

Customers are read-only in v1: no edit form, and above all no role control.

- [ ] **Step 8: Verify at runtime**

As the admin, `/admin/customers` lists the registered accounts; clicking one shows its order history (empty for accounts that predate the seeded orders).

- [ ] **Step 9: Commit**

```bash
npm run test && npx tsc --noEmit && npm run lint
git add lib/services/users.ts lib/services/orders.ts types/dto.ts "app/(admin)/admin/customers" tests/unit/services/admin-customers.test.ts
git commit -m "feat: add read-only admin customer views"
```

---

## Task 11: Store settings

**Files:**
- Create: `lib/validation/settings.ts`, `app/actions/admin/settings.ts`, `components/admin/SettingsForm.tsx`, `app/(admin)/admin/settings/page.tsx`, `tests/unit/services/settings-update.test.ts`
- Modify: `lib/services/settings.ts`

**Interfaces:**
- Consumes: `getStoreSettings`, the `Settings` model
- Produces:
  - `settingsInputSchema` and `type SettingsInput`
  - `updateStoreSettings(input: SettingsInput): Promise<SettingsDTO>`
  - `saveSettingsAction(input: unknown): Promise<{ ok: true } | { ok: false; error: string }>`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/services/settings-update.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getStoreSettings, updateStoreSettings } from '@/lib/services/settings';
import { settingsInputSchema } from '@/lib/validation/settings';
import { withTestDatabase } from '@/tests/setup/db';

withTestDatabase();

const input = {
  storeEmail: 'orders@shrinkless.com',
  announcement: 'Free shipping over $75',
  shippingZones: [{ name: 'Domestic', states: ['TX', 'CA'], rateCents: 500 }],
  freeShippingThresholdCents: 7500,
  taxMode: 'flat' as const,
  flatTaxRateBasisPoints: 825,
};

describe('updateStoreSettings', () => {
  it('creates the singleton when none exists', async () => {
    const saved = await updateStoreSettings(input);

    expect(saved.announcement).toBe('Free shipping over $75');
    expect(saved.shippingZones[0]).toMatchObject({ name: 'Domestic', rateCents: 500 });
  });

  it('updates in place rather than creating a second document', async () => {
    await updateStoreSettings(input);
    await updateStoreSettings({ ...input, announcement: 'Changed' });

    const settings = await getStoreSettings();
    expect(settings.announcement).toBe('Changed');
  });

  it('can clear the free shipping threshold', async () => {
    await updateStoreSettings(input);
    const saved = await updateStoreSettings({ ...input, freeShippingThresholdCents: null });

    expect(saved.freeShippingThresholdCents).toBeNull();
  });
});

describe('settingsInputSchema', () => {
  it('rejects a non-integer rate, because money is integer cents', () => {
    const result = settingsInputSchema.safeParse({
      ...input,
      shippingZones: [{ name: 'Domestic', states: ['TX'], rateCents: 5.5 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(settingsInputSchema.safeParse({ ...input, storeEmail: 'nope' }).success).toBe(false);
  });

  it('uppercases state codes', () => {
    const parsed = settingsInputSchema.parse({
      ...input,
      shippingZones: [{ name: 'Domestic', states: ['tx'], rateCents: 500 }],
    });
    expect(parsed.shippingZones[0].states).toEqual(['TX']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/services/settings-update.test.ts`
Expected: FAIL — module and function missing.

- [ ] **Step 3: Write the schema**

Create `lib/validation/settings.ts`:

```ts
import { z } from 'zod';

const zoneSchema = z.object({
  name: z.string().trim().min(1, 'Zone name is required'),
  states: z.array(z.string().trim().toUpperCase().length(2)).default([]),
  rateCents: z.number().int().min(0),
});

export const settingsInputSchema = z.object({
  storeEmail: z.string().trim().toLowerCase().pipe(z.email()),
  announcement: z.string().trim().default(''),
  shippingZones: z.array(zoneSchema).default([]),
  freeShippingThresholdCents: z.number().int().min(0).nullable().default(null),
  taxMode: z.enum(['none', 'flat', 'stripe']),
  flatTaxRateBasisPoints: z.number().int().min(0).max(10_000).default(0),
});

export type SettingsInput = z.infer<typeof settingsInputSchema>;
```

- [ ] **Step 4: Implement the service**

Append to `lib/services/settings.ts`, adding `import type { SettingsInput } from '@/lib/validation/settings';`:

```ts
export async function updateStoreSettings(input: SettingsInput): Promise<SettingsDTO> {
  await connectToDatabase();

  await Settings.findOneAndUpdate(
    { key: 'store' },
    {
      $set: {
        storeEmail: input.storeEmail,
        announcement: input.announcement,
        shippingZones: input.shippingZones,
        freeShippingThresholdCents: input.freeShippingThresholdCents,
        taxMode: input.taxMode,
        flatTaxRateBasisPoints: input.flatTaxRateBasisPoints,
      },
      $setOnInsert: { key: 'store' },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );

  return getStoreSettings();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/services/settings-update.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Write the action**

Create `app/actions/admin/settings.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { NotAuthorizedError, requireAdminActor } from '@/lib/auth/guards';
import { updateStoreSettings } from '@/lib/services/settings';
import { settingsInputSchema } from '@/lib/validation/settings';

export type SaveSettingsResult = { ok: true } | { ok: false; error: string };

export async function saveSettingsAction(input: unknown): Promise<SaveSettingsResult> {
  try {
    await requireAdminActor();
  } catch (error) {
    if (error instanceof NotAuthorizedError) return { ok: false, error: 'Not authorised.' };
    throw error;
  }

  const parsed = settingsInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the settings.' };
  }

  await updateStoreSettings(parsed.data);

  revalidatePath('/admin/settings');
  revalidatePath('/', 'layout');

  return { ok: true };
}
```

- [ ] **Step 7: Build the form and page**

Create `components/admin/SettingsForm.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import { saveSettingsAction } from '@/app/actions/admin/settings';
import type { SettingsDTO } from '@/types/dto';

type Zone = SettingsDTO['shippingZones'][number];

export function SettingsForm({ settings }: { settings: SettingsDTO }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [storeEmail, setStoreEmail] = useState(settings.storeEmail);
  const [announcement, setAnnouncement] = useState(settings.announcement);
  const [zones, setZones] = useState<Zone[]>(settings.shippingZones);
  const [threshold, setThreshold] = useState(
    settings.freeShippingThresholdCents === null ? '' : String(settings.freeShippingThresholdCents),
  );
  const [taxMode, setTaxMode] = useState(settings.taxMode);
  const [taxRate, setTaxRate] = useState(String(settings.flatTaxRateBasisPoints));

  function updateZone(index: number, patch: Partial<Zone>) {
    setZones(zones.map((zone, i) => (i === index ? { ...zone, ...patch } : zone)));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');

    startTransition(async () => {
      const result = await saveSettingsAction({
        storeEmail,
        announcement,
        shippingZones: zones,
        freeShippingThresholdCents: threshold === '' ? null : Number(threshold),
        taxMode,
        flatTaxRateBasisPoints: Number(taxRate),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage('Settings saved.');
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>Store email
        <input type="email" value={storeEmail} onChange={(e) => setStoreEmail(e.target.value)} required />
      </label>

      <label>Announcement bar
        <input value={announcement} onChange={(e) => setAnnouncement(e.target.value)} />
      </label>

      <fieldset>
        <legend>Shipping zones</legend>
        {zones.map((zone, index) => (
          <div key={index}>
            <label>Name
              <input value={zone.name} onChange={(e) => updateZone(index, { name: e.target.value })} />
            </label>
            <label>States (comma separated, two-letter codes)
              <input
                value={zone.states.join(', ')}
                onChange={(e) => updateZone(index, {
                  states: e.target.value.split(',').map((part) => part.trim()).filter(Boolean),
                })}
              />
            </label>
            <label>Rate (cents)
              <input
                type="number" min={0} step={1} value={zone.rateCents}
                onChange={(e) => updateZone(index, { rateCents: Number(e.target.value) })}
              />
            </label>
            <button type="button" onClick={() => setZones(zones.filter((_, i) => i !== index))}>
              Remove zone
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setZones([...zones, { name: '', states: [], rateCents: 0 }])}>
          Add zone
        </button>
      </fieldset>

      <label>Free shipping threshold (cents, blank for none)
        <input type="number" min={0} step={1} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
      </label>

      <label>Tax mode
        <select value={taxMode} onChange={(e) => setTaxMode(e.target.value as SettingsDTO['taxMode'])}>
          <option value="none">None</option>
          <option value="flat">Flat rate</option>
          <option value="stripe">Stripe Tax</option>
        </select>
      </label>

      <label>Flat tax rate (basis points)
        <input type="number" min={0} max={10000} step={1} value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
      </label>

      <button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save settings'}</button>
      {message ? <p role="status">{message}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
```

Create `app/(admin)/admin/settings/page.tsx`:

```tsx
import { SettingsForm } from '@/components/admin/SettingsForm';
import { requireAdminPage } from '@/lib/auth/guards';
import { getStoreSettings } from '@/lib/services/settings';

export default async function AdminSettingsPage() {
  await requireAdminPage();
  const settings = await getStoreSettings();

  return (
    <section>
      <h1>Store settings</h1>
      {/* The shipping/tax rules themselves are a Phase 5 concern; this page
          only stores the values lib/pricing will consume. */}
      <SettingsForm settings={settings} />
    </section>
  );
}
```

- [ ] **Step 8: Verify at runtime**

As the admin: `/admin/settings` → add a zone named `Domestic` with states `TX, CA` and rate `500`, set the threshold to `7500`, save. Expected: "Settings saved."; a reload shows the persisted values.

- [ ] **Step 9: Commit**

```bash
npm run test && npx tsc --noEmit && npm run lint
git add lib/validation/settings.ts lib/services/settings.ts app/actions/admin/settings.ts "app/(admin)/admin/settings" components/admin/SettingsForm.tsx tests/unit/services/settings-update.test.ts
git commit -m "feat: add editable store settings"
```

---

## Task 12: Dashboard metrics and phase verification

**Files:**
- Create: `lib/services/stats.ts`, `tests/unit/services/stats.test.ts`
- Modify: `app/(admin)/admin/page.tsx`, `types/dto.ts`, `docs/superpowers/specs/HANDOFF.md`

**Interfaces:**
- Consumes: `Order`, `Product`, `Variant` models
- Produces:
  - `type LowStockRowDTO = { sku: string; title: string; size: string; color: string; stock: number }`
  - `type AdminStatsDTO = { ordersToday: number; revenueWeekCents: number; lowStock: LowStockRowDTO[] }`
  - `getAdminStats(now?: Date): Promise<AdminStatsDTO>`

Rules: "today" and "this week" derive from `now` (injectable, so the test is not clock-dependent); week = the trailing 7 days; revenue counts `paid | shipped | delivered` only; low stock = enabled variants with `stock <= 3`, lowest first.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/services/stats.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Order } from '@/lib/db/models/order';
import { Product } from '@/lib/db/models/product';
import { Variant } from '@/lib/db/models/variant';
import { getAdminStats } from '@/lib/services/stats';
import { withTestDatabase } from '@/tests/setup/db';

withTestDatabase();

const NOW = new Date('2026-08-21T12:00:00.000Z');

async function seedOrder(orderNumber: string, status: string, totalCents: number, createdAt: Date) {
  const order = await Order.create({
    orderNumber, email: 'buyer@example.com',
    items: [{ title: 'Field Tee', size: 's', color: 'sand', sku: 'S1', unitPriceCents: totalCents, quantity: 1 }],
    shippingAddress: { name: 'A', line1: '1', city: 'Austin', state: 'TX', postalCode: '78701', country: 'US' },
    subtotalCents: totalCents, shippingCents: 0, taxCents: 0, totalCents, status,
  });

  // timestamps:true stamps createdAt on insert, so backdate it afterwards.
  await Order.updateOne({ _id: order._id }, { $set: { createdAt } });
  return order;
}

describe('getAdminStats', () => {
  it('counts orders placed today', async () => {
    await seedOrder('SL-1', 'paid', 4200, new Date('2026-08-21T11:00:00.000Z'));
    await seedOrder('SL-2', 'paid', 4200, new Date('2026-08-19T01:00:00.000Z'));

    const stats = await getAdminStats(NOW);

    expect(stats.ordersToday).toBe(1);
  });

  it('sums the trailing week of revenue, excluding cancelled orders', async () => {
    await seedOrder('SL-1', 'paid', 4200, new Date('2026-08-20T01:00:00.000Z'));
    await seedOrder('SL-2', 'cancelled', 9900, new Date('2026-08-20T01:00:00.000Z'));
    await seedOrder('SL-3', 'delivered', 1000, new Date('2026-08-01T01:00:00.000Z'));

    const stats = await getAdminStats(NOW);

    expect(stats.revenueWeekCents).toBe(4200);
  });

  it('lists enabled low-stock variants, lowest first', async () => {
    const product = await Product.create({ title: 'Field Tee', slug: 'field-tee', category: 'tees' });
    await Variant.create([
      { productId: product._id, size: 's', color: 'sand', sku: 'A', priceCents: 4200, stock: 2 },
      { productId: product._id, size: 'm', color: 'sand', sku: 'B', priceCents: 4200, stock: 0 },
      { productId: product._id, size: 'l', color: 'sand', sku: 'C', priceCents: 4200, stock: 50 },
      { productId: product._id, size: 'xl', color: 'sand', sku: 'D', priceCents: 4200, stock: 1, enabled: false },
    ]);

    const stats = await getAdminStats(NOW);

    expect(stats.lowStock.map((row) => row.sku)).toEqual(['B', 'A']);
    expect(stats.lowStock[0].title).toBe('Field Tee');
  });

  it('returns zeroes on an empty store', async () => {
    expect(await getAdminStats(NOW)).toEqual({ ordersToday: 0, revenueWeekCents: 0, lowStock: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/services/stats.test.ts`
Expected: FAIL — cannot resolve `@/lib/services/stats`.

- [ ] **Step 3: Add the DTOs**

Append to `types/dto.ts`:

```ts
export type LowStockRowDTO = {
  sku: string;
  title: string;
  size: string;
  color: string;
  stock: number;
};

export type AdminStatsDTO = {
  ordersToday: number;
  revenueWeekCents: number;
  lowStock: LowStockRowDTO[];
};
```

- [ ] **Step 4: Implement the service**

Create `lib/services/stats.ts`:

```ts
import { connectToDatabase } from '@/lib/db/connection';
import { Order } from '@/lib/db/models/order';
import { Product } from '@/lib/db/models/product';
import { Variant } from '@/lib/db/models/variant';
import type { AdminStatsDTO } from '@/types/dto';

const REVENUE_STATUSES = ['paid', 'shipped', 'delivered'];
const LOW_STOCK_THRESHOLD = 3;

export async function getAdminStats(now: Date = new Date()): Promise<AdminStatsDTO> {
  await connectToDatabase();

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const ordersToday = await Order.countDocuments({ createdAt: { $gte: startOfToday } });

  const weekOrders = await Order.find({
    createdAt: { $gte: startOfWeek },
    status: { $in: REVENUE_STATUSES },
  }).select('totalCents').lean();

  const lowVariants = await Variant.find({ enabled: true, stock: { $lte: LOW_STOCK_THRESHOLD } })
    .sort({ stock: 1 })
    .limit(20)
    .lean();

  const products = await Product.find({ _id: { $in: lowVariants.map((variant) => variant.productId) } })
    .select('title')
    .lean();
  const titleById = new Map(products.map((product) => [String(product._id), product.title]));

  return {
    ordersToday,
    revenueWeekCents: weekOrders.reduce((sum, order) => sum + order.totalCents, 0),
    lowStock: lowVariants.map((variant) => ({
      sku: variant.sku,
      title: titleById.get(String(variant.productId)) ?? 'Unknown product',
      size: variant.size,
      color: variant.color,
      stock: variant.stock,
    })),
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/services/stats.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Render the dashboard**

Replace `app/(admin)/admin/page.tsx`:

```tsx
import Link from 'next/link';
import { requireAdminPage } from '@/lib/auth/guards';
import { formatCents } from '@/lib/money';
import { getAdminStats } from '@/lib/services/stats';

export default async function AdminDashboardPage() {
  await requireAdminPage();
  const stats = await getAdminStats();

  return (
    <section>
      <h1>Dashboard</h1>

      <dl>
        <dt>Orders today</dt><dd>{stats.ordersToday}</dd>
        <dt>Revenue, last 7 days</dt><dd>{formatCents(stats.revenueWeekCents)}</dd>
      </dl>

      <h2>Low stock</h2>
      {stats.lowStock.length ? (
        <ul>
          {stats.lowStock.map((row) => (
            <li key={row.sku}>
              {row.title} — {row.size} / {row.color} — {row.stock} left
            </li>
          ))}
        </ul>
      ) : (
        <p>Nothing is running low.</p>
      )}

      <Link href="/admin/orders">All orders</Link>
    </section>
  );
}
```

- [ ] **Step 7: Full phase verification**

Run every gate and record the actual output:

```bash
npm run test
npx tsc --noEmit
npm run lint
npm run build
```

Then, with `npm run dev` and signed in as the admin, walk the whole phase:
1. `/admin` shows today's count, weekly revenue, and low-stock rows.
2. Create a product, publish it, confirm it appears on `/shop`.
3. Re-edit it, add a colour, confirm existing stock is untouched.
4. Upload an image, confirm it renders after a reload.
5. Ship, deliver and cancel orders from `/admin/orders`.
6. Save settings and reload.
7. Sign out, hit `/admin` → redirected to `/login?from=%2Fadmin`.
8. Sign in as a **customer**, hit `/admin` → redirected to `/login`.

- [ ] **Step 8: Prove the actions are guarded independently of the proxy**

The proxy is not the boundary, so show the actions hold on their own. Temporarily make `proxy.ts`'s handler return `NextResponse.next()` unconditionally, sign in as a **customer**, and open `/admin/products/new`.

Expected: the page still redirects to `/login`, because `requireAdminPage` runs in the layout.

Restore `proxy.ts` afterwards and confirm `git diff` shows no leftover change.

- [ ] **Step 9: Update the handoff**

Rewrite the "Next step" section of `docs/superpowers/specs/HANDOFF.md`: Phase 4 complete, the final test count, what was verified at runtime versus what was not, any gotchas found (especially whatever `proxy.ts` needed), and that Phase 5 — `lib/pricing`, checkout, both providers, both webhooks, idempotency, order emails — is next and warrants its own branch.

- [ ] **Step 10: Commit**

```bash
git add lib/services/stats.ts "app/(admin)/admin/page.tsx" types/dto.ts tests/unit/services/stats.test.ts docs/superpowers/specs/HANDOFF.md
git commit -m "feat: add admin dashboard metrics and close out Phase 4"
```

---

## Notes for the executor

- **`role` is never written in this phase.** If you find yourself adding a role dropdown to the customer page, stop — customers are read-only in v1 and admins come from `scripts/seed-admin.ts`.
- **Do not add a Cloudinary SDK.** The signature is a dozen lines of `node:crypto`; a dependency here buys nothing and drags an upload client into the bundle.
- **Do not delete variants.** Anywhere. If a test seems to want it, the test is wrong.
- **Do not style anything.** A Tailwind class in this phase is work that belongs to Phase 6.
