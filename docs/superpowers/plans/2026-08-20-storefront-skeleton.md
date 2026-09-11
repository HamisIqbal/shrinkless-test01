# Shrinkless Storefront Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the working storefront — home, product grid with filters, product detail with variant selection, cart drawer and cart page — so a shopper can browse the catalogue and fill a cart end to end.

**Architecture:** Server Components read through `lib/services/*`; only three small client islands hold interactivity (filter bar, variant picker, cart drawer). Cart identity lives in an httpOnly cookie that is created lazily inside a Server Action, because Next cannot set cookies during Server Component render.

**Tech Stack:** Next.js 16 App Router, React 19.2, TypeScript, Mongoose 9, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-08-20-shrinkless-design.md`

## Global Constraints

- **NO STYLING.** Semantic HTML and structural markup only. No Tailwind utility classes beyond what is needed to make something usable (e.g. a drawer needs `position: fixed`). The entire design system lands in Phase 6. Resist decorating.
- **Next 16 async request APIs.** `params`, `searchParams`, `cookies()`, and `headers()` are Promises. Always `await` them. Synchronous access was removed in 16.
- **Use the generated props helpers:** `PageProps<'/product/[slug]'>` and `LayoutProps<'/'>`. Run `npx next typegen` if they are missing.
- **Cookies are set only in Server Actions or Route Handlers**, never during Server Component render. Reading is fine anywhere.
- **Components never import Mongoose.** Pages call `lib/services/*` only.
- **All money stays integer cents**; format with `formatCents` at render time only.
- **`revalidatePath` after every cart mutation**, or the server-rendered cart will go stale.
- **Commit after every task.**

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/shop/filters.ts` | Pure helpers to read/write filter state as searchParams |
| `lib/cart-session.ts` | Cart cookie plumbing: read id, create id |
| `app/actions/cart.ts` | Server Actions for cart mutations |
| `app/(shop)/layout.tsx` | Shop shell: announcement, header, nav, footer |
| `app/(shop)/page.tsx` | Home |
| `app/(shop)/shop/[[...category]]/page.tsx` | Grid, optional category segment |
| `app/(shop)/product/[slug]/page.tsx` | Product detail |
| `app/(shop)/cart/page.tsx` | Full cart page |
| `components/shop/FilterBar.tsx` | Client island: pushes searchParams |
| `components/shop/VariantPicker.tsx` | Client island: size/colour → variant → add to cart |
| `components/shop/MiniCart.tsx` | Client island: drawer |
| `components/shop/ProductCard.tsx` | Server component: grid tile |

---

## Task 1: Filter helpers

**Files:**
- Create: `lib/shop/filters.ts`, `tests/unit/shop/filters.test.ts`

**Interfaces:**
- Consumes: `ProductFilter`, `PRODUCT_SORTS` from `lib/validation/catalogue`
- Produces:
  - `buildFilterQuery(current: ProductFilter, change: Partial<FilterChange>): string` — returns a query string
  - `toggleValue(list: string[], value: string): string[]`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/shop/filters.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildFilterQuery, toggleValue } from '@/lib/shop/filters';

const empty = { sizes: [], colors: [], sort: 'newest' as const };

describe('toggleValue', () => {
  it('adds a value that is absent', () => {
    expect(toggleValue([], 'm')).toEqual(['m']);
  });

  it('removes a value that is present', () => {
    expect(toggleValue(['s', 'm'], 'm')).toEqual(['s']);
  });
});

describe('buildFilterQuery', () => {
  it('returns an empty string when nothing is selected', () => {
    expect(buildFilterQuery(empty, {})).toBe('');
  });

  it('serialises sizes as a comma-separated list', () => {
    expect(buildFilterQuery({ ...empty, sizes: ['s', 'm'] }, {})).toBe('size=s%2Cm');
  });

  it('omits the default sort', () => {
    expect(buildFilterQuery({ ...empty, sort: 'newest' }, {})).toBe('');
  });

  it('includes a non-default sort', () => {
    expect(buildFilterQuery({ ...empty, sort: 'price-asc' }, {})).toBe('sort=price-asc');
  });

  it('applies a change over the current state', () => {
    expect(buildFilterQuery(empty, { sizes: ['l'] })).toBe('size=l');
  });

  it('combines every dimension', () => {
    const q = buildFilterQuery({ sizes: ['m'], colors: ['sand'], sort: 'price-desc' }, {});
    expect(q).toBe('size=m&color=sand&sort=price-desc');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- shop/filters`
Expected: FAIL — cannot resolve `@/lib/shop/filters`.

- [ ] **Step 3: Implement**

Create `lib/shop/filters.ts`:

```ts
import type { ProductFilter, ProductSort } from '@/lib/validation/catalogue';

export type FilterChange = {
  sizes: string[];
  colors: string[];
  sort: ProductSort;
};

export function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function buildFilterQuery(
  current: ProductFilter,
  change: Partial<FilterChange>,
): string {
  const next = { ...current, ...change };
  const params = new URLSearchParams();

  if (next.sizes.length) params.set('size', next.sizes.join(','));
  if (next.colors.length) params.set('color', next.colors.join(','));
  if (next.sort !== 'newest') params.set('sort', next.sort);

  return params.toString();
}
```

Omitting the default sort keeps `/shop` clean rather than `/shop?sort=newest`, so the canonical URL for the unfiltered grid has no query string at all.

- [ ] **Step 4: Run the tests**

Run: `npm test -- shop/filters`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add shop filter query helpers"
```

---

## Task 2: Cart session and Server Actions

**Files:**
- Create: `lib/cart-session.ts`, `app/actions/cart.ts`

**Interfaces:**
- Consumes: `createCart`, `addItemToCart`, `updateCartItemQuantity`, `getCartView` from `lib/services/cart`
- Produces:
  - `readCartId(): Promise<string | null>` — safe in Server Components
  - `readCartView(): Promise<CartViewDTO | null>` — safe in Server Components
  - `addToCartAction(variantId: string, quantity: number): Promise<ActionResult>`
  - `updateQuantityAction(variantId: string, quantity: number): Promise<ActionResult>`
  - `ActionResult = { ok: true; cart: CartViewDTO } | { ok: false; error: string }`

> **Why the split:** `readCartId` only reads, so pages can call it. Creating a cart writes a cookie, which Next allows only inside a Server Action or Route Handler — so the cart is created lazily on first add, not on first page view.

- [ ] **Step 1: Write the cookie plumbing**

Create `lib/cart-session.ts`:

```ts
import { cookies } from 'next/headers';
import { getCartView } from '@/lib/services/cart';
import type { CartViewDTO } from '@/types/dto';

export const CART_COOKIE = 'shrinkless_cart';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 30,
} as const;

/** Read-only: safe to call from Server Components. */
export async function readCartId(): Promise<string | null> {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value ?? null;
}

