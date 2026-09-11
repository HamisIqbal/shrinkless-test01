# Shrinkless — storefront redesign (2026-08-21)

Replaces the 1970s workwear design system with a premium American essentials
editorial direction. Approved in brainstorm on 2026-08-21, sections 1–5.

**Scope.** Presentation layer only. Every `lib/services/*`, the cart session,
auth, orders, the admin backend and all 159 existing tests are untouched by
design. The admin is retokened so it does not break, and otherwise left alone.

**Not in scope.** Checkout and payments (Phase 5, still unbuilt). Real
photography (placeholders, see §4). Copy sign-off (see §11).

---

## 1. Direction

One sentence to settle arguments later: **the site should read as a brand that
makes one thing extremely well, and the photography and typography should carry
it — not the interface.**

Concretely, the following are banned in this codebase: gradients, glassmorphism,
box shadows, border radius above 0, accent colours, icon sets, card grids where
every child is the same shape, and any animation that moves an element more than
16px.

## 2. Tokens

Declared in `app/globals.css` under Tailwind v4 `@theme`. Nothing downstream
hardcodes a colour, a size or a duration.

### 2.1 Colour

| Token | Value | Use |
|---|---|---|
| `--color-ink` | `#0A0A0A` | All primary text; black bands |
| `--color-paper` | `#F5F4F0` | Default page ground |
| `--color-white` | `#FFFFFF` | Product grounds, alternating bands |
| `--color-muted` | `#A5A5A0` | **Rules, dividers, and display type ≥40px only** |
| `--color-muted-text` | `#6B6B66` | Small secondary text (4.9:1 on paper — passes AA) |
| `--color-warm` | `#D8D2C7` | Occasional warm band, swatch borders |
| `--color-scrim` | `rgba(10,10,10,0.28)` | Flat wash over hero photography |

`--color-muted` is `#A5A5A0` as briefed, but it measures **2.2:1** on
`--color-paper`, well under the 4.5:1 AA minimum. It is therefore not permitted
to carry body text anywhere. `--color-muted-text` exists for that job. A review
that finds `--color-muted` on 14px text should reject it.

`--color-scrim` is a flat tint, not a gradient ramp: white hero type must stay
legible over light frames, and a constant-alpha wash is the least visible way to
buy that contrast.

### 2.2 Type

Two families, loaded through `next/font/google` in `app/layout.tsx`:

```
--font-sans:   var(--font-inter-tight), "Helvetica Neue", Helvetica, Arial, sans-serif
--font-serif:  var(--font-cormorant), Georgia, serif
```

Neue Haas Grotesk is licensed and Helvetica Neue is not webfont-distributable,
so **Inter Tight** is the shipped face, with Helvetica Neue ahead of it in the
stack for machines that have it locally. Oswald and Zilla Slab are removed.

Cormorant Garamond appears in exactly two places: the quotation marks in the
testimonial row, and nowhere else without a spec change.

Fluid scale — editorial display type at 96px must not stay 96px on a phone:

| Token | clamp | Use |
|---|---|---|
| `--text-display` | `clamp(2.75rem, 9vw, 7.5rem)` | Hero, statement, promise |
| `--text-head` | `clamp(2rem, 5vw, 3.5rem)` | Section headlines |
| `--text-sub` | `clamp(1.25rem, 2.2vw, 1.75rem)` | Numbered points, PDP title |
| `--text-body` | `1rem` | Body copy |
| `--text-meta` | `0.8125rem` | Eyebrows, labels, product meta |

Display and head steps set `letter-spacing: -0.03em` and `line-height: 0.95`.
Eyebrows and labels set `letter-spacing: 0.14em`, uppercase. Body sets
`line-height: 1.6` and is never justified. Every price and quantity uses
`font-variant-numeric: tabular-nums`.

### 2.3 Space and grid

`--space-1` `0.5rem` through `--space-9` `10rem` on a modular scale; band
padding uses `--space-7`/`--space-8`.

Content grid is 12 columns, `max-width: 1600px`, page margin `clamp(1.25rem,
4vw, 4.5rem)`, gutter `1.5rem`. Collapses to 6 columns under 900px and 4 under
640px. Full-bleed sections escape the container entirely rather than being given
negative margins.

