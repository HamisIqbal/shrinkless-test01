# Site media, editable from the admin panel

**Date:** 2026-08-28
**Status:** approved, ready for implementation

## The problem

Every photograph on the storefront is a compile-time constant in
`lib/brand/images.ts`. Changing the hero, a category tile or an editorial band
means editing TypeScript and deploying. The admin panel can already manage
products, inventory, orders, categories, discounts, shipping and settings — but
not the imagery that actually makes the site look like anything.

## What this is not

- Not a page builder. The editorial layout is hand-composed; the *set* of slots
  is a property of the design, and only the photograph inside a slot changes.
- Not a second home for product photography. Product images stay in the product
  editor, which already owns them.
- Not a general media library. There is no upload-now-assign-later pool; an
  image is uploaded into the slot it is for.

## Approach: overlay, not replacement

A new `MediaSlot` collection stores **one row per slot the admin has actually
changed**. `lib/brand/images.ts` stays exactly where it is and becomes the
built-in default. A service reads the overrides in one query and merges them
over the manifest.

Two alternatives were considered and rejected:

- **Fold it into the `Settings` document.** Fewest moving parts, but the
  settings doc becomes a grab-bag, the hero carousel wants an ordered array,
  and `settings:write` means pricing and shipping semantics, not photography.
- **Seed the database from the manifest and delete the constant.** One runtime
  source of truth, but a fresh or unseeded environment renders an imageless
  site, and there is no way to put a slot back the way it shipped.

The overlay buys three properties: a fresh database renders the site exactly as
it does today; "reset to default" is just deleting a row; and
`tests/unit/images.test.ts` keeps meaning what it means.

## The slots

A slot id is a stable string. Three groups:

### `hero` — the campaign carousel

One row holding an **ordered array** of 2–6 frames. The count is variable
because the surface is a loop: `HeroSlider` cycles whatever it is given.
Reorder, replace, add and remove are all one write to this row. Default: the
four frames in `HERO_SLIDES`.

### `category:<slug>` — one tile per category

Driven by the categories in the database, not by a fixed pair, so a new
category gets a tile without a deploy. Where no row and no manifest entry
exists the men's frame stands in, exactly as `menu.server.ts` already does —
an empty tile reads as a broken page.

Consumed by the home page gateway and the desktop mega-menu.

### `editorial:<name>` — the hand-composed frames

Ten fixed slots:

| Slot | Where it appears | Default |
| --- | --- | --- |
| `fabric` | home, why-shrinkless, lookbook rail | `BRAND_IMAGES.fabric` |
| `craft` | home, our-story, why-shrinkless, footer backdrop, lookbook | `BRAND_IMAGES.craft` |
| `hanging` | home, our-story, why-shrinkless, lookbook | `BRAND_IMAGES.hanging` |
| `folded` | home, why-shrinkless | `BRAND_IMAGES.folded` |
| `heather` | home, why-shrinkless, lookbook | `BRAND_IMAGES.heather` |
| `torso` | home, our-story, lookbook | `BRAND_IMAGES.torso` |
| `promise` | home "Wash it. Dry it." band | `PRODUCT_IMAGES['mens-heavyweight-tee'][0]` |
| `lookbookHeavyweight` | lookbook rail tile 1 | `PRODUCT_IMAGES['mens-heavyweight-tee'][1]` |
| `lookbookBoxy` | lookbook rail tile 3 | `PRODUCT_IMAGES['womens-boxy-tee'][1]` |
| `lookbookOrganic` | lookbook rail tile 5 | `PRODUCT_IMAGES['womens-organic-tee'][1]` |

The last four exist because those surfaces currently reach into
`PRODUCT_IMAGES` for editorial purposes. Left alone they would be the only
storefront imagery the panel could not change, and editing a product's
photography would silently restyle the home page. Giving them their own slots
fixes both. The five lookbook tiles that already alias an editorial slot keep
aliasing it — changing `fabric` still changes the lookbook tile, which is
today's behaviour and one fewer thing to keep in step.

