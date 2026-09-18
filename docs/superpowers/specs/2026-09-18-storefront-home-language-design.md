# Storefront in the homepage's language — design

**Date:** 2026-09-18
**Status:** Approved, ready for planning

## Problem

The homepage is, in practice, a second design system. It has its own chrome
(`HomeHeader` / `HomeFooter`), its own stylesheets (`components/home/home.css`,
`components/home/home-sections.css` — 73KB of `hm-` prefixed rules with their
own tokens), its own faces (Bebas Neue for every heading, Space Grotesk for
running copy, Geist Mono for small print) and its own scroll choreography
(`HomeScene` plus `data-hm-*` attributes over GSAP ScrollTrigger).

Six pages a shopper reaches from that homepage are still built in the older
storefront language — standard `Header` / `Footer`, `band` / `wrap` / `display`
/ `eyebrow` / `lede` from `app/storefront.css`, no Bebas, no reveal on scroll:

- `/our-story` (About Us)
- `/why-shrinkless`
- `/shop` (All Products)
- `/shop/men`
- `/shop/women`
- `/wholesale`

Crossing from `/` to any of them reads as leaving the site. `/why-shrinkless`
is the sharpest case: its four points are a four-across tile grid, which is the
least homepage-like composition on the store.

## Goals

1. The six pages are composed, typeset and animated in the homepage's language.
2. The whole storefront shares one masthead and one footer.
3. Everything new is editable from the Content and Media tabs — no new
   storefront words or photographs hardcoded in page files.
4. A dismissible announcement bar runs across the whole storefront, homepage
   included, in charcoal with white type.
5. No regression: the existing suite stays green, `tsc` and `eslint` stay
   clean, and the production build succeeds.

## Non-goals

- Renaming `components/home/` or the `hm-` prefix. Considered and rejected: a
  large mechanical diff across every home component, stylesheet and test that
  buys nothing visible.
- Changing any filtering, cart, checkout, enquiry or auth behaviour. The
  catalogue pages are restyled; their URL contract and logic are untouched.
- Redesigning `/faq`, `/cart`, `/checkout`, `/product/[slug]` or
  `/wholesale/[slug]` bodies. They inherit the new chrome and the announcement
  bar, and nothing else.

## Architecture

### Shared core

`components/home/home.css` and `home-sections.css` currently mix two things:
tokens and primitives (`--hm-ink`, `--hm-bebas`, `--hm-gutter`, `.hm-wrap`,
`.hm-eyebrow`, `.hm-mask`, `.hm-pill`, focus rings) with homepage-specific
sections (`.hm-hero`, `.hm-shelf`, `.hm-look`).

The first group moves to a new **`components/home/hm-core.css`**. Every new
page stylesheet depends on that file rather than on 73KB about the homepage.
`HomeScene` imports it, so any section built on `HomeScene` gets it. The token
block currently repeated at the head of `home-sections.css` is deleted in
favour of it.

`hm-core.css` also gains **`.hm-dark`**, which redefines the ink/chalk/line
tokens for a dark ground so the primitives invert without being duplicated.
Wholesale is its first consumer.

### Chrome

`components/home/HomeSwitch.tsx` is **retired**. `app/(shop)/layout.tsx`
renders `HomeHeader` and `HomeFooter` directly for every route in the group.

`HomeHeader` gains an **`over?: boolean`** prop. Today the transparent,
white-on-photograph state (`hm-head--over`) is driven purely by `!scrolled`,
which is correct only because `/` opens on a full-bleed dark campaign.
Site-wide, that would put white type on a white page. With the prop,
`hm-head--over` is applied only when `over && !scrolled && !panel`.

`over` is passed by the routes that open on full-bleed media: `/`,
`/our-story`, `/why-shrinkless`. The catalogue pages and everything else get
the paper bar from the first paint.

The layout cannot know its route, so `over` is resolved client-side from the
pathname — see *Route metadata* below. (The announcement bar needs no such
lookup: it now renders on every route.)

### Route metadata

A single module, **`lib/shop/chrome.ts`**, exports the per-route chrome facts:

    export type ChromeOptions = { over: boolean };
    export function chromeFor(pathname: string): ChromeOptions;

`over` is true for `/`, `/our-story` and `/why-shrinkless`. A thin client
component reads `usePathname()` and applies the result, replacing `HomeSwitch`'s
job with one that is a lookup rather than an equality test. Keeping it in one
module means a new full-bleed page is one entry, not a hunt through the layout.

### Section vocabulary

Five reusable scenes in a new **`components/pages/`** directory. Each is a
`HomeScene`, so it animates by attribute and only the wrapper ships as
JavaScript.

| Component | What it is |
|---|---|
| `PageOpener` | Full-bleed media (photograph or film) with a Bebas title rising through an `hm-mask`. Pairs with `over` chrome. |
| `ChapterBand` | Alternating image/type band. `data-hm-reveal` on the frame, `data-hm-zoom` inside it. `HomeStory`'s shape, generalised to N chapters and either orientation. |
| `SpecStrip` | A care-label row of mono facts, hairline-ruled. No images. Carries the homepage's small-print voice onto pages that would otherwise lack it. |
| `StatementBand` | Full-bleed photograph with one Bebas line over it. `HomePromise`'s shape. |
| `CatalogueHead` | The shared opener for the four grid pages. |