/** Read-only: safe to call from Server Components. */
export async function readCartView(): Promise<CartViewDTO | null> {
  const cartId = await readCartId();
  if (!cartId) return null;

  return getCartView(cartId);
}

/** Writes a cookie — only valid inside a Server Action or Route Handler. */
export async function persistCartId(cartId: string): Promise<void> {
  const store = await cookies();
  store.set(CART_COOKIE, cartId, COOKIE_OPTIONS);
}
```

- [ ] **Step 2: Write the Server Actions**

Create `app/actions/cart.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import {
  addItemToCart,
  createCart,
  getCartView,
  updateCartItemQuantity,
} from '@/lib/services/cart';
import { persistCartId, readCartId } from '@/lib/cart-session';
import type { CartViewDTO } from '@/types/dto';

export type ActionResult =
  | { ok: true; cart: CartViewDTO }
  | { ok: false; error: string };

function failure(error: unknown): ActionResult {
  const message = error instanceof Error ? error.message : 'Something went wrong';
  return { ok: false, error: message };
}

function revalidateCartSurfaces(): void {
  revalidatePath('/cart');
  revalidatePath('/', 'layout');
}

async function resolveCartId(): Promise<string> {
  const existing = await readCartId();
  if (existing && (await getCartView(existing))) return existing;

  const created = await createCart();
  await persistCartId(created);
  return created;
}

export async function addToCartAction(
  variantId: string,
  quantity: number,
): Promise<ActionResult> {
  try {
    const cartId = await resolveCartId();
    const cart = await addItemToCart(cartId, variantId, quantity);
    revalidateCartSurfaces();
    return { ok: true, cart };
  } catch (error) {
    return failure(error);
  }
}