Breakpoints: `640px`, `900px`, `1200px`. Rules are always `1px solid
var(--color-muted)`.

## 3. Motion

| Behaviour | Spec |
|---|---|
| Entrance reveal | opacity 0→1, `translateY(12px)`, 700ms, `cubic-bezier(0.16,0.84,0.44,1)`, once, triggered 64px before entry |
| Stagger | 60ms per item, capped at 5 items |
| Image hover | `scale(1.03)`, 900ms ease-out, on the image only — the frame never moves |
| Nav underline | 1px rule, `transform: scaleX()` from 0, 240ms |
| Smooth scroll | Lenis, storefront only, `duration: 1.05` |

`components/ui/Reveal.tsx` is retuned from 420ms to the above. Everything is
disabled outright under `prefers-reduced-motion` — content renders in place, and
Lenis never mounts.

No parallax. No looping animation. No animated backgrounds.

## 4. Photography

Real Shrinkless photography does not exist in the repo (`public/` is empty), and
the Instagram screenshots were not received. Per the brainstorm decision, the
build ships with **curated Unsplash placeholders**, structured so swapping in
real photography is a data change and not a code change.

`lib/brand/images.ts` exports a typed manifest, one entry per slot:

```ts
type BrandImage = { url: string; alt: string; aspect: '3:2' | '4:5' | '1:1' };
export const BRAND_IMAGES = { hero: {...}, dyeStory: {...}, ... } as const;
```

| Slot | Aspect | Art direction |
|---|---|---|
| `hero` | 3:2 | Man in a plain tee, natural light, environmental, not posed |
| `dyeStory` | 4:5 | Fabric, vat, dye, hands — process, not product |
| `madeInUsa` | 3:2 | Sewing floor, machinery, industrial interior |
| `why01`, `why02` | 4:5 | Fabric close-up; garment detail |
| `lifestyle01`–`09` | mixed 1:1 / 4:5 | Architecture, coffee, interiors, outdoors, travel, workspaces |
| `productBlack/White/Charcoal` | 4:5 | Clean garment shots |

Rules: every slot carries real alt text (never `""`); every URL is verified to
return 200 before it ships; `next.config.ts` gains `images.unsplash.com` to its
`remotePatterns` and keeps Cloudinary.

**The seam.** `lib/images.ts` exports `imageUrl(publicId, transform?)`: a
`publicId` beginning with `http` is returned untouched, anything else is passed
to `cloudinaryUrl()` exactly as today. This one branch is what lets seeded
products carry remote URLs now and real Cloudinary uploads later without
touching a component. Unit-tested both ways.

## 5. Information architecture

| Route | State |
|---|---|
| `/` | Rebuilt (§6) |
| `/shop/[[...category]]` | Rebuilt; gains `q` text filter |
| `/product/[slug]` | Rebuilt (§7); reads `?color=` |
| `/cart` | Rebuilt (§8) |
| `/our-story`, `/why-shrinkless`, `/faq` | New, static (§9) |
| `/login`, `/register`, `/account` | Retokened only |
| `/admin/*` | Retokened only; layout and behaviour unchanged |

**Header.** Wordmark left; `SHOP / OUR STORY / WHY SHRINKLESS / FAQ` centred;
`Search / Account / Cart (n)` right. Transparent over the hero, then `--color-paper`
with a 1px bottom rule once the hero's lower edge passes. Driven by an
IntersectionObserver on a sentinel element — not a scroll handler, so there is no
work on every frame. On mobile the centre nav collapses into a full-screen panel.

**Search** is a `q` parameter on `/shop`, matched against product title and
description in `listPublishedProducts`. The header control navigates to `/shop`
with the filter bar's search field focused — no modal, no overlay, no
client-side index. It is a real feature or it is not in the header; a decorative
magnifying glass is not acceptable.

**Catalogue shape.** One product (`organic-tee`), three colourways, five sizes.
THE COLLECTION renders **one tile per colourway**, each linking to
`/product/organic-tee?color=black`. This is the only correct reading of the
brief's three-entry example against a variant model that already exists.

## 6. Homepage

Eleven bands. No band repeats the shape of the one before it.