Each gets a stylesheet beside it importing `hm-core.css`.

**Motion budget.** These use only the attribute set `HomeScene` already
implements — `data-hm-rise`, `-fade`, `-reveal`, `-zoom`, `-parallax`,
`-delay`. No new scrubbed ScrollTriggers. The homepage's scrubbed
`data-hm-widen` tween is deliberately not reused: last session's performance
work removed animation bottlenecks, and a scrubbed trigger per section is
exactly what was taken out.

## The pages

### Our Story (`/our-story`)

Today the page is two elements: a full-bleed film and a title with one
paragraph. It becomes a narrative.

1. **`PageOpener`** — the existing film stays the hero, `autoPlay loop muted
   playsInline` as now. Bebas title rising over it, body copy scroll-revealed.
   `over` chrome.
2. **Three `ChapterBand`s** — the problem with cotton, the cloth, the making.
   Alternating sides.
3. **`SpecStrip`** — Made in USA · Organic cotton · Garment dyed · Holds its fit.
4. **`StatementBand`** — full-bleed photograph, one line over it.
5. **`hm-pill`** to `/shop`.

Existing `story.title` and `story.body` keys are kept and used by the opener.

### Why Shrinkless (`/why-shrinkless`)

1. **`PageOpener`** over the registered `fabric` photograph. `over` chrome.
2. **Four `ChapterBand`s** replacing `OverlayTiles`, each full height, sides
   alternating, the numeral set as an `hm-eyebrow` mono label.
   **All four `why.1–4.{index,title,body}` keys carry over unchanged**, as does
   `why.cta`. Photography reuses the registered `fabric`, `folded`, `hanging`
   and `craft` slots.
3. **A proof band** — the wash-test claim as one large figure in Bebas with a
   mono caption. New keys.
4. **`hm-pill`** to `/shop`, still reading `why.cta`.

`/why-shrinkless` is `OverlayTiles`' only consumer. Once the four points are
`ChapterBand`s, `components/editorial/OverlayTiles.tsx` and its `.tiles` rules
are dead and are deleted, along with the `.pagehead` and `.shopcta` rules this
page was the last user of. Confirm with a repo-wide search before removing.

### Shop All, Men, Women (`/shop/[[...category]]`)

One `CatalogueHead`, three behaviours, from the one route file.

- **Men / Women** — the category photograph as a short band (not a full hero),
  Bebas title over it, style count in mono `tnum`. Titles still come from
  `shop.men.title` / `shop.women.title`.
- **All Products** — type only: eyebrow, Bebas title, lede. It has no art of its
  own, and a stand-in photograph would be a lie about the page. The hardcoded
  `FALLBACK` object in the route file moves into the content registry.
- Below the grid, a gateway cell to the other category, reusing `HomeGateway`'s
  composition, so Men and Women cross-link the way the homepage's doors do.

### Wholesale (`/wholesale`)

1. **`TradeHead`** under `.hm-dark` — Bebas title (still `wholesale.title`),
   a lede, and a `SpecStrip` of terms: MOQ 150 · 10 styles · Made to order ·
   4–6 weeks. These are the facts a trade buyer scans for and the page
   currently makes them hunt for. New keys.
2. Grid and `ShopBrowser` restyled dark. `WholesaleGrid` and the enquiry flow
   are behaviourally untouched.
3. **`StatementBand`** closing the page with a pill to the enquiry.

### ShopBrowser and FilterPanel

Shared by all four grid pages, so one job rather than four. Filters become
`hm-pill` controls, sort a mono select, counts `tnum`.

**Behaviour, props and the URL contract do not change**, so the existing filter
tests stay green without edits. This is the boundary: if a change here would
require touching a filter test, it is out of scope.

## Announcement bar

### Behaviour

- Renders on **every storefront route including `/`**. Today `/` is excluded
  via `HomeSwitch`; that exclusion goes.
- Scoped to the `app/(shop)` group. `app/(account)` and `app/(admin)` have
  their own layouts and are unaffected.
- **Charcoal ground, white type** — `--hm-coal` (`#151515`) and `--hm-white`
  from `hm-core.css`, not the older `--color-ink`.
- The seamless marquee is kept exactly as built: the track holds the message
  twice and travels half its own width. The duplicate is not optional and the
  `prefers-reduced-motion` rule that stops it stays.
- A **close button at the far right**, an X, dismisses the bar.

### The five technical hazards

The bar is where this work is most likely to produce a visible defect. Each of
these is a requirement, not a note.

**1. No hydration mismatch, no flash.** Dismissal state must be known at first
paint. Reading `localStorage` during render is a hydration mismatch; reading it
in `useEffect` shows the bar and then removes it, which is a flash and a layout
shift on every page load. **The state is a cookie**, read on the server in the
layout and passed to the bar as a prop. `lib/cart-session.ts` already
establishes the `cookies()` pattern to follow.