## Data

`lib/db/models/media-slot.ts`

```
slotId   string, unique, required   // 'hero' | 'category:men' | 'editorial:fabric'
frames   [{ url, alt, focus }]      // ordered; single-image slots use frames[0]
```

One shape for every slot: single-image slots are simply an array of one. The
alternative — a scalar column plus a separate array column for the hero — buys
nothing and makes every read branch.

`url` holds either an absolute URL or a Cloudinary public id. `lib/images.ts`
already resolves both, so this is the same convention product images use.

`aspect` is deliberately **not** stored. It is a property of the layout slot,
not of the photograph: a 2:3 frame in a 3:2 band would letterbox or crop
regardless of what the admin intended. `focus` is the control that makes a
differently-shaped photograph crop correctly, and that *is* editable.

## Resolution

`lib/services/site-media.ts`

- `getSiteMedia(): Promise<SiteMedia>` — one query for every override, merged
  over the manifest. Returns `{ hero: BrandImage[], categories:
  Record<slug, BrandImage>, editorial: Record<EditorialSlot, BrandImage> }`.
- `categoryImage(media, slug)` — the tile for a category, with the men's frame
  as the stand-in.
- `listMediaSlots()` — for the admin page: every slot with its current value,
  its default, and whether it is overridden.
- `saveMediaSlot(slotId, frame)`, `saveHeroFrames(frames)`, `resetMediaSlot(slotId)`.

Components keep taking the `BrandImage` shape they already take, so the
editorial component props do not change.

## Consumers to rewire

Seven, all server components today:

1. `app/(shop)/page.tsx` — hero, six editorial frames, `promise`
2. `app/(shop)/our-story/page.tsx`
3. `app/(shop)/why-shrinkless/page.tsx`
4. `components/site/Footer.tsx` — becomes async, reads its own backdrop
5. `components/site/LookbookRail.tsx` — becomes async
6. `components/shop/CategoryGateway.tsx` — takes the image as a prop; the page
   resolves it
7. `lib/shop/menu.server.ts` — `imageFor` reads the service

## Admin

- New permission pair `media:read` / `media:write` in `lib/auth/permissions.ts`.
- New page `/admin/media`, in the rail between Collections and Discounts.
- Three sections matching the three groups. Each slot renders a live preview,
  an upload-or-paste control, a required alt text field, an optional focus
  control, and "Reset to default" when overridden.
- Hero additionally gets reorder and add/remove, bounded at 2–6 frames.
- Uploads reuse the signed Cloudinary flow the product editor uses, into a
  second folder `shrinkless/site` so brand media and product shots do not mix.
- Saving calls `revalidatePath('/', 'layout')`, as the settings form does.

## Validation

`lib/validation/media.ts`

- `url` — required; an `https://` URL or a Cloudinary public id.
- `alt` — required, 1–200 characters. Never empty: every frame on this site is
  content, and the one decorative use (the footer backdrop) passes `alt=""` at
  the call site rather than storing an empty string.
- `focus` — optional, `"<0-100>% <0-100>%"`.
- Hero — 2 to 6 frames.
- An unknown `slotId` is refused. The set of slots is a property of the design,
  so the server decides what exists, not the form.

## Testing

- Service: merge-over-default; reset restores the manifest value; unknown slot
  refused; category fallback; hero bounds.
- Validation: empty alt refused, bad focus refused, public id accepted.
- `tests/unit/images.test.ts`: the hero assertion relaxes from exactly 4 frames
  to between 2 and 6, because the count is now the admin's to choose.

## Known limitation

`next.config.ts` runs with `images.unoptimized: true`, so a pasted URL on a new
host renders without needing a `remotePatterns` entry. It is still worth adding
one for any new host so the configuration stays honest about where media comes
from. The uploader avoids the question entirely by putting everything on
Cloudinary.