1. **Header** — as §5.
2. **Hero** — `100svh` full-bleed photograph, `--color-scrim` wash. Bottom-left:
   `SHRINKLESS` eyebrow, `ORGANIC TEES / THAT DON'T SHRINK.` at
   `--text-display`, `Garment dyed organic tees. Made in USA.` beneath.
   `SHOP TEES` solid white button; `WHY SHRINKLESS` underlined text link.
3. **Statement** — `--color-paper`. `THE TEE / THAT STAYS / THE SAME.` hard-broken
   across three lines, left-aligned, `--text-display`. Supporting line held in a
   narrow column offset into the right third. This offset establishes the
   asymmetry the rest of the page inherits.
4. **THE COLLECTION** — three 4:5 colourway tiles. Meta beneath as one
   hairline-separated row: name, colour, price. `QUICK ADD` appears on hover as
   an underlined word; on touch devices it is permanently visible, because a
   hover-only affordance is unreachable on a phone. **Quick add expands a size
   row inside the tile** (`S M L XL XXL`, sold-out sizes struck through);
   choosing a size adds that variant and the row collapses. It never adds a
   guessed size, and it never opens a modal.
5. **WHY SHRINKLESS** — `01`–`04`. Two full-height photographs interleaved with
   the four numbered blocks across a 12-column asymmetric grid, so the eye moves
   diagonally. Explicitly **not** four equal cards, and no icons.
6. **THE PROMISE** — full-bleed `--color-ink`, white type, `YOUR TEE / SHOULD FIT /
   THE SAME WAY / TOMORROW.`, one white `SHOP SHRINKLESS` button. Nothing else in
   the band.
7. **MADE DIFFERENTLY** — 60/40 split, image bleeding off the left page edge,
   text held to ~46ch.
8. **MADE IN USA** — full-bleed photograph, type overlaid, flag glyph at 12px
   beside the eyebrow, once.
9. **WORN EVERYWHERE** — nine tiles on a deliberately uneven grid (mixed 1:1 and
   4:5, two tiles spanning double width). `FOLLOW @SHRINKLESS` bottom-right,
   linking to instagram.com/shrinkless.
10. **Social proof** — three quotes on hairlines. Cormorant quotation marks set
    large and low-contrast behind the text. No cards, avatars or stars.
11. **Newsletter + footer** — one `--color-ink` band. `GET THE GOOD STUFF.`,
    email field + `JOIN`, nav columns, `INSTAGRAM`.

**Mobile** follows the briefed priority order — hero, product, promise, why,
made in USA, lifestyle, reviews, newsletter — as a genuine reflow: the
collection becomes a horizontal snap-scroll rail, the Why grid becomes
photo-then-text pairs, and the lifestyle grid becomes a 2-column mosaic that
keeps its unevenness.

## 7. Product detail

Gallery left, sticky through the info column's scroll; info right.

Title, price, then the three-line spec: `Garment Dyed Organic Cotton /
Made in USA / Doesn't Shrink`. Colour as small hairline-bordered swatches with
text labels beside them. Size as a row of bordered boxes. `ADD TO CART` solid
black, full-width. `BUY NOW` bordered secondary.

**`BUY NOW` adds to cart and navigates to `/cart`** until Phase 5 lands
`/checkout`. It is not a dead button and it is not hidden.

Sold-out variants remain visible, struck through and unselectable — never
removed, so the size run always reads as complete.

Below, five accordions as native `<details>`/`<summary>`, which work without
JavaScript and are keyboard-accessible by default: `WHY IT DOESN'T SHRINK`,
`FABRIC & CONSTRUCTION`, `MADE IN USA`, `CARE`, `SHIPPING & RETURNS`.

## 8. Cart

3:4 thumbnails at a generous size. Title, colour, size stacked. Quantity as
`−  2  +` on a hairline. Line total right-aligned, tabular. Subtotal and the
checkout action in a right-hand column. No upsells, no recommendations, no
promotional inserts. Empty state is one line of type and a link to `/shop`.

The checkout button links to `/checkout`, **which does not exist until Phase
5** — that link 404s today and this redesign does not change it. It is left in
place rather than hidden, so the cart is complete the moment Phase 5 lands.

## 9. New pages