export async function updateQuantityAction(
  variantId: string,
  quantity: number,
): Promise<ActionResult> {
  try {
    const cartId = await readCartId();
    if (!cartId) return { ok: false, error: 'No cart' };

    const cart = await updateCartItemQuantity(cartId, variantId, quantity);
    revalidateCartSurfaces();
    return { ok: true, cart };
  } catch (error) {
    return failure(error);
  }
}
```

`resolveCartId` re-checks that the cart still exists rather than trusting the cookie. A stale cookie pointing at a deleted cart would otherwise throw on every add.

Errors are returned as values rather than thrown, so the client island can render "only 3 left" inline instead of triggering an error boundary.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add cart session cookie and cart Server Actions"
```

---

## Task 3: Shop layout and home page

**Files:**
- Create: `app/(shop)/layout.tsx`, `app/(shop)/page.tsx`
- Delete: `app/page.tsx` (moves into the route group)

**Interfaces:**
- Consumes: `getStoreSettings`, `listPublishedProducts`, `readCartView`
- Produces: the shop shell every storefront page renders inside

- [ ] **Step 1: Move the homepage into the route group**

```bash
git rm app/page.tsx
mkdir -p "app/(shop)"
```

Route groups in parentheses do not affect the URL — `app/(shop)/page.tsx` still serves `/`.

- [ ] **Step 2: Write the layout**

Create `app/(shop)/layout.tsx`:

```tsx
import Link from 'next/link';
import { getStoreSettings } from '@/lib/services/settings';
import { readCartView } from '@/lib/cart-session';

export default async function ShopLayout({ children }: LayoutProps<'/'>) {
  const [settings, cart] = await Promise.all([getStoreSettings(), readCartView()]);

  return (
    <div>
      {settings.announcement ? <p role="status">{settings.announcement}</p> : null}

      <header>
        <Link href="/">Shrinkless</Link>
        <nav aria-label="Main">
          <ul>
            <li><Link href="/shop">Shop</Link></li>
            <li><Link href="/about">About</Link></li>
            <li>
              <Link href="/cart">Cart ({cart?.itemCount ?? 0})</Link>
            </li>
          </ul>
        </nav>
      </header>

      <main>{children}</main>

      <footer>
        <p>&copy; {new Date().getFullYear()} Shrinkless</p>
        <p>{settings.storeEmail}</p>
      </footer>
    </div>
  );
}
```

- [ ] **Step 3: Write the home page**

Create `app/(shop)/page.tsx`:

```tsx
import Link from 'next/link';
import { listPublishedProducts } from '@/lib/services/products';
import { ProductCard } from '@/components/shop/ProductCard';

export default async function HomePage() {
  const products = await listPublishedProducts({ sizes: [], colors: [], sort: 'newest' });
  const featured = products.slice(0, 3);

  return (
    <div>
      <section aria-labelledby="hero-heading">
        <h1 id="hero-heading">Shirts, cut for everyday wear.</h1>
        <p>Heavyweight cotton. Made to be worn, washed, and worn again.</p>
        <Link href="/shop">Shop all</Link>
      </section>

      <section aria-labelledby="featured-heading">
        <h2 id="featured-heading">Featured</h2>
        {featured.length === 0 ? (
          <p>Nothing in stock yet.</p>
        ) : (
          <ul>
            {featured.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Write the product card**

Create `components/shop/ProductCard.tsx`:

```tsx
import Link from 'next/link';
import { formatCents } from '@/lib/money';
import type { ProductDTO } from '@/types/dto';

export function ProductCard({ product }: { product: ProductDTO }) {
  const soldOut = product.variants.every((variant) => !variant.inStock);

  return (
    <article>
      <h3>
        <Link href={`/product/${product.slug}`}>{product.title}</Link>
      </h3>
      <p>{formatCents(product.minPriceCents)}</p>
      {soldOut ? <p>Sold out</p> : null}
    </article>
  );
}
```

No `next/image` yet — there are no real product images until the admin panel exists in Phase 4, and the design pass in Phase 6 decides the aspect ratios.

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: build succeeds and `/` is listed.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add shop layout, home page, and product card"
```

---

## Task 4: Product grid with filters

**Files:**
- Create: `app/(shop)/shop/[[...category]]/page.tsx`, `components/shop/FilterBar.tsx`

**Interfaces:**
- Consumes: `listPublishedProducts`, `productFilterSchema`, `buildFilterQuery`, `toggleValue`
- Produces: `/shop` and `/shop/<category>`, both filterable via searchParams

- [ ] **Step 1: Write the grid page**

Create `app/(shop)/shop/[[...category]]/page.tsx`:

```tsx
import { listPublishedProducts } from '@/lib/services/products';
import { productFilterSchema } from '@/lib/validation/catalogue';
import { ProductCard } from '@/components/shop/ProductCard';
import { FilterBar } from '@/components/shop/FilterBar';

export default async function ShopPage(props: PageProps<'/shop/[[...category]]'>) {
  const [{ category }, rawSearch] = await Promise.all([props.params, props.searchParams]);

  const filter = productFilterSchema.parse(rawSearch);
  const categorySlug = category?.[0];
  const products = await listPublishedProducts(filter, categorySlug);

  const allSizes = [...new Set(products.flatMap((p) => p.sizes))].sort();
  const allColors = [...new Set(products.flatMap((p) => p.colors))].sort();

  return (
    <div>
      <h1>{categorySlug ? `Shop: ${categorySlug}` : 'Shop all'}</h1>

      <FilterBar
        filter={filter}
        sizes={allSizes}
        colors={allColors}
        basePath={categorySlug ? `/shop/${categorySlug}` : '/shop'}
      />

      <p aria-live="polite">
        {products.length} {products.length === 1 ? 'product' : 'products'}
      </p>

      {products.length === 0 ? (
        <p>Nothing matches those filters.</p>
      ) : (
        <ul>
          {products.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

`params` and `searchParams` are both awaited — Next 16 removed synchronous access. The optional catch-all `[[...category]]` makes one file serve both `/shop` and `/shop/shirts`.

The filter option lists are derived from the returned products rather than hardcoded, so they stay correct as the catalogue changes.

- [ ] **Step 2: Write the filter bar client island**

Create `components/shop/FilterBar.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { buildFilterQuery, toggleValue } from '@/lib/shop/filters';
import { PRODUCT_SORTS, type ProductFilter, type ProductSort } from '@/lib/validation/catalogue';

type Props = {
  filter: ProductFilter;
  sizes: string[];
  colors: string[];
  basePath: string;
};