The cookie is named `sl_announce`, `SameSite=Lax`, `Path=/`, not
`HttpOnly` (the dismissal is set from the client), and expires in 180 days.
It carries no personal data.

**2. A new announcement must reappear after an old one was dismissed.** If the
cookie is a bare boolean, an admin publishes a new announcement and every
shopper who ever dismissed the old one never sees it — a silent content bug.
**The cookie stores a short stable hash of the message text.** The bar is
hidden only when the stored hash equals the current message's hash. Changing
the announcement brings it back for everybody.

**3. The marquee must not run under the close button.** The track is wider than
the viewport and slides continuously; a button sitting on top of it will have
type passing beneath it. The scrolling region is inset by the button's width
plus gutter (`padding-inline-end`), so the two never overlap. Verify at narrow
widths, where the inset is proportionally largest.

**4. The live region must not contain the button.** `role="status"` currently
sits on the bar root. With a control inside it, the button is announced as part
of the live region and re-announced when the region updates. The structure
becomes: bar root (no role) → message region (`role="status"`, the single
readable copy, the duplicate `aria-hidden`) → button, a sibling, with an
accessible name of "Close announcement".

**5. The homepage fold arithmetic.** This is the subtle one.
`components/home/home-sections.css` sets, at `≥62rem`:

    .hm-hero { margin-top: -5.25rem; min-height: calc(100svh + 5.25rem); }

`5.25rem` is the masthead's height, hardcoded twice. It pulls the hero up under
the transparent bar so the campaign runs to the top of the screen *and still
ends exactly at the fold*. `/` has no announcement bar today, which is the only
reason the arithmetic works.

Adding a bar above the masthead pushes the fold down by the bar's height, so
the hero would overshoot it — and dismissing the bar would shift the whole page
by that height. The fix: the bar publishes its height as a custom property on a
shared ancestor, defaulting to `0` when the bar is absent or dismissed, and the
hero's `min-height` subtracts it. The two hardcoded `5.25rem` values become a
named token in `hm-core.css` at the same time, since they are the masthead's
height and belong with the other tokens.

The negative `margin-top` itself is unaffected: it clears the masthead only,
and the bar sits above the masthead in flow.

### Composition

`AnnounceBar` is currently a server component taking `message`. It stays
server-rendered for the message and gains a small client wrapper that owns the
dismissal, taking `defaultDismissed` from the server-read cookie. The marquee
markup does not become client-side.

## Content and media

New copy is registered in `lib/services/site-content.ts` beside the page it is
set on, following the existing `FIELDS` registry shape (`key`, `label`, `kind`,
`default`, optional `group`). New photography is registered in
`lib/services/site-media.ts` as `EDITORIAL` slots with `label`, `where`,
`default` and `ratios`.

New copy is needed for: the Our Story chapters, spec strip and statement; the
Why Shrinkless opener and proof band; the All Products head (moving the
hardcoded `FALLBACK` into the registry); and the Wholesale lede and terms.

`MEDIA_PAGES` re-expands from `home` + `why-shrinkless` to include `our-story`,
`shop` and `wholesale`. This deliberately reverses last session's narrowing —
that narrowing was correct then, because those pages had no editable images;
they do now.

**`tests/unit/services/site-content.test.ts` and `site-media.test.ts` assert
the registry contents and the page count**, and will need updating as part of
this work. They are the guard that the registries and the pages agree.

## Testing

- **Existing suite green.** 575 tests. The content and media registry tests
  change with the registries; the filter, cart, checkout and pricing tests must
  not need to change at all — if they do, the catalogue restyle has exceeded
  its boundary.
- **New unit tests** for the announcement cookie: dismissal hides the bar, a
  changed message re-shows it despite a stored dismissal, an absent cookie
  shows it.
- **Gates:** `npx tsc --noEmit`, `npx eslint`, `npm test`, `npm run build`.
- **Manual verification**, which the automated gates cannot cover: each of the
  six pages at phone, tablet and desktop widths; the masthead's `over` state
  correct per route; the marquee clear of the close button; no layout shift on
  dismiss; the homepage hero still ending at the fold with the bar both present
  and dismissed; `prefers-reduced-motion` honoured throughout.

## Risks

- **The fold arithmetic** (hazard 5) touches the homepage, which is not one of
  the six pages and is currently correct. It is the highest-risk edit here and
  wants verification at several viewport heights.
- **Site-wide chrome** reaches `/faq`, `/cart`, `/checkout`, `/product/[slug]`
  and `/wholesale/[slug]`, which are not being redesigned. They must be opened
  and checked for a masthead that behaves, even though their bodies are
  unchanged.
- **`ShopBrowser` is shared** by four pages including Wholesale, whose dark
  ground is a different context from the other three. The `.hm-dark` token flip
  is what keeps that from becoming a second copy of the component.