All three assemble from the same editorial components as the homepage.

- **`/our-story`** — full-bleed opener, statement, split feature, closing image.
- **`/why-shrinkless`** — the 01–04 material at full length, one band each.
- **`/faq`** — accordion list on hairlines, grouped: product, sizing, care,
  shipping, returns.

## 10. Implementation inventory

**New — `components/editorial/`:** `Hero`, `StatementBlock`, `SplitFeature`,
`FullBleedType`, `EditorialGrid`, `NumberedPoints`, `QuoteRow`, `Newsletter`.

**New — `components/site/`:** `Header` (client, IntersectionObserver),
`Footer`, `MobileNav`.

**Rewritten:** `components/shop/ProductCard` → `CollectionTile`,
`VariantPicker` (reads `?color=`), `CartLines`, `FilterBar` (gains `q`).

**Rewritten from zero:** `app/storefront.css`. **Retokened mechanically:**
`app/admin.css`. **Replaced:** `app/globals.css` `@theme` block.

**Data:** `scripts/seed-shrinkless.ts` replaces `seed-products.ts` — one
product, three colours × five sizes = 15 variants. The vintage field-shirt /
shop-tee / press-overshirt data is dropped.

**Services:** one change only — `listPublishedProducts` accepts an optional `q`.

## 11. Assumptions and open items

These are recorded because they were not answered before implementation began.
Each is cheap to change now and expensive later.

1. **Price is assumed `$48` (4800 cents).** Overwrite in the seed.
2. **All factual claims in drafted copy ship as visible `[TBC]` placeholders** —
   organic certification body, fabric weight, return window, shipping times,
   care instructions. Nothing invented will be presented as fact about the
   product.
3. **Testimonials are drafted placeholders**, clearly marked. Real reviews
   replace them verbatim when available.
4. **Photography is Unsplash placeholder work.** It is not Shrinkless product
   and must be replaced before launch.
5. The three colourways are `black`, `white`, `charcoal`, sizes `s`–`xxl`.

## 12. Accessibility

Treated as part of the design, not a pass at the end.

- `--color-muted` never carries small text; `--color-muted-text` exists for it.
- Every interactive element keeps a visible 2px focus ring, offset 2px, and it
  is never removed — only restyled.
- Every image carries real alt text from the manifest.
- Skip link to `#main`; `aria-current="page"` on the active nav item.
- Accordions are native `<details>`; the mobile nav traps focus and closes on
  Escape.
- Hit targets ≥44px on touch.
- All motion gated behind `prefers-reduced-motion`.
- Colour is never the only carrier of meaning — the colour swatches always have
  text labels.

## 13. Verification

**Existing suite stays green.** 159 tests pass today; this is presentation-layer
work and must not touch a service beyond the `q` filter.

**New unit tests:** `imageUrl` passthrough vs Cloudinary; manifest completeness
(every slot has a non-empty URL *and* alt); colourway grouping (one product → n
tiles); `q` filter matching.

**Before shipping:** `tsc --noEmit`, `npm run lint`, `npm run test`,
`npm run build`, every Unsplash URL verified 200, and a live smoke pass against
the local database asserting each homepage band, the PDP, and the cart actually
rendered.

## 14. Phasing

Each phase is independently verifiable and leaves the site working.

1. **Tokens and type** — `globals.css` `@theme`, fonts in `layout.tsx`, admin
   retokened. Site looks monochrome but unstyled.
2. **Image seam and manifest** — `lib/images.ts`, `lib/brand/images.ts`,
   `next.config.ts`, URL verification. Tests.
3. **Seed** — `scripts/seed-shrinkless.ts`, new catalogue.
4. **Chrome** — `Header`, `Footer`, `MobileNav`, skip link, storefront shell.
5. **Editorial components** — the eight in `components/editorial/`.
6. **Homepage** — the eleven bands assembled.
7. **PDP, cart, shop grid** — including `?color=`, `q`, and the accordions.
8. **New pages** — `/our-story`, `/why-shrinkless`, `/faq`.
9. **Motion and responsive pass** — Reveal retune, breakpoint sweep,
   reduced-motion audit, accessibility check.

Branch `phase-6-redesign`, off `main`. Production keeps serving the current
site throughout.