export function FilterBar({ filter, sizes, colors, basePath }: Props) {
  const router = useRouter();

  function apply(change: Parameters<typeof buildFilterQuery>[1]) {
    const query = buildFilterQuery(filter, change);
    router.push(query ? `${basePath}?${query}` : basePath);
  }

  return (
    <form aria-label="Filters" onSubmit={(event) => event.preventDefault()}>
      <fieldset>
        <legend>Size</legend>
        {sizes.map((size) => (
          <label key={size}>
            <input
              type="checkbox"
              checked={filter.sizes.includes(size)}
              onChange={() => apply({ sizes: toggleValue(filter.sizes, size) })}
            />
            {size.toUpperCase()}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Colour</legend>
        {colors.map((color) => (
          <label key={color}>
            <input
              type="checkbox"
              checked={filter.colors.includes(color)}
              onChange={() => apply({ colors: toggleValue(filter.colors, color) })}
            />
            {color}
          </label>
        ))}
      </fieldset>

      <label>
        Sort
        <select
          value={filter.sort}
          onChange={(event) => apply({ sort: event.target.value as ProductSort })}
        >
          {PRODUCT_SORTS.map((sort) => (
            <option key={sort} value={sort}>{sort}</option>
          ))}
        </select>
      </label>

      {(filter.sizes.length > 0 || filter.colors.length > 0) && (
        <button type="button" onClick={() => apply({ sizes: [], colors: [] })}>
          Clear filters
        </button>
      )}
    </form>
  );
}
```

The bar holds no local state — it pushes to the URL and lets the server re-render. That is what makes a filtered grid shareable and the back button correct.

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: `/shop/[[...category]]` appears in the route list as a dynamic route.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add product grid with URL-driven filters"
```

---

## Task 5: Product detail and variant picker

**Files:**
- Create: `app/(shop)/product/[slug]/page.tsx`, `components/shop/VariantPicker.tsx`

**Interfaces:**
- Consumes: `getPublishedProductBySlug`, `addToCartAction`
- Produces: `/product/<slug>` with working add-to-cart

- [ ] **Step 1: Write the product page**

Create `app/(shop)/product/[slug]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { getPublishedProductBySlug } from '@/lib/services/products';
import { VariantPicker } from '@/components/shop/VariantPicker';
import { formatCents } from '@/lib/money';

export async function generateMetadata(props: PageProps<'/product/[slug]'>) {
  const { slug } = await props.params;
  const product = await getPublishedProductBySlug(slug);

  if (!product) return { title: 'Not found' };
  return { title: product.title, description: product.description };
}

export default async function ProductPage(props: PageProps<'/product/[slug]'>) {
  const { slug } = await props.params;
  const product = await getPublishedProductBySlug(slug);

  if (!product) notFound();

  return (
    <article>
      <h1>{product.title}</h1>
      <p>From {formatCents(product.minPriceCents)}</p>
      <p>{product.description}</p>

      <VariantPicker
        sizes={product.sizes}
        colors={product.colors}
        variants={product.variants}
      />
    </article>
  );
}
```

`notFound()` renders the 404 for unknown or draft products, so drafts are indistinguishable from nonexistent ones.

- [ ] **Step 2: Write the variant picker client island**

Create `components/shop/VariantPicker.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import { addToCartAction } from '@/app/actions/cart';
import { formatCents } from '@/lib/money';
import type { VariantDTO } from '@/types/dto';

type Props = {
  sizes: string[];
  colors: string[];
  variants: VariantDTO[];
};

export function VariantPicker({ sizes, colors, variants }: Props) {
  const [size, setSize] = useState(sizes[0] ?? '');
  const [color, setColor] = useState(colors[0] ?? '');
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  const selected = variants.find(
    (variant) => variant.size === size && variant.color === color && variant.enabled,
  );

  function findVariant(nextSize: string, nextColor: string) {
    return variants.find(
      (variant) => variant.size === nextSize && variant.color === nextColor && variant.enabled,
    );
  }

  function add() {
    if (!selected) return;

    startTransition(async () => {
      const result = await addToCartAction(selected.id, 1);
      setMessage(result.ok ? 'Added to cart' : result.error);
    });
  }

  return (
    <div>
      <fieldset>
        <legend>Size</legend>
        {sizes.map((option) => {
          const variant = findVariant(option, color);
          return (
            <label key={option}>
              <input
                type="radio"
                name="size"
                value={option}
                checked={size === option}
                disabled={!variant || !variant.inStock}
                onChange={() => setSize(option)}
              />
              {option.toUpperCase()}
              {variant && !variant.inStock ? ' (sold out)' : ''}
            </label>
          );
        })}
      </fieldset>

      <fieldset>
        <legend>Colour</legend>
        {colors.map((option) => (
          <label key={option}>
            <input
              type="radio"
              name="color"
              value={option}
              checked={color === option}
              onChange={() => setColor(option)}
            />
            {option}
          </label>
        ))}
      </fieldset>

      <p>{selected ? formatCents(selected.priceCents) : 'Unavailable'}</p>

      <button type="button" onClick={add} disabled={!selected || !selected.inStock || pending}>
        {pending ? 'Adding…' : 'Add to cart'}
      </button>

      <p role="status" aria-live="polite">{message}</p>
    </div>
  );
}
```

Sold-out sizes render **disabled, not hidden** — the shopper sees the size exists and is gone, which is the decision recorded in the spec.

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: `/product/[slug]` appears as a dynamic route.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add product detail page with variant picker"
```

---

## Task 6: Cart page

**Files:**
- Create: `app/(shop)/cart/page.tsx`, `components/shop/CartLines.tsx`

**Interfaces:**
- Consumes: `readCartView`, `updateQuantityAction`
- Produces: `/cart` with quantity editing and removal

- [ ] **Step 1: Write the cart page**

Create `app/(shop)/cart/page.tsx`:

```tsx
import Link from 'next/link';
import { readCartView } from '@/lib/cart-session';
import { CartLines } from '@/components/shop/CartLines';
import { formatCents } from '@/lib/money';

export default async function CartPage() {
  const cart = await readCartView();

  if (!cart || cart.lines.length === 0) {
    return (
      <div>
        <h1>Your cart</h1>
        <p>Your cart is empty.</p>
        <Link href="/shop">Shop all</Link>
      </div>
    );
  }

  return (
    <div>
      <h1>Your cart</h1>
      <CartLines lines={cart.lines} />
      <p>Subtotal: {formatCents(cart.subtotalCents)}</p>
      <p>Shipping and tax are calculated at checkout.</p>
      <Link href="/checkout">Checkout</Link>
    </div>
  );
}
```

- [ ] **Step 2: Write the line editor**

Create `components/shop/CartLines.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { updateQuantityAction } from '@/app/actions/cart';
import { formatCents } from '@/lib/money';
import type { CartLineDTO } from '@/types/dto';

export function CartLines({ lines }: { lines: CartLineDTO[] }) {
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function change(variantId: string, quantity: number) {
    startTransition(async () => {
      const result = await updateQuantityAction(variantId, quantity);
      setError(result.ok ? '' : result.error);
    });
  }

  return (
    <div>
      <ul>
        {lines.map((line) => (
          <li key={line.variantId}>
            <Link href={`/product/${line.productSlug}`}>{line.productTitle}</Link>
            <p>{line.size.toUpperCase()} / {line.color}</p>
            <p>{formatCents(line.unitPriceCents)} each</p>

            <label>
              Quantity
              <input
                type="number"
                min={1}
                max={line.availableStock}
                defaultValue={line.quantity}
                disabled={pending}
                onChange={(event) => change(line.variantId, Number(event.target.value))}
              />
            </label>

            <p>{formatCents(line.lineTotalCents)}</p>

            <button type="button" disabled={pending} onClick={() => change(line.variantId, 0)}>
              Remove
            </button>
          </li>
        ))}
      </ul>

      <p role="status" aria-live="polite">{error}</p>
    </div>
  );
}
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: `/cart` appears in the route list.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add cart page with quantity editing"
```

---

## Task 7: Runtime verification

**Files:**
- Modify: none (verification only)

**Interfaces:**
- Consumes: everything above
- Produces: proof the storefront works against the real seeded database

> **Environment note:** the Bash tool's sandbox blocks raw TCP/DNS, so the dev server and any request that touches MongoDB must be run through the **PowerShell** tool.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Run it in the background and wait for "Ready".

- [ ] **Step 2: Check every route responds**

```powershell
foreach ($path in '/', '/shop', '/shop/shirts', '/product/field-shirt', '/cart') {
  $r = Invoke-WebRequest -Uri "http://localhost:3000$path" -UseBasicParsing
  "$path -> $($r.StatusCode)"
}
```

Expected: every route returns 200.

- [ ] **Step 3: Confirm real data is rendering**

```powershell
$r = Invoke-WebRequest -Uri "http://localhost:3000/shop" -UseBasicParsing
if ($r.Content -match 'Field Shirt') { 'seeded product rendered' } else { 'NO PRODUCT DATA' }
$r2 = Invoke-WebRequest -Uri "http://localhost:3000/product/field-shirt" -UseBasicParsing
if ($r2.Content -match 'sold out') { 'sold-out XL rendered as disabled' } else { 'check variant states' }
```

Expected: the seeded `Field Shirt` renders, and the zero-stock XL shows as sold out.

- [ ] **Step 4: Check a filtered URL**

```powershell
$r = Invoke-WebRequest -Uri "http://localhost:3000/shop?size=s" -UseBasicParsing
"filtered: $($r.StatusCode)"
```

Expected: 200, with a product count reflecting the filter.

- [ ] **Step 5: Exercise add-to-cart in a browser**

Open `http://localhost:3000/product/field-shirt`, pick a size, click Add to cart. Confirm the header cart count increments and `/cart` lists the line. This is the one step that cannot be scripted, because it depends on the cookie round-trip through a real browser.

- [ ] **Step 6: Run the full check suite**

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: verify storefront skeleton against seeded data"
```

---

## Definition of Done

- [ ] `/`, `/shop`, `/shop/<category>`, `/product/<slug>`, and `/cart` all return 200
- [ ] The grid renders seeded products and filters via searchParams
- [ ] Filtered URLs are shareable and the back button restores the previous filter state
- [ ] Sold-out sizes render disabled, not hidden
- [ ] Add-to-cart persists across a page reload (cookie round-trip works)
- [ ] Quantity edits and removal update the subtotal
- [ ] `npm test`, `tsc --noEmit`, `lint`, and `build` are all clean
- [ ] No Mongoose import under `app/` or `components/`
- [ ] No styling beyond structural necessity

## Not In This Plan

| Deferred | Lands in |
|---|---|
| Mini-cart drawer overlay | Phase 6 — a drawer is a design artifact; the cart page carries Phase 2 |
| Guest→account cart merge wiring | Phase 3, when login exists to trigger it |
| `/about`, `/contact`, `/policies/[slug]` | Phase 6, when there is a shell worth putting copy in |
| Product imagery and `next/image` | Phase 4 uploads them, Phase 6 styles them |
| `/checkout` (the cart page links to it) | Phase 5 — the link 404s until then, which is expected |
