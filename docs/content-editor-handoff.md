# Content tab — visual editor: state and remaining work

Commit `84db81b` on `main`. Build, lint, typecheck and all 557 tests pass. **Nothing
below has been exercised against a browser yet** — the editor has never been opened
with a live MongoDB behind it. That is the first job of the next session.

## What the tab is now

The middle of Admin › Content is an `<iframe>` pointing at the real storefront route
(`/`, `/our-story`, `/why-shrinkless`, `/faq`, `/wholesale`) with `?ckedit=1`. It is
the page, not a mock-up of it: same components, same stylesheets, same responsive
behaviour. Mobile is the frame narrowed to 390px, so the site's own breakpoints do
the work.

### The pieces

| File | What it does |
| --- | --- |
| `lib/content/style.ts` | The style vocabulary — `ContentStyle`, `cleanStyle`, `styleDeclarations`, `isSafeSelector`, breakpoints. Pure, no DB import, shared by service / storefront / browser. |
| `lib/services/site-content.ts` | Registry as before, plus `saveContentFields` (batch), `getContentLayer(pageId)` (per-page CSS + field list), `hidden` pages. Re-exports the style module. |
| `lib/db/models/content-slot.ts` | Row now also carries `style` (Mixed) and `selector`; `value` is optional. |
| `components/site/ContentLayer.tsx` | Rendered by each editable storefront page. Always: emits the saved `<style>` for that page. Under `?ckedit=1` inside a frame: resolves fields to elements, reports clicks, applies drafts. |
| `components/admin/ContentManager.tsx` | Page picker, desktop/mobile, the frame, the Text/Style inspector, Save / Cancel / Reset, and a chip index of every line on the page. |
| `app/actions/admin/content.ts` | `saveContentPageAction` (whole page, one write) alongside the existing save/reset. |

### How an element is found

There are no editor attributes in the storefront markup. `ContentLayer` matches each
field's served text against the page's elements and takes the deepest exact match,
then derives a class-and-position selector for it (`selectorFor`). That selector is
sent up with the click and persisted on Save, and the served stylesheet is built from
it. Re-saving re-derives it, so a markup change heals on the next save; until then a
stale rule simply stops matching.

### The save bargain

Everything is a draft in the browser. Style and text changes are pushed into the frame
over `postMessage` and drawn instantly; nothing reaches the database until **Save**,
which writes only the dirty fields of the current page. **Cancel** restores the last
saved state and reloads the frame. **Reset this line** returns one field to what is
live. **Restore original** still deletes the override row.

## What to check first (in a browser, with a database)

1. **Does the frame load at all?** No `X-Frame-Options` / `frame-ancestors` header is
   set anywhere in the repo, and the frame is same-origin, so it should — but confirm
   on Vercel, where a platform header could differ from local.
2. **Field resolution coverage.** Open each page and watch the chip index: chips that
   never highlight on hover are fields the page did not hand back. Expected gaps:
   FAQ answers inside a closed `<details>`, and anything only rendered in some state.
   Their text is still editable; the Style tab tells the admin why it is unavailable.
3. **Ambiguity.** Two fields with identical wording (placeholder review names, "Shop
   all" repeated) could claim each other's element. Worth a deliberate test: set two
   fields to the same string and see which one moves.
4. **Specificity.** Rules are `!important` and unlayered, which should beat
   `storefront.css`. Check a hero headline (`.hero__line`) and a button label, which
   are the most heavily styled targets.
5. **Hero carousel.** `HeroSlider` re-renders on every slide. Confirm a draft applied
   to the eyebrow/headline/lede survives an advance (React should not touch static
   text nodes, but this is worth watching for a full loop).

## Known gaps / next work

- **No test covers the browser half.** `ContentLayer`'s resolution and selector
  derivation are untested; a jsdom test over a fixture of real page markup would be
  cheap and would catch the ambiguity case above.
- **Selector staleness is silent.** A saved rule whose selector no longer matches just
  stops applying. An admin-side warning ("this line's placement was lost, re-save it")
  would need the frame to report which saved selectors still resolve.
- **Style-only rows keep a copy of the wording.** `saveContentFields` always writes
  `value`, so styling a line marks it "Changed" even if the words are untouched. If
  that matters, skip writing `value` when it equals the shipped default.
- **Page-level reset.** There is per-field "Restore original" but no "restore this
  whole page".
- **Buttons and links are click-blocked in edit mode**, so navigation inside the frame
  is impossible by design. If an admin wants to reach a state only visible after a
  click (an open FAQ answer), only `<details>` currently opens.
- **The chip index is flat.** Once a page has 30+ fields it will want the section
  grouping the old canvas had.

## Scope kept

Media, products, auth, other admin tabs and the Men/Women product pages were not
touched. The two shop landings are `hidden: true` in the registry — out of the editor's
page list, still served to `/shop/men` and `/shop/women`.
