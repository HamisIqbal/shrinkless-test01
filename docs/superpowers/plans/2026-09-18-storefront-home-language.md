# Storefront in the Homepage's Language — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `/our-story`, `/why-shrinkless`, `/shop`, `/shop/men`, `/shop/women` and `/wholesale` into the homepage's design language, give the whole storefront one masthead and footer, and run a dismissible charcoal announcement bar across every storefront page including the homepage.

**Architecture:** The homepage's `hm-` tokens and primitives are split out of its two large stylesheets into a shared `hm-core.css`. Five reusable scenes in `components/pages/` are composed from it, and the six pages are rebuilt on those scenes. `HomeSwitch` is retired in favour of a route-metadata lookup that decides only whether the masthead starts transparent.

**Tech Stack:** Next.js 16.3.1 (App Router), React 19.2.8, TypeScript, GSAP 3.15 + ScrollTrigger, Mongoose 9, Vitest 4 (node environment), Tailwind 4 (PostCSS only — this codebase writes plain CSS, not utility classes).

**Spec:** `docs/superpowers/specs/2026-09-18-storefront-home-language-design.md`

## Global Constraints

- **Read `node_modules/next/dist/docs/` before writing routing, layout or caching code.** Per `AGENTS.md`, this Next.js differs from training data. This is not optional.
- **No component or DOM tests are possible.** `vitest.config.mts` sets `environment: 'node'` and `include: ['tests/**/*.test.ts']` — `.tsx` files are not collected and there is no jsdom. Do **not** add a testing-library dependency or change the vitest environment. All TDD in this plan targets **pure `.ts` modules**; React components are verified by `tsc`, `eslint`, `npm run build` and the manual checklist in Task 13.
- **Server-only code goes in a `.server.ts` file.** `lib/shop/menu.server.ts` is the established convention. A module that imports `next/headers` must not be imported by a test.
- **Charcoal is `--hm-coal` (`#151515`); white is `--hm-white` (`#ffffff`).** Never `--color-ink` for the new bar.
- **Announcement cookie:** name `sl_announce`, `SameSite=Lax`, `Path=/`, not `HttpOnly`, `max-age` 180 days (`15552000`). Value is a hash of the message text, never a boolean.
- **Motion is opt-in.** Every animation must have a finished resting state in CSS, so `prefers-reduced-motion` and a script that never runs both show the completed layout. Use only the attributes `HomeScene` already implements: `data-hm-rise`, `-fade`, `-reveal`, `-zoom`, `-parallax`, `-delay`. **Add no new scrubbed ScrollTriggers.**
- **Do not change filtering, cart, checkout, enquiry or auth behaviour.** If a change would require editing a filter, cart, checkout or pricing test, it has exceeded scope — stop and report.
- **Commit straight to `main`.** No feature branches on this repo.
- **`AGENTS.md` is rewritten by `next dev`.** If it shows as modified, commit it with the work rather than reverting it.
- **Every storefront word and photograph is the admin's to change.** New copy goes in `lib/services/site-content.ts`; new photography goes in `lib/services/site-media.ts`. Nothing new is hardcoded in a page file.

## Deviation from the spec (read before Task 6)

The spec says `MEDIA_PAGES` re-expands to include `our-story`, `shop` and `wholesale`. **`shop` is wrong and must not be added.** The only photographs the catalogue heads use are the `category:men` and `category:women` slots, which are already placed on the Home page — `lib/services/site-media.ts` deliberately edits the doors where they are composed, and `tests/unit/services/site-media.test.ts` (`'keeps the category doors on Home'`) asserts it. Listing them a second time under a `shop` page would give one photograph two places to be edited.

`MEDIA_PAGES` therefore becomes `home`, `our-story`, `why-shrinkless`, `wholesale`. The All Products head is type-only and needs no slot.

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `components/home/hm-core.css` | The shared token layer and primitives: colours, faces, easings, `--hm-gutter`, `--hm-head-h`, `--hm-announce*`, `.hm-wrap`, `.hm-eyebrow`, `.hm-mask*`, `.hm-word*`, `.hm-pill*`, `.hm-dark`, focus rings. |
| `lib/shop/announcement.ts` | Pure: resolve the message, hash it to a tag, decide dismissal. No `next/headers`. Unit-tested. |
| `lib/shop/chrome.ts` | Pure: `chromeFor(pathname)` → whether the masthead starts transparent. Unit-tested. |
| `components/site/AnnounceDismiss.tsx` | Client: owns the dismissal, writes the cookie, renders the close button. |
| `components/site/Chrome.tsx` | Client: reads `usePathname()`, applies `chromeFor`, renders `HomeHeader`. Replaces `HomeSwitch`. |
| `components/pages/PageOpener.tsx` + `.css` | Full-bleed media opener with a Bebas title rising through a mask. |
| `components/pages/ChapterBand.tsx` + `.css` | Alternating image/type band, N chapters. |
| `components/pages/SpecStrip.tsx` + `.css` | Hairline-ruled row of mono facts. |
| `components/pages/StatementBand.tsx` + `.css` | Full-bleed photograph with one Bebas line. |
| `components/pages/CatalogueHead.tsx` + `.css` | The opener shared by the four grid pages. |
| `tests/unit/shop/announcement.test.ts` | Guards the cookie decision. |
| `tests/unit/shop/chrome.test.ts` | Guards the route lookup. |

**Modified**

| File | Change |
|---|---|
| `components/home/home-sections.css` | Token block deleted in favour of `hm-core.css`; hero fold arithmetic tokenised. |
| `components/home/home.css` | `.hm-head` height tokenised. |
| `components/home/HomeScene.tsx` | Imports `hm-core.css`. |
| `components/home/HomeHeader.tsx` | Gains `over?: boolean`. |
| `components/site/AnnounceBar.tsx` | Charcoal, close button, live region restructured, marquee inset. |
| `app/(shop)/layout.tsx` | Renders chrome directly; reads the announcement cookie. |
| `lib/services/site-content.ts` | New copy keys and sections. |
| `lib/services/site-media.ts` | New editorial slots; `MEDIA_PAGES` expanded. |
| `app/(shop)/(instagram-last)/our-story/page.tsx` | Rebuilt. |
| `app/(shop)/(instagram-last)/why-shrinkless/page.tsx` | Rebuilt. |
| `app/(shop)/(instagram-last)/shop/[[...category]]/page.tsx` | Rebuilt head. |
| `app/(shop)/(instagram-last)/wholesale/page.tsx` | Rebuilt head and foot. |
| `components/shop/ShopBrowser.tsx`, `FilterPanel.tsx` | Restyled only. |
| `tests/unit/services/site-content.test.ts`, `site-media.test.ts` | Updated for the new registries. |

**Deleted**

`components/home/HomeSwitch.tsx`, `components/editorial/OverlayTiles.tsx` (Task 9, after confirming no other consumer).

---

## Task 1: Extract the shared token core

Pure refactor. **No visual change whatsoever** — this is the gate for this task.

**Files:**
- Create: `components/home/hm-core.css`
- Modify: `components/home/home-sections.css:22-52` (the token block), `components/home/HomeScene.tsx:3`

**Interfaces:**
- Consumes: nothing.
- Produces: `components/home/hm-core.css`, imported by `HomeScene.tsx`. Every later task's stylesheet relies on these tokens being in scope wherever a `HomeScene` renders: `--hm-ink`, `--hm-coal`, `--hm-graphite`, `--hm-stone`, `--hm-smoke`, `--hm-ash`, `--hm-mist`, `--hm-chalk`, `--hm-white`, `--hm-line-dark`, `--hm-line-light`, `--hm-display`, `--hm-bebas`, `--hm-accent`, `--hm-mono`, `--hm-sans`, `--hm-ease`, `--hm-curtain`, `--hm-gutter`, `--hm-head-h`, `--hm-announce-h`, `--hm-announce`; classes `.hm-wrap`, `.hm-eyebrow`, `.hm-mask--tall`, `.hm-wordmask`, `.hm-word`, `.hm-dark`.

- [ ] **Step 1: Create `components/home/hm-core.css`**

Copy the token block from `home-sections.css:22-52` verbatim, widen its selector list, and add the two new tokens plus `.hm-dark`.

```css
/* ==========================================================================
   The shared core.

   The tokens and the primitives every section in the homepage's language is
   built from — colours, faces, easings, the gutter and the two measurements
   the masthead and the announcement bar publish about themselves.

   Split out of home-sections.css so a page that is not the homepage can
   depend on 4KB of vocabulary rather than on 30KB about the homepage's own
   bands. home-sections.css and home.css read from here and never override it.
   ========================================================================== */

:root,
.hm-scope {
  --hm-ink: #0a0a0a;
  --hm-coal: #151515;
  --hm-graphite: #2a2a29;
  --hm-stone: #5c5c58;
  --hm-smoke: #8e8e8a;
  --hm-ash: #b8b8b3;
  --hm-mist: #e4e4e1;
  --hm-chalk: #f2f2f0;
  --hm-white: #ffffff;
  --hm-line-dark: rgba(255, 255, 255, 0.16);
  --hm-line-light: rgba(10, 10, 10, 0.12);

  --hm-display: var(--font-hm-display), "Helvetica Neue", Arial, sans-serif;
  --hm-bebas: var(--font-hm-bebas), "Haettenschweiler", "Arial Narrow", sans-serif;
  --hm-accent: var(--font-hm-accent), "Helvetica Neue", Arial, sans-serif;
  --hm-mono: var(--font-hm-mono), ui-monospace, "SF Mono", Menlo, monospace;
  --hm-sans: var(--font-inter-tight), "Helvetica Neue", Helvetica, Arial, sans-serif;

  --hm-ease: cubic-bezier(0.16, 1, 0.3, 1);
  --hm-curtain: cubic-bezier(0.76, 0, 0.24, 1);
  --hm-gutter: clamp(1.25rem, 4vw, 4.5rem);

  /* The masthead's own height. It was written as a bare 5.25rem in two places
     in home-sections.css, where it drove the campaign's fold arithmetic. It is
     a measurement the bar publishes about itself, so it belongs here. */
  --hm-head-h: 5.25rem;

  /* What the announcement bar occupies when it is on the page. Declared rather
     than measured: a JavaScript measurement would land a frame late and shift
     the campaign under it. The bar's CSS sets this exact height. */
  --hm-announce-h: 2.25rem;

  /* What the bar *currently* occupies — zero unless one is actually rendered.
     Set by the `:has()` rule below, so dismissing the bar (which unmounts it)
     returns this to zero with no JavaScript coordination at all. */
  --hm-announce: 0rem;
}

/* The shell is the only place an announcement bar ever renders. */
.shell:has(.announce) { --hm-announce: var(--hm-announce-h); }

/* --------------------------------------------------------------------------
   A dark ground.

   Wholesale is set on ink. Rather than a second copy of every primitive, the
   ground swaps what "ink" and "paper" mean and the primitives follow.
   -------------------------------------------------------------------------- */

.hm-dark {
  --hm-ink: #f2f2f0;
  --hm-chalk: #151515;
  --hm-white: #0a0a0a;
  --hm-stone: #b8b8b3;
  --hm-smoke: #8e8e8a;
  --hm-line-light: rgba(255, 255, 255, 0.16);
  color: var(--hm-ink);
  background: var(--hm-chalk);
}

/* --------------------------------------------------------------------------
   Shared pieces
   -------------------------------------------------------------------------- */

.hm-wrap {
  width: 100%;
  max-width: 100rem;
  margin-inline: auto;
  padding-inline: var(--hm-gutter);
}

.hm-eyebrow {
  display: block;
  color: var(--hm-stone);
  font-family: var(--hm-mono);
  font-size: 0.6875rem;
  font-weight: 400;
  letter-spacing: 0;
  line-height: 1.4;
  text-transform: uppercase;
}

/* Big type needs room above its capitals and below its baseline inside a mask. */
.hm-mask--tall {
  padding-block: 0.1em;
  margin-block: -0.1em;
}

/* One word, one window: the word rises through it. */
.hm-wordmask {
  display: inline-block;
  overflow: hidden;
  vertical-align: top;
  padding: 0.06em 0.08em 0.12em 0;
  margin: -0.06em -0.08em -0.12em 0;
}

.hm-word { display: inline-block; }
```

- [ ] **Step 2: Delete the moved rules from `home-sections.css`**

Remove lines 22–52 (the `.hm-hero, .hm-ig, … { --hm-ink: … }` token block) and the `.hm-wrap`, `.hm-eyebrow`, `.hm-mask--tall`, `.hm-wordmask`, `.hm-word` rules that follow it. Leave `.hm-look :focus-visible, .hm-promise :focus-visible` and everything from `/* --- the pill --- */` onward exactly where it is — the pill is not moving in this task.

Replace the deleted token block with a pointer comment:

```css
/* Tokens and the shared primitives now live in hm-core.css, which HomeScene
   imports — so they are in scope wherever a section renders. */
```

- [ ] **Step 3: Import the core from `HomeScene.tsx`**

In `components/home/HomeScene.tsx`, change line 3 from:

```ts
import './home-sections.css';
```

to:

```ts
import './hm-core.css';
import './home-sections.css';
```

- [ ] **Step 4: Verify nothing broke**

```bash
npx tsc --noEmit && npx eslint && npm test && npm run build
```

Expected: all pass, 575 tests green. No test touches CSS, so a green run here proves only that nothing else broke — the real check is the next step.

- [ ] **Step 5: Verify the homepage is visually unchanged**

```bash
npm run dev
```

Open `/`. Confirm: the masthead is transparent white over the campaign at desktop width and turns to paper on scroll; every section heading is still Bebas caps; the eyebrows are still small mono; the pill still floods on hover; the gutters are unchanged. **If anything moved, a rule was dropped in Step 2 — put it back before continuing.**

- [ ] **Step 6: Commit**

```bash
git add components/home/hm-core.css components/home/home-sections.css components/home/HomeScene.tsx
git commit -m "$(cat <<'EOF'
Split the homepage's tokens out into a shared core

The tokens and primitives were declared at the head of home-sections.css,
behind a selector list naming the homepage's own bands. A page that is not
the homepage could not use the vocabulary without depending on 30KB about
the homepage, so it lives in hm-core.css now.

Carries two new measurements the sections will need: the masthead's height,
which was a bare 5.25rem written twice in the campaign's fold arithmetic,
and what an announcement bar occupies when one is on the page.

No visual change.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: The announcement's pure logic

**Files:**
- Create: `lib/shop/announcement.ts`
- Test: `tests/unit/shop/announcement.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `ANNOUNCE_COOKIE: 'sl_announce'`
  - `ANNOUNCE_MAX_AGE: number` (seconds)
  - `resolveAnnouncement(message?: string): string`
  - `announcementTag(message: string): string`
  - `isDismissed(message: string | undefined, cookieValue: string | undefined): boolean`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/shop/announcement.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  ANNOUNCE_COOKIE,
  ANNOUNCE_MAX_AGE,
  announcementTag,
  isDismissed,
  resolveAnnouncement,
} from '@/lib/shop/announcement';

describe('resolveAnnouncement', () => {
  it('uses the store’s message when there is one', () => {
    expect(resolveAnnouncement('  Free shipping over $100  ')).toBe('Free shipping over $100');
  });

  it('falls back to the placeholder when the store has set nothing', () => {
    expect(resolveAnnouncement(undefined)).toBe(resolveAnnouncement(''));
    expect(resolveAnnouncement('   ')).toBe(resolveAnnouncement(undefined));
    expect(resolveAnnouncement(undefined).length).toBeGreaterThan(0);
  });
});

describe('announcementTag', () => {
  it('is stable for the same message', () => {
    expect(announcementTag('Restocked: the heavyweight tee')).toBe(
      announcementTag('Restocked: the heavyweight tee'),
    );
  });

  it('differs when the message differs', () => {
    expect(announcementTag('One')).not.toBe(announcementTag('Two'));
  });

  it('is short enough and safe enough to be a cookie value', () => {
    const tag = announcementTag('Free shipping over $100 — this week only');
    expect(tag).toMatch(/^[a-z0-9]{1,13}$/);
  });
});

describe('isDismissed', () => {
  it('shows the bar when no cookie has been set', () => {
    expect(isDismissed('Free shipping', undefined)).toBe(false);
  });

  it('hides the bar when the cookie matches this message', () => {
    const message = 'Free shipping';
    expect(isDismissed(message, announcementTag(message))).toBe(true);
  });

  /* The whole reason the cookie is a hash rather than a boolean: an admin
     publishes something new and everyone who dismissed the old one sees it. */
  it('shows the bar again when the message has changed since it was dismissed', () => {
    expect(isDismissed('The new announcement', announcementTag('The old one'))).toBe(false);
  });

  it('dismisses the placeholder by the text it actually renders', () => {
    const shown = resolveAnnouncement(undefined);
    expect(isDismissed(undefined, announcementTag(shown))).toBe(true);
  });

  it('ignores a cookie holding something that is not a tag', () => {
    expect(isDismissed('Free shipping', 'true')).toBe(false);
  });
});

describe('the cookie itself', () => {
  it('is named and aged as the design says', () => {
    expect(ANNOUNCE_COOKIE).toBe('sl_announce');
    expect(ANNOUNCE_MAX_AGE).toBe(60 * 60 * 24 * 180);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run tests/unit/shop/announcement.test.ts
```

Expected: FAIL — `Failed to resolve import "@/lib/shop/announcement"`.

- [ ] **Step 3: Write the implementation**

Create `lib/shop/announcement.ts`. **No `next/headers` import** — this module is read by a test and by a client component, and must stay pure.

```ts
/* --------------------------------------------------------------------------
   The announcement bar's one decision: is this message already dismissed?

   Pure on purpose. The layout reads the cookie with `cookies()` and the close
   button writes it with `document.cookie`; both sides agree here about what
   the value means, and a test can ask the question without either.
   -------------------------------------------------------------------------- */

export const ANNOUNCE_COOKIE = 'sl_announce';

/** Six months. Long enough that dismissing means dismissed, short enough that
 *  a browser kept for years does not carry it forever. */
export const ANNOUNCE_MAX_AGE = 60 * 60 * 24 * 180;

const PLACEHOLDER =
  'Future announcements will appear here — restocks, new releases and Shrinkless news.';

/** What the bar actually renders: the store's message, or the stand-in. */
export function resolveAnnouncement(message?: string): string {
  return message?.trim() || PLACEHOLDER;
}

/**
 * A short, stable fingerprint of the message.
 *
 * FNV-1a, which is a few lines and needs no dependency. This is not a security
 * boundary — nothing is being authenticated — it is only a way of asking "is
 * this the same announcement I dismissed?" in a value small enough for a
 * cookie and safe enough to need no escaping.
 */
export function announcementTag(message: string): string {
  const text = resolveAnnouncement(message);
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

/**
 * Whether the bar stays down.
 *
 * Only when the stored tag is this exact message's. A bare boolean here would
 * be a content bug with no symptom: the admin publishes a restock, and every
 * shopper who ever closed the old bar never learns about it.
 */
export function isDismissed(message: string | undefined, cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  return cookieValue === announcementTag(resolveAnnouncement(message));
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
npx vitest run tests/unit/shop/announcement.test.ts
```

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/shop/announcement.ts tests/unit/shop/announcement.test.ts
git commit -m "$(cat <<'EOF'
Decide announcement dismissal from the message, not a flag

The cookie holds a fingerprint of the message it dismissed rather than a
boolean. A boolean would mean that the first time the store publishes a new
announcement, every shopper who had ever closed the old one silently never
sees it.

Kept free of next/headers so the layout, the close button and a test can all
ask the same question.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: The announcement bar itself

**Files:**
- Modify: `components/site/AnnounceBar.tsx` (whole file), `app/storefront.css:478-513`
- Create: `components/site/AnnounceDismiss.tsx`

**Interfaces:**
- Consumes: `resolveAnnouncement`, `announcementTag`, `ANNOUNCE_COOKIE`, `ANNOUNCE_MAX_AGE` from Task 2.
- Produces: `<AnnounceBar message?: string dismissed?: boolean />`. Renders nothing when `dismissed`. Task 5 passes both props from the layout.

- [ ] **Step 1: Write the client dismiss control**

Create `components/site/AnnounceDismiss.tsx`:

```tsx
'use client';

import { useState, type ReactNode } from 'react';
import { ANNOUNCE_COOKIE, ANNOUNCE_MAX_AGE, announcementTag } from '@/lib/shop/announcement';

/**
 * The bar's close button, and the only part of the bar that is client-side.
 *
 * Unmounting the whole bar from here is what keeps the page arithmetic honest:
 * `hm-core.css` gives `--hm-announce` a real height only while a `.announce`
 * is actually in the shell, so the campaign's fold follows the bar down
 * without a line of JavaScript knowing about the campaign.
 */
export function AnnounceDismiss({ message, children }: { message: string; children: ReactNode }) {
  const [shown, setShown] = useState(true);

  if (!shown) return null;

  const close = () => {
    // Written here rather than by a server action: the value is not a secret,
    // nothing else depends on it, and a round trip to put a bar away would be
    // a network request the shopper can see.
    document.cookie = [
      `${ANNOUNCE_COOKIE}=${announcementTag(message)}`,
      'path=/',
      `max-age=${ANNOUNCE_MAX_AGE}`,
      'samesite=lax',
    ].join('; ');

    setShown(false);
  };

  return (
    <div className="announce">
      {children}

      <button type="button" className="announce__close" onClick={close}>
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="announce__x">
          <path d="M3 3 13 13M13 3 3 13" stroke="currentColor" strokeWidth="1.4" fill="none" />
        </svg>
        <span className="visually-hidden">Close announcement</span>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `AnnounceBar.tsx`**

The marquee stays server-rendered; only the wrapper is client-side. Note the live region moves **off** the root and onto the message alone, so the close button is not announced as part of it.

```tsx
import { resolveAnnouncement } from '@/lib/shop/announcement';
import { AnnounceDismiss } from '@/components/site/AnnounceDismiss';

/**
 * The thin ticker above the masthead, on every storefront page.
 *
 * The track holds the message twice and slides exactly half its own width, so
 * the moment the first copy leaves the screen the second copy is sitting
 * precisely where the first one started. That is what makes the loop seamless
 * rather than snapping back — and it is why the duplicate is not optional.
 *
 * `role="status"` sits on the message, not on the bar: with a control inside
 * the live region, a screen reader announces the close button as part of the
 * announcement and again whenever the region changes. The duplicate copies are
 * `aria-hidden`, so the line is read once.
 */
export function AnnounceBar({ message, dismissed = false }: { message?: string; dismissed?: boolean }) {
  if (dismissed) return null;

  const text = resolveAnnouncement(message);

  // Enough repeats that the track is always wider than the viewport; a short
  // message on a wide monitor would otherwise leave a visible gap mid-loop.
  const copies = Array.from({ length: 4 }, (_, i) => i);

  return (
    <AnnounceDismiss message={text}>
      <div className="announce__viewport" role="status">
        <div className="announce__track">
          {[0, 1].map((half) => (
            <div className="announce__half" key={half} aria-hidden={half === 1 || undefined}>
              {copies.map((i) => (
                <span className="announce__item" key={i}>
                  {text}
                  <span className="announce__dot" aria-hidden="true">&bull;</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </AnnounceDismiss>
  );
}
```

- [ ] **Step 3: Replace the bar's CSS**

In `app/storefront.css`, replace the whole block from `.announce {` (line 478) through the closing `}` of the `prefers-reduced-motion` rule (line 513) with:

```css
/* --------------------------------------------------------------------------
   Announcement ticker

   Charcoal, white, and closeable. The track holds the message twice and
   travels exactly half its own width, so copy two lands where copy one began
   and the loop has no seam.

   The scrolling viewport is inset by the close button's width: the track is
   wider than the screen and never stops moving, so type would otherwise pass
   underneath the button. The height is declared rather than left to the type,
   because `--hm-announce-h` in hm-core.css states it as a fact and the
   campaign's fold is measured against it.
   -------------------------------------------------------------------------- */

.announce {
  position: relative;
  display: flex;
  align-items: center;
  min-height: var(--hm-announce-h, 2.25rem);
  background: var(--hm-coal, #151515);
  color: var(--hm-white, #ffffff);
  font-family: var(--hm-mono, ui-monospace, Menlo, monospace);
  font-size: var(--text-meta);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.announce__viewport {
  flex: 1;
  overflow: hidden;
  /* The button's width plus its gutter. */
  padding-inline-end: 2.5rem;
}

.announce__track {
  display: flex;
  width: max-content;
  animation: announce-roll 46s linear infinite;
}

.announce__half { display: flex; flex: none; }

.announce__item {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

.announce__dot { padding-inline: var(--space-4); opacity: 0.5; }

.announce__close {
  position: absolute;
  inset-block: 0;
  inset-inline-end: 0;
  display: grid;
  place-items: center;
  width: 2.5rem;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
  opacity: 0.65;
  transition: opacity 0.3s var(--hm-ease, ease);
}

.announce__close:is(:hover, :focus-visible) { opacity: 1; }
.announce__close:focus-visible { outline: 2px solid var(--hm-white, #fff); outline-offset: -3px; }

.announce__x { width: 0.85rem; height: 0.85rem; }

@keyframes announce-roll {
  from { transform: translate3d(0, 0, 0); }
  to { transform: translate3d(-50%, 0, 0); }
}

/* A line of type sliding forever is exactly what this media query is for. */
@media (prefers-reduced-motion: reduce) {
  .announce__track { animation: none; }
  .announce__half:nth-child(2) { display: none; }
}
```

- [ ] **Step 4: Verify it compiles**

```bash
npx tsc --noEmit && npx eslint
```

Expected: both clean. `AnnounceBar` is still called from `app/(shop)/layout.tsx` with only `message`, which is valid — `dismissed` defaults to `false`. Task 5 wires the cookie.

- [ ] **Step 5: Commit**

```bash
git add components/site/AnnounceBar.tsx components/site/AnnounceDismiss.tsx app/storefront.css
git commit -m "$(cat <<'EOF'
Make the announcement bar charcoal and closeable

An X on the far right puts it away. Three things the bar had to get right:
the scrolling viewport is inset by the button's width, because a track that
never stops moving would otherwise run type underneath it; role="status" moves
off the root onto the message, so the button is not read as part of the
announcement; and the height is declared rather than left to the type, because
the campaign's fold is measured against it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Tokenise the campaign's fold arithmetic

**Files:**
- Modify: `components/home/home-sections.css` (the `.hm-hero` rules, ~lines 200-265), `components/home/home.css:320` (`.hm-head--compact`)

**Interfaces:**
- Consumes: `--hm-head-h`, `--hm-announce` from Task 1.
- Produces: nothing new. The homepage hero now accounts for a bar above it.

**Why this is the riskiest edit in the plan:** `/` currently has no announcement bar, which is the only reason the hardcoded `5.25rem` works. Read the spec's hazard 5 before starting.

- [ ] **Step 1: Replace the hero's desktop rule**

In `components/home/home-sections.css`, replace:

```css
@media (min-width: 62rem) {
  .hm-hero {
    margin-top: -5.25rem;
    min-height: calc(100svh + 5.25rem);
  }
}
```

with:

```css
/* On a desktop window the bar is transparent over the top of the campaign, so
   the overlap comes back: the photograph runs to the top of the screen and the
   section still ends where it did.

   The negative margin clears the masthead only — an announcement bar sits
   above the masthead in flow and is not part of what has to be climbed over.
   The height is a different matter: a bar pushes everything below it down the
   screen by its own height, so the same distance comes back off the section or
   the campaign hangs past the fold by exactly the height of the bar.

   `--hm-announce` is zero unless a bar is actually rendered, so this one
   expression covers a page with a bar, a page without one, and the moment a
   shopper closes it. */
@media (min-width: 62rem) {
  .hm-hero {
    margin-top: calc(var(--hm-head-h) * -1);
    min-height: calc(100svh + var(--hm-head-h) - var(--hm-announce));
  }
}
```

**Do not change the `+ var(--hm-head-h)` term into something that looks more correct.** It reproduces today's behaviour exactly when `--hm-announce` is `0`. The only intended change is the subtraction.

- [ ] **Step 2: Replace the call's desktop padding**

```css
@media (min-width: 62rem) {
  .hm-hero__call { padding-top: 5.25rem; }
}
```

becomes:

```css
/* Centred in what you can see rather than in the section: on a desktop window
   the section starts a masthead's height above the top of the screen. */
@media (min-width: 62rem) {
  .hm-hero__call { padding-top: var(--hm-head-h); }
}
```

- [ ] **Step 3: Check for other copies of the constant**

```bash
grep -rn "5\.25rem" components/home app
```

Expected: no matches left in `home-sections.css`. If `home.css` holds one describing the masthead's height, replace it with `var(--hm-head-h)` too. Leave any `5.25rem` that is not the masthead's height alone.

- [ ] **Step 4: Verify against the real page**

```bash
npm run dev
```

At a desktop width **with the bar present** (it is, after Task 3): the campaign fills the screen, the masthead floats transparent over it, and the bottom of the campaign lands where it did before this task. Then close the bar: **the campaign must stay put and the page must not jump.** Repeat at two window heights (a laptop and a tall monitor) — the `svh` unit and the subtraction interact, and one height passing does not prove the other does.

- [ ] **Step 5: Commit**

```bash
git add components/home/home-sections.css components/home/home.css
git commit -m "$(cat <<'EOF'
Measure the campaign's fold against the bar above it

The masthead's height was a bare 5.25rem written twice in the campaign's
arithmetic, and it worked only because the homepage was the one page with no
announcement bar over it. With a bar there, everything below is pushed down by
its height and the campaign hung past the fold by exactly that much — and
closing the bar moved the whole page.

Both numbers are now the token, and the height subtracts whatever the bar is
currently occupying, which is zero when there isn't one.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: One masthead for the whole storefront

**Files:**
- Create: `lib/shop/chrome.ts`, `components/site/Chrome.tsx`
- Test: `tests/unit/shop/chrome.test.ts`
- Modify: `components/home/HomeHeader.tsx` (Props at :16, `classes` at :238-243), `app/(shop)/layout.tsx`
- Delete: `components/home/HomeSwitch.tsx`

**Interfaces:**
- Consumes: `AnnounceBar` (Task 3), `isDismissed` + `ANNOUNCE_COOKIE` (Task 2).
- Produces: `chromeFor(pathname: string): { over: boolean }`; `HomeHeader` accepts `over?: boolean`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/shop/chrome.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { chromeFor } from '@/lib/shop/chrome';

describe('chromeFor', () => {
  /* The masthead starts transparent with white type. That is only readable
     over a full-bleed photograph or film — anywhere else it is white on white. */
  it('lets the masthead start transparent on the pages that open on media', () => {
    expect(chromeFor('/').over).toBe(true);
    expect(chromeFor('/our-story').over).toBe(true);
    expect(chromeFor('/why-shrinkless').over).toBe(true);
  });

  it('keeps the masthead on paper everywhere else', () => {
    for (const path of ['/shop', '/shop/men', '/shop/women', '/wholesale', '/cart', '/checkout', '/faq']) {
      expect(chromeFor(path).over).toBe(false);
    }
  });

  it('is not fooled by a trailing slash or a query the router leaves on', () => {
    expect(chromeFor('/our-story/').over).toBe(true);
    expect(chromeFor('/shop/men/').over).toBe(false);
  });

  /* A style's own page is not the collection's page. */
  it('treats a deeper path as its own page rather than inheriting', () => {
    expect(chromeFor('/why-shrinkless/anything').over).toBe(false);
    expect(chromeFor('/product/heavyweight-tee').over).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run tests/unit/shop/chrome.test.ts
```

Expected: FAIL — `Failed to resolve import "@/lib/shop/chrome"`.

- [ ] **Step 3: Write the implementation**

Create `lib/shop/chrome.ts`:

```ts
/* --------------------------------------------------------------------------
   What the masthead should do on a given route.

   The shop layout draws one header for every page in the group and cannot know
   which page it is drawing, so the pathname decides. This replaced a component
   that asked whether the path was exactly `/`: the homepage is no longer the
   only page that opens on full-bleed media, and it is no longer the only page
   with the homepage's chrome.
   -------------------------------------------------------------------------- */

export type ChromeOptions = {
  /**
   * Whether the masthead may start transparent, in white, over the top of the
   * page. True only where the page opens on a full-bleed photograph or film:
   * anywhere else it is white type on a white page.
   */
  over: boolean;
};

/** The pages that open on media. One list, so a new one is one line here. */
const OVER_MEDIA = new Set(['/', '/our-story', '/why-shrinkless']);

export function chromeFor(pathname: string): ChromeOptions {
  // The router can hand over a trailing slash; `/our-story/` is the same page.
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  return { over: OVER_MEDIA.has(path || '/') };
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
npx vitest run tests/unit/shop/chrome.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Give `HomeHeader` the `over` prop**

In `components/home/HomeHeader.tsx`, add to the `Props` type at line 16:

```ts
  /**
   * Whether this page opens on full-bleed media, so the bar may start
   * transparent over it. False on a page set on paper, where white type on a
   * transparent bar would be white type on a white page.
   */
  over?: boolean;
```

Add `over = false` to the destructured parameters, and change the `classes` list (around line 238) from:

```ts
    !scrolled && !panel ? 'hm-head--over' : '',
```

to:

```ts
    over && !scrolled && !panel ? 'hm-head--over' : '',
```

Update the component's doc comment at line 62 so it stops claiming the transparent state is about "the campaign":

```
 * On a page that opens on full-bleed media the bar starts transparent over it,
 * every word and icon in white, and only becomes paper on the first scroll —
 * so the photograph runs to the top of the screen. Which pages those are is
 * `lib/shop/chrome.ts`'s answer, not this component's.
```

- [ ] **Step 6: Write the chrome component**

Create `components/site/Chrome.tsx`:

```tsx
'use client';

import { usePathname } from 'next/navigation';
import { chromeFor } from '@/lib/shop/chrome';
import { HomeHeader } from '@/components/home/HomeHeader';
import '@/components/home/home.css';

type Props = React.ComponentProps<typeof HomeHeader>;

/**
 * The storefront's masthead.
 *
 * The whole store shares one header now, so the only thing left for a route to
 * decide is whether the bar may start transparent over the top of the page.
 * That is a lookup in `lib/shop/chrome.ts` rather than anything this component
 * knows — which is the difference between this and the `HomeSwitch` it
 * replaced, whose whole job was asking whether the path was `/`.
 */
export function Chrome(props: Props) {
  return <HomeHeader {...props} over={chromeFor(usePathname()).over} />;
}
```

- [ ] **Step 7: Rewrite the shop layout**

In `app/(shop)/layout.tsx`: drop the `HomeSwitch`, `AnnounceBar`-on-some-pages, `Header` and `Footer` imports; add `cookies`, the announcement helpers and `Chrome`. The body becomes:

```tsx
      <a href="#main" className="skiplink">Skip to content</a>

      {/* Every storefront page carries the bar now, the homepage included.
          Whether it has already been put away is read here rather than in the
          browser: a bar that appears and then vanishes is a flash and a shift
          on every single page load, and reading storage while rendering is a
          hydration mismatch. */}
      <AnnounceBar message={settings.announcement} dismissed={dismissed} />

      <Chrome
        menu={menu}
        cart={cart}
        signedIn={Boolean(session?.user)}
        isAdmin={isAdminSession(session)}
        storeEmail={settings.storeEmail}
        products={products}
      />

      <main id="main">{children}</main>
      </div>

      <FooterReveal>
        <HomeFooter storeEmail={settings.storeEmail} />
      </FooterReveal>
```

and the data fetch gains the cookie read:

```tsx
  const [settings, cart, session, menu, products, jar] = await Promise.all([
    getStoreSettings(),
    readCartView(),
    auth(),
    buildShopMenu(),
    listPublishedProducts({ sizes: [], colors: [], sort: 'newest', q: '', minPrice: null, maxPrice: null, gender: null }),
    cookies(),
  ]);

  const dismissed = isDismissed(settings.announcement, jar.get(ANNOUNCE_COOKIE)?.value);
```

with imports:

```tsx
import { cookies } from 'next/headers';
import { ANNOUNCE_COOKIE, isDismissed } from '@/lib/shop/announcement';
import { AnnounceBar } from '@/components/site/AnnounceBar';
import { Chrome } from '@/components/site/Chrome';
```

**Before writing this, read `node_modules/next/dist/docs/` on layouts and on `cookies()`** — reading a cookie may opt the layout out of static rendering, and this version's rules for that are not the ones in training data.

- [ ] **Step 8: Delete `HomeSwitch` and confirm nothing else wants it**

```bash
grep -rn "HomeSwitch" app components lib tests
```

Expected after the layout edit: no matches. Then:

```bash
git rm components/home/HomeSwitch.tsx
```

Note `HomeSwitch.tsx` was the only importer of `home.css`; `Chrome.tsx` imports it now, which is why Step 6 includes that line. Confirm with `grep -rn "home.css" components app`.

- [ ] **Step 9: Verify**

```bash
npx tsc --noEmit && npx eslint && npm test && npm run build
```

Expected: all pass. Then `npm run dev` and walk `/`, `/our-story`, `/why-shrinkless`, `/shop`, `/shop/men`, `/wholesale`, `/cart`, `/faq`. **Every page must have the Bebas masthead and the charcoal bar.** The first three start transparent; the rest start on paper. Close the bar on one page and confirm it stays closed as you navigate.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Give the whole storefront one masthead

The homepage had its own header and footer and every other page had the older
pair, chosen by a component that asked whether the path was exactly `/`.
Crossing between them read as leaving the site.

What is left for a route to decide is whether the bar may start transparent:
true only where the page opens on full-bleed media, because everywhere else it
is white type on a white page. That is one list in lib/shop/chrome.ts.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Register the new copy and photography

**Files:**
- Modify: `lib/services/site-content.ts` (the `PAGES` array), `lib/services/site-media.ts` (`EDITORIAL`, `MEDIA_PAGES`, `slotIdsFor`)
- Test: `tests/unit/services/site-content.test.ts:114-125`, `tests/unit/services/site-media.test.ts:332-347`

**Interfaces:**
- Consumes: nothing.
- Produces — every later page task reads these exact keys:
  - Our Story: `story.ch1.title`, `story.ch1.body`, `story.ch2.title`, `story.ch2.body`, `story.ch3.title`, `story.ch3.body`, `story.spec.1`…`story.spec.4`, `story.statement`, `story.cta`
  - Why Shrinkless: `why.proof.figure`, `why.proof.caption`
  - Shop: `shop.all.eyebrow`, `shop.all.title`, `shop.all.lede`
  - Wholesale: `wholesale.lede`, `wholesale.terms.1`…`wholesale.terms.4`, `wholesale.statement`, `wholesale.cta`
  - New editorial slots: `storyOne`, `storyTwo`, `storyThree`, `storyStatement`, `tradeStatement`

**Read the "Deviation from the spec" section at the top of this plan before starting.**

- [ ] **Step 1: Update the two registry tests first**

In `tests/unit/services/site-content.test.ts`, the page list at line 118 gains `shop`? **No** — `shop` is registered `hidden: true` like `men`, `women` and `wholesale`, so `listContentPages` does not return it and this assertion does not change. Leave lines 115–125 alone. Extend the hidden-page test instead, replacing `'leaves the two shop landings out of the editor but keeps their wording'` with:

```ts
  it('leaves the shop landings out of the editor but keeps their wording', async () => {
    const pages = await listContentPages();
    const ids = pages.map((page) => page.id);

    for (const hidden of ['men', 'women', 'shop', 'wholesale']) {
      expect(ids).not.toContain(hidden);
    }

    // The storefront still renders them, so the fields must survive.
    const copy = await getSiteContent();
    expect(copy['shop.men.title']).toBe('Men');
    expect(copy['shop.women.title']).toBe('Women');
    expect(copy['shop.all.title']).toBe('All Products');
    expect(copy['wholesale.lede']).toBeTruthy();
  });
```

In `tests/unit/services/site-media.test.ts`, replace the test at line 337:

```ts
  /* Only the pages that have photography. The FAQ carries no pictures at all,
     and the catalogue pages compose the two category doors that are already
     edited on Home — listing them again would be one photograph with two
     places to change it. */
  it('offers the pages that have images, and no others', async () => {
    const pages = await listMediaPages();

    expect(pages.map((page) => page.id)).toEqual([
      'home',
      'our-story',
      'why-shrinkless',
      'wholesale',
    ]);

    for (const page of pages) {
      expect(page.label).toBeTruthy();
      expect(page.path.startsWith('/')).toBe(true);
      expect(page.slots.length).toBeGreaterThan(0);
    }
  });
```

- [ ] **Step 2: Run them and watch them fail**

```bash
npx vitest run tests/unit/services/site-media.test.ts tests/unit/services/site-content.test.ts
```

Expected: FAIL. The media page list is still `['home', 'why-shrinkless']`; `shop.all.title` and `wholesale.lede` are undefined.

- [ ] **Step 3: Add the copy**

In `lib/services/site-content.ts`, extend the `our-story` page's `sections` array with three new sections after the existing `film` one:

```ts
      {
        id: 'chapters',
        label: 'The three chapters',
        note: 'A title and a paragraph each, beside their photographs. The photographs are edited on Media.',
        tone: 'paper',
        columns: 2,
        fields: [
          {
            key: 'story.ch1.title',
            label: 'First — title',
            kind: 'heading',
            default: 'The shirt that stopped fitting',
            group: 'one',
          },
          {
            key: 'story.ch1.body',
            label: 'First — paragraph',
            kind: 'body',
            default:
              'Every wardrobe has one. It fitted the day it was bought, and three washes later the hem sat high and the shoulders had moved. Cotton shrinks because it was stretched to be knitted, and heat lets it go back. Most tees are sold before that happens.',
            group: 'one',
          },
          {
            key: 'story.ch2.title',
            label: 'Second — title',
            kind: 'heading',
            default: 'A cloth that has already moved',
            group: 'two',
          },
          {
            key: 'story.ch2.body',
            label: 'Second — paragraph',
            kind: 'body',
            default:
              'Ours is washed and dyed as a finished garment, at temperatures past anything a home machine reaches. The shrinking happens here, before it is yours. What arrives has already been through what it is about to go through.',
            group: 'two',
          },
          {
            key: 'story.ch3.title',
            label: 'Third — title',
            kind: 'heading',
            default: 'Made where we can stand in the room',
            group: 'three',
          },
          {
            key: 'story.ch3.body',
            label: 'Third — paragraph',
            kind: 'body',
            default:
              'Cut, sewn, dyed and washed in the United States, in workshops we visit. It costs more than the alternative and it is the reason the tee behaves the way it does.',
            group: 'three',
          },
        ],
      },
      {
        id: 'spec',
        label: 'The care-label strip',
        note: 'Four short facts, set like a care label. Keep them to a few words each.',
        tone: 'paper',
        columns: 2,
        fields: [
          { key: 'story.spec.1', label: 'First', kind: 'label', default: 'Made in USA' },
          { key: 'story.spec.2', label: 'Second', kind: 'label', default: 'Organic cotton' },
          { key: 'story.spec.3', label: 'Third', kind: 'label', default: 'Garment dyed' },
          { key: 'story.spec.4', label: 'Fourth', kind: 'label', default: 'Holds its fit' },
        ],
      },
      {
        id: 'close',
        label: 'The closing band',
        note: 'One line over the full-bleed photograph, and the button under it.',
        tone: 'ink',
        fields: [
          {
            key: 'story.statement',
            label: 'Statement',
            kind: 'heading',
            default: 'Buy it once. Wash it forever.',
          },
          { key: 'story.cta', label: 'Button', kind: 'button', default: 'Shop the tees' },
        ],
      },
```

Extend the `why-shrinkless` page's sections with a proof section, placed before the existing `cta` section:

```ts
      {
        id: 'proof',
        label: 'The proof',
        note: 'One figure, set large, and the line that explains it.',
        tone: 'paper',
        fields: [
          { key: 'why.proof.figure', label: 'Figure', kind: 'heading', default: 'Under 1%' },
          {
            key: 'why.proof.caption',
            label: 'Caption',
            kind: 'label',
            default: 'Shrinkage after fifty home washes, measured across the body and the sleeve.',
          },
        ],
      },
```

Add a new hidden `shop` page, placed immediately before the existing `men` page so the panel's order stays sensible:

```ts
  {
    id: 'shop',
    label: 'All Products',
    path: '/shop',
    hidden: true,
    sections: [
      {
        id: 'head',
        label: 'Page head',
        note: 'The type over the unfiltered grid. Men and Women have heads of their own.',
        tone: 'paper',
        fields: [
          { key: 'shop.all.eyebrow', label: 'Eyebrow', kind: 'eyebrow', default: 'Collection' },
          { key: 'shop.all.title', label: 'Title', kind: 'heading', default: 'All Products' },
          {
            key: 'shop.all.lede',
            label: 'Lede',
            kind: 'lede',
            default: 'Every Shrinkless style, in every colour we currently make it.',
          },
        ],
      },
    ],
  },
```

Extend the `wholesale` page's `head` section fields with the lede, and add two sections after it:

```ts
          {
            key: 'wholesale.lede',
            label: 'Lede',
            kind: 'lede',
            default: 'Ten styles, made to order, on terms we agree with you directly.',
          },
```

```ts
      {
        id: 'terms',
        label: 'The terms strip',
        note: 'The four facts a buyer looks for first. Keep them to a few words each.',
        tone: 'ink',
        columns: 2,
        fields: [
          { key: 'wholesale.terms.1', label: 'First', kind: 'label', default: 'MOQ 150 units' },
          { key: 'wholesale.terms.2', label: 'Second', kind: 'label', default: 'Ten styles' },
          { key: 'wholesale.terms.3', label: 'Third', kind: 'label', default: 'Made to order' },
          { key: 'wholesale.terms.4', label: 'Fourth', kind: 'label', default: 'Four to six weeks' },
        ],
      },
      {
        id: 'close',
        label: 'The closing band',
        note: 'One line over the full-bleed photograph, and the button under it.',
        tone: 'ink',
        fields: [
          {
            key: 'wholesale.statement',
            label: 'Statement',
            kind: 'heading',
            default: 'Tell us what you need.',
          },
          { key: 'wholesale.cta', label: 'Button', kind: 'button', default: 'Request a quote' },
        ],
      },
```

- [ ] **Step 4: Add the photography**

In `lib/services/site-media.ts`, add five entries to the `EDITORIAL` record. Defaults reuse photographs already in the repo — a stand-in the admin replaces, because an empty frame reads as a broken page, which is the reasoning the file already gives for `CATEGORY_FALLBACK`.

```ts
  storyOne: {
    label: 'Our Story (First chapter)',
    where: 'Our Story — the photograph beside “the shirt that stopped fitting”',
    default: BRAND_IMAGES.torso,
    ratios: WIDE,
  },
  storyTwo: {
    label: 'Our Story (Second chapter)',
    where: 'Our Story — the photograph beside the cloth',
    default: BRAND_IMAGES.fabric,
    ratios: WIDE,
  },
  storyThree: {
    label: 'Our Story (Third chapter)',
    where: 'Our Story — the photograph beside the making',
    default: BRAND_IMAGES.craft,
    ratios: WIDE,
  },
  storyStatement: {
    label: 'Our Story (Closing band)',
    where: 'Our Story — the full-bleed band the page closes on',
    default: BRAND_IMAGES.heather,
    ratios: BAND,
  },
  tradeStatement: {
    label: 'Wholesale (Closing band)',
    where: 'Wholesale — the full-bleed band above the enquiry',
    default: BRAND_IMAGES.hanging,
    ratios: BAND,
  },
```

Add the running orders beside the existing `WHY_ORDER` and `STORY_ORDER`:

```ts
/** Our Story, in the order the page runs them: three chapters, then the band. */
const OUR_STORY_ORDER: EditorialSlot[] = ['storyOne', 'storyTwo', 'storyThree', 'storyStatement'];
```

Extend `MEDIA_PAGES`:

```ts
const MEDIA_PAGES = [
  { id: 'home', label: 'Homepage', path: '/' },
  { id: 'our-story', label: 'Our Story', path: '/our-story' },
  { id: 'why-shrinkless', label: 'Why Shrinkless', path: '/why-shrinkless' },
  { id: 'wholesale', label: 'Wholesale', path: '/wholesale' },
] as const;
```

Extend `slotIdsFor`, and update its doc comment — it currently explains why only two pages are listed:

```ts
  if (pageId === 'our-story') return OUR_STORY_ORDER.map(editorialSlotId);

  if (pageId === 'why-shrinkless') return WHY_ORDER.map(editorialSlotId);

  if (pageId === 'wholesale') return [editorialSlotId('tradeStatement')];

  return [];
```

```
 * Home carries the carousel, the category doors, the lookbook rail, the story
 * tiles and the promise band; Our Story carries its three chapters and its
 * closing band; Why Shrinkless carries the four points; Wholesale carries the
 * band it closes on. The catalogue pages compose the two category doors, which
 * are edited on Home where they are composed rather than in a second place —
 * so they are not listed. Any other page answers with nothing, because the
 * storefront still calls this for every page it serves: the layer it feeds
 * also carries the section stylesheet.
```

- [ ] **Step 5: Run the tests and watch them pass**

```bash
npm test
```

Expected: all green. The `'places every slot on a page'` test proves the five new slots are reachable from the Media tab; if it fails, a slot is in `EDITORIAL` but missing from a `slotIdsFor` branch.

- [ ] **Step 6: Commit**

```bash
git add lib/services/site-content.ts lib/services/site-media.ts tests/unit/services
git commit -m "$(cat <<'EOF'
Register the copy and photography the rebuilt pages need

Our Story gets three chapters, a care-label strip and a closing band; Why
Shrinkless gets its proof figure; the unfiltered grid's title and lede move out
of the route file; Wholesale gets its lede, its terms and a closing band.

The Media tab grows from two pages to four. It was narrowed to two because the
others had no editable images; they do now. Not the catalogue pages, though —
the two doors they compose are edited on Home, and a second place to change one
photograph is a way for them to disagree.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: The section vocabulary

**Files:**
- Create: `components/pages/PageOpener.tsx`, `ChapterBand.tsx`, `SpecStrip.tsx`, `StatementBand.tsx`, `pages.css`

**Interfaces:**
- Consumes: `HomeScene` (`components/home/HomeScene.tsx`), `homeFonts` (`components/home/fonts.ts`), `HomePill` (`components/home/HomePill.tsx`), `cropStyle` (`lib/media/crop.ts`), `BrandImage` (`lib/brand/images.ts`), `hm-core.css` (Task 1).
- Produces, used verbatim by Tasks 8, 9 and 11:

```ts
type OpenerMedia = { kind: 'image'; image: BrandImage } | { kind: 'video'; src: string; label: string };
export function PageOpener(props: { media: OpenerMedia; title: string; body?: string; sectionClass?: string }): JSX.Element;

export type Chapter = { title: string; body: string; image: BrandImage; index?: string };
export function ChapterBand(props: { chapters: Chapter[]; label: string; sectionClass?: string }): JSX.Element;

export function SpecStrip(props: { items: string[]; label: string }): JSX.Element;

export function StatementBand(props: { image: BrandImage; statement: string; cta?: { href: string; label: string }; sectionClass?: string }): JSX.Element;
```

`sectionClass` exists so a page can keep a class the Media tab targets for section height and ground (`imageband`, `tiles`) — see how `HomePromise` keeps `imageband`.

- [ ] **Step 1: Write `PageOpener.tsx`**

```tsx
import Image from 'next/image';
import { cropStyle } from '@/lib/media/crop';
import type { BrandImage } from '@/lib/brand/images';
import { homeFonts } from '@/components/home/fonts';
import { HomeScene } from '@/components/home/HomeScene';
import './pages.css';

export type OpenerMedia =
  | { kind: 'image'; image: BrandImage }
  | { kind: 'video'; src: string; label: string };

type Props = {
  media: OpenerMedia;
  title: string;
  body?: string;
  /** A class the Media tab targets for this section's height and ground. */
  sectionClass?: string;
};

/**
 * How a page that is not the homepage opens: full-bleed media, and the title
 * rising through a mask over it.
 *
 * Pairs with the transparent masthead — a page using this must be listed in
 * `lib/shop/chrome.ts`, or the bar will sit on paper above a photograph.
 */
export function PageOpener({ media, title, body, sectionClass = '' }: Props) {
  return (
    <HomeScene className={`${sectionClass} pg-open ${homeFonts}`} aria-label={title}>
      <div className="pg-open__stage" data-hm-parallax="6">
        {media.kind === 'video' ? (
          <video
            className="pg-open__video"
            src={media.src}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-label={media.label}
          />
        ) : (
          <Image
            src={media.image.url}
            alt={media.image.alt}
            fill
            priority
            sizes="100vw"
            className="pg-open__image"
            style={cropStyle(media.image)}
          />
        )}
      </div>

      <div className="pg-open__scrim" aria-hidden="true" />

      <div className="hm-wrap pg-open__inner">
        <div className="hm-mask hm-mask--tall">
          <h1 className="pg-open__title" data-hm-rise>{title}</h1>
        </div>

        {body ? <p className="pg-open__body" data-hm-fade data-hm-delay="0.15">{body}</p> : null}
      </div>
    </HomeScene>
  );
}
```

- [ ] **Step 2: Write `ChapterBand.tsx`**

```tsx
import Image from 'next/image';
import { cropStyle } from '@/lib/media/crop';
import type { BrandImage } from '@/lib/brand/images';
import { homeFonts } from '@/components/home/fonts';
import { HomeScene } from '@/components/home/HomeScene';
import './pages.css';

export type Chapter = {
  title: string;
  body: string;
  image: BrandImage;
  /** A numeral set as a mono label, where the chapters are counted points. */
  index?: string;
};

type Props = {
  chapters: Chapter[];
  /** Names the section for a screen reader. */
  label: string;
  sectionClass?: string;
};

/**
 * Chapters, each a photograph beside its own words, sides alternating down the
 * page.
 *
 * The homepage's `HomeStory` pins one frame and wipes photographs over it,
 * which needs three scrubbed ScrollTriggers per section. This is the same
 * composition without the pinning: each frame opens from its foot once, as it
 * arrives, and settles from a scale while it does. Everything here is the
 * attribute set `HomeScene` already implements, so the section costs one
 * trigger per element and nothing is measured on every scrolled frame.
 */
export function ChapterBand({ chapters, label, sectionClass = '' }: Props) {
  return (
    <HomeScene className={`${sectionClass} pg-chapters ${homeFonts}`} aria-label={label}>
      <div className="hm-wrap">
        {chapters.map((chapter, index) => (
          <article
            key={chapter.title}
            className={`pg-chapter pg-chapter--${index % 2 ? 'right' : 'left'}`}
          >
            <div className="pg-chapter__frame" data-hm-reveal>
              <Image
                src={chapter.image.url}
                alt={chapter.image.alt}
                fill
                loading="lazy"
                sizes="(min-width: 62rem) 50vw, 100vw"
                className="pg-chapter__image"
                style={cropStyle(chapter.image)}
                data-hm-zoom
              />
            </div>

            <div className="pg-chapter__type">
              {chapter.index ? (
                <p className="hm-eyebrow pg-chapter__index" data-hm-fade>{chapter.index}</p>
              ) : null}

              <div className="hm-mask hm-mask--tall">
                <h2 className="pg-chapter__title" data-hm-rise data-hm-delay="0.1">{chapter.title}</h2>
              </div>

              <p className="pg-chapter__body" data-hm-fade data-hm-delay="0.2">{chapter.body}</p>
            </div>
          </article>
        ))}
      </div>
    </HomeScene>
  );
}
```

- [ ] **Step 3: Write `SpecStrip.tsx`**

```tsx
import { homeFonts } from '@/components/home/fonts';
import { HomeScene } from '@/components/home/HomeScene';
import './pages.css';

/**
 * A row of short facts, ruled like a care label.
 *
 * The cheapest section in the vocabulary — no photographs, no measurement —
 * and the one that carries the small-print voice onto pages that would
 * otherwise only have headings and running copy.
 */
export function SpecStrip({ items, label }: { items: string[]; label: string }) {
  return (
    <HomeScene className={`pg-spec ${homeFonts}`} aria-label={label}>
      <ul className="hm-wrap pg-spec__row">
        {items.map((item, index) => (
          <li key={item} className="pg-spec__item" data-hm-fade data-hm-delay={`${index * 0.08}`}>
            {item}
          </li>
        ))}
      </ul>
    </HomeScene>
  );
}
```

- [ ] **Step 4: Write `StatementBand.tsx`**

```tsx
import Image from 'next/image';
import { cropStyle } from '@/lib/media/crop';
import type { BrandImage } from '@/lib/brand/images';
import { homeFonts } from '@/components/home/fonts';
import { HomeScene } from '@/components/home/HomeScene';
import { HomePill } from '@/components/home/HomePill';
import './pages.css';

type Props = {
  image: BrandImage;
  statement: string;
  cta?: { href: string; label: string };
  sectionClass?: string;
};

/**
 * The full-bleed line a page closes on.
 *
 * `HomePromise`'s shape with its scrubbed parallax traded for the once-only
 * reveal in `HomeScene`: the homepage can afford a scrubbed band because it
 * has one, and these pages would each add another.
 */
export function StatementBand({ image, statement, cta, sectionClass = '' }: Props) {
  return (
    <HomeScene className={`${sectionClass} pg-statement ${homeFonts}`} aria-label={statement}>
      <div className="pg-statement__media" data-hm-parallax="8">
        <Image
          src={image.url}
          alt={image.alt}
          fill
          loading="lazy"
          sizes="100vw"
          className="pg-statement__image"
          style={cropStyle(image)}
        />
      </div>

      <div className="pg-statement__scrim" aria-hidden="true" />

      <div className="hm-wrap pg-statement__inner">
        <div className="hm-mask hm-mask--tall">
          <p className="pg-statement__line" data-hm-rise>{statement}</p>
        </div>

        {cta ? (
          <div data-hm-fade data-hm-delay="0.2">
            <HomePill href={cta.href} tone="light">{cta.label}</HomePill>
          </div>
        ) : null}
      </div>
    </HomeScene>
  );
}
```

- [ ] **Step 5: Write `components/pages/pages.css`**

```css
/* ==========================================================================
   The section vocabulary the storefront's pages are composed from.

   Same language as home-sections.css and built on the same tokens, which
   hm-core.css holds — this file declares none of its own. Headings are Bebas,
   the same face as the masthead and the homepage's own bands; running copy is
   Space Grotesk and small print is the mono. Every rule describes a finished
   resting state: the motion in HomeScene moves elements *into* these, so a
   page with reduced motion or no JavaScript shows the completed layout.
   ========================================================================== */

/* --- the opener ----------------------------------------------------------- */

.pg-open {
  position: relative;
  display: grid;
  align-items: end;
  overflow: hidden;
  min-height: 78svh;
  padding-block: clamp(4rem, 12vh, 9rem);
  background: var(--hm-ink);
  color: var(--hm-white);
}

/* The masthead is transparent over this at desktop width, so the media runs to
   the top of the screen the way the campaign does. */
@media (min-width: 62rem) {
  .pg-open {
    margin-top: calc(var(--hm-head-h) * -1);
    min-height: calc(86svh + var(--hm-head-h) - var(--hm-announce));
    padding-top: calc(var(--hm-head-h) + 4rem);
  }
}

.pg-open__stage { position: absolute; inset: 0; z-index: 0; }

.pg-open__image,
.pg-open__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Enough ground for white type over an unknown photograph — the admin can
   publish anything here, so the scrim cannot depend on what is behind it. */
.pg-open__scrim {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(to top, rgba(10, 10, 10, 0.78) 0%, rgba(10, 10, 10, 0.25) 45%, rgba(10, 10, 10, 0.35) 100%);
}

.pg-open__inner { position: relative; z-index: 2; }

.pg-open__title {
  margin: 0;
  font-family: var(--hm-bebas);
  font-size: clamp(3rem, 11vw, 9rem);
  font-weight: 400;
  letter-spacing: 0;
  line-height: 0.88;
  text-transform: uppercase;
}

.pg-open__body {
  max-width: 46ch;
  margin: clamp(1rem, 2.5vw, 1.75rem) 0 0;
  color: rgba(255, 255, 255, 0.82);
  font-family: var(--hm-accent);
  font-size: clamp(0.95rem, 1.2vw, 1.1rem);
  line-height: 1.6;
}

/* --- the chapters --------------------------------------------------------- */

.pg-chapters {
  padding-block: clamp(4rem, 12vh, 9rem);
  background: var(--hm-chalk);
  color: var(--hm-ink);
}

.pg-chapter {
  display: grid;
  gap: clamp(1.5rem, 4vw, 3.5rem);
  align-items: center;
}

.pg-chapter + .pg-chapter { margin-top: clamp(4rem, 10vh, 8rem); }

@media (min-width: 62rem) {
  .pg-chapter { grid-template-columns: 1fr 1fr; }
  .pg-chapter--right .pg-chapter__frame { order: 2; }
}

.pg-chapter__frame {
  position: relative;
  overflow: hidden;
  aspect-ratio: 3 / 2;
}

@media (max-width: 61.9375rem) {
  .pg-chapter__frame { aspect-ratio: 4 / 5; }
}

.pg-chapter__image { object-fit: cover; }

.pg-chapter__index { margin: 0 0 clamp(0.75rem, 1.5vw, 1.25rem); }

.pg-chapter__title {
  margin: 0;
  font-family: var(--hm-bebas);
  font-size: clamp(2.25rem, 5vw, 4.25rem);
  font-weight: 400;
  letter-spacing: 0;
  line-height: 0.92;
  text-transform: uppercase;
}

.pg-chapter__body {
  max-width: 44ch;
  margin: clamp(0.9rem, 2vw, 1.5rem) 0 0;
  color: var(--hm-stone);
  font-family: var(--hm-accent);
  font-size: clamp(0.95rem, 1.1vw, 1.05rem);
  line-height: 1.65;
}

/* --- the care-label strip ------------------------------------------------- */

.pg-spec {
  padding-block: clamp(2rem, 5vh, 3.5rem);
  border-block: 1px solid var(--hm-line-light);
  background: var(--hm-chalk);
  color: var(--hm-ink);
}

.pg-spec__row {
  display: grid;
  gap: 1px;
  grid-template-columns: repeat(2, 1fr);
  margin: 0;
  padding-inline: var(--hm-gutter);
  list-style: none;
}

@media (min-width: 48rem) {
  .pg-spec__row { grid-template-columns: repeat(4, 1fr); }
}

.pg-spec__item {
  padding-block: clamp(0.75rem, 2vw, 1.25rem);
  color: var(--hm-stone);
  font-family: var(--hm-mono);
  font-size: 0.6875rem;
  letter-spacing: 0;
  line-height: 1.4;
  text-transform: uppercase;
}

.pg-spec__item + .pg-spec__item { border-inline-start: 1px solid var(--hm-line-light); padding-inline-start: 1rem; }

/* --- the closing band ----------------------------------------------------- */

.pg-statement {
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  min-height: clamp(26rem, 70svh, 42rem);
  padding-block: clamp(4rem, 10vh, 8rem);
  background: var(--hm-ink);
  color: var(--hm-white);
  text-align: center;
}

.pg-statement__media { position: absolute; inset: -6% 0; z-index: 0; }
.pg-statement__image { object-fit: cover; }

.pg-statement__scrim {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: rgba(10, 10, 10, 0.5);
}

.pg-statement__inner {
  position: relative;
  z-index: 2;
  display: grid;
  justify-items: center;
  gap: clamp(1.5rem, 4vw, 2.5rem);
}

.pg-statement__line {
  max-width: 18ch;
  margin: 0;
  font-family: var(--hm-bebas);
  font-size: clamp(2.5rem, 8vw, 6.5rem);
  font-weight: 400;
  letter-spacing: 0;
  line-height: 0.9;
  text-transform: uppercase;
}

/* The pill sits on a photograph here, so its focus ring must not be ink. */
.pg-open :focus-visible,
.pg-statement :focus-visible {
  outline: 2px solid var(--hm-white);
  outline-offset: 3px;
}
```

- [ ] **Step 6: Verify it compiles**

```bash
npx tsc --noEmit && npx eslint && npm run build
```

Expected: all clean. Nothing renders these yet, so there is nothing to look at — the next three tasks are where they appear.

- [ ] **Step 7: Commit**

```bash
git add components/pages
git commit -m "$(cat <<'EOF'
Add the section vocabulary the storefront's pages compose from

Four scenes — an opener, chapters, a care-label strip and a closing band —
built on the same tokens and the same faces as the homepage's own bands.

They deliberately spend less than the homepage does: HomeStory pins a frame and
wipes photographs over it across three scrubbed triggers, and a store with six
pages doing that is a store that scrolls badly. These use only the once-only
attributes HomeScene already implements.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Rebuild Our Story

**Files:**
- Modify: `app/(shop)/(instagram-last)/our-story/page.tsx` (whole file)

**Interfaces:**
- Consumes: `PageOpener`, `ChapterBand`, `SpecStrip`, `StatementBand` (Task 7); the copy keys and editorial slots from Task 6; `chromeFor` already lists `/our-story` (Task 5).
- Produces: nothing.

- [ ] **Step 1: Rewrite the page**

```tsx
import { getContentLayer, getSiteContent, type SiteContent } from '@/lib/services/site-content';
import { ContentLayer } from '@/components/site/ContentLayer';
import { getMediaLayer, getSiteMedia, type SiteMedia } from '@/lib/services/site-media';
import { MediaLayer } from '@/components/site/MediaLayer';
import { PageOpener } from '@/components/pages/PageOpener';
import { ChapterBand, type Chapter } from '@/components/pages/ChapterBand';
import { SpecStrip } from '@/components/pages/SpecStrip';
import { StatementBand } from '@/components/pages/StatementBand';

export const metadata = {
  title: 'Our Story',
  description: 'Why Shrinkless makes one tee, and makes it in the United States.',
};

const VIDEO_SRC =
  'https://res.cloudinary.com/dcsewsmhd/video/upload/v1788450220/There_s_a_lot_of_work_that_goes_into_making_our_t-shirts_special._Cutting_sewing_dyeing_washi_u85ovb.mp4';

/* The words and the photographs are both the admin's to change, so both are
   data here rather than anything this file holds. */
const chapters = ({ editorial }: SiteMedia, copy: SiteContent): Chapter[] => [
  { title: copy['story.ch1.title'], body: copy['story.ch1.body'], image: editorial.storyOne },
  { title: copy['story.ch2.title'], body: copy['story.ch2.body'], image: editorial.storyTwo },
  { title: copy['story.ch3.title'], body: copy['story.ch3.body'], image: editorial.storyThree },
];

const specs = (copy: SiteContent): string[] => [
  copy['story.spec.1'],
  copy['story.spec.2'],
  copy['story.spec.3'],
  copy['story.spec.4'],
];

/**
 * The page the brand is explained on.
 *
 * The film is still what it opens on — it is the most particular thing the
 * store owns — but it is no longer the whole page. Three chapters run under it,
 * then the care label, then the line the page closes on.
 *
 * No <InstagramStrip /> here — app/(shop)/(instagram-last)/layout.tsx renders
 * it after every page's content.
 */
export default async function OurStoryPage() {
  const [media, copy, layer, mediaLayer] = await Promise.all([
    getSiteMedia(),
    getSiteContent(),
    getContentLayer('our-story'),
    getMediaLayer('our-story'),
  ]);

  return (
    <>
      {/* Keeps the `storyfilm` class so the Media tab's settings still land. */}
      <PageOpener
        sectionClass="storyfilm"
        media={{
          kind: 'video',
          src: VIDEO_SRC,
          label: 'Cutting, sewing, dyeing and washing a Shrinkless tee',
        }}
        title={copy['story.title']}
        body={copy['story.body']}
      />

      <ChapterBand chapters={chapters(media, copy)} label="How the tee is made" sectionClass="tiles" />

      <SpecStrip items={specs(copy)} label="What it is" />

      <StatementBand
        sectionClass="imageband"
        image={media.editorial.storyStatement}
        statement={copy['story.statement']}
        cta={{ href: '/shop', label: copy['story.cta'] }}
      />

      <ContentLayer {...layer} />

      <MediaLayer {...mediaLayer} />
    </>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit && npx eslint && npm test && npm run build
```

Expected: all pass. A `tsc` error naming `storyOne`, `storyTwo`, `storyThree` or `storyStatement` means Task 6's `EDITORIAL` entries were not added.

- [ ] **Step 3: Look at the page**

`npm run dev`, open `/our-story` at desktop, tablet and phone widths. Confirm: the masthead is transparent over the film and turns to paper on scroll; the title is Bebas caps; the three chapters alternate sides at desktop and stack on a phone; each photograph opens from its foot once as it arrives; the care-label strip is four mono facts; the closing band carries the pill. Then set the OS to reduce motion and reload — **everything must be present and in its finished position, nothing invisible.**

- [ ] **Step 4: Commit**

```bash
git add "app/(shop)/(instagram-last)/our-story/page.tsx"
git commit -m "$(cat <<'EOF'
Make Our Story a story

It was a film and one paragraph — the page that explains the brand had less on
it than a product page. The film still opens it, with three chapters under it,
the care label, and the line the page closes on.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Rebuild Why Shrinkless

**Files:**
- Modify: `app/(shop)/(instagram-last)/why-shrinkless/page.tsx` (whole file)
- Create: the proof band's rules, appended to `components/pages/pages.css`
- Delete: `components/editorial/OverlayTiles.tsx` (only after Step 4 confirms)

**Interfaces:**
- Consumes: Task 7's scenes; `why.1–4.*`, `why.title`, `why.lede`, `why.cta` (unchanged), `why.proof.figure`, `why.proof.caption` (Task 6).
- Produces: nothing.

- [ ] **Step 1: Add the proof band's rules to `components/pages/pages.css`**

```css
/* --- the proof ------------------------------------------------------------ */

.pg-proof {
  padding-block: clamp(4rem, 12vh, 9rem);
  background: var(--hm-ink);
  color: var(--hm-white);
  text-align: center;
}

.pg-proof__figure {
  margin: 0;
  font-family: var(--hm-bebas);
  font-size: clamp(4.5rem, 20vw, 16rem);
  font-weight: 400;
  letter-spacing: 0;
  line-height: 0.82;
  text-transform: uppercase;
}

.pg-proof__caption {
  max-width: 38ch;
  margin: clamp(1.25rem, 3vw, 2rem) auto 0;
  color: var(--hm-ash);
  font-family: var(--hm-mono);
  font-size: 0.6875rem;
  line-height: 1.6;
  text-transform: uppercase;
}
```

- [ ] **Step 2: Rewrite the page**

```tsx
import { getMediaLayer, getSiteMedia, type SiteMedia } from '@/lib/services/site-media';
import { getContentLayer, getSiteContent, type SiteContent } from '@/lib/services/site-content';
import { ContentLayer } from '@/components/site/ContentLayer';
import { MediaLayer } from '@/components/site/MediaLayer';
import { homeFonts } from '@/components/home/fonts';
import { HomeScene } from '@/components/home/HomeScene';
import { PageOpener } from '@/components/pages/PageOpener';
import { ChapterBand, type Chapter } from '@/components/pages/ChapterBand';
import { StatementBand } from '@/components/pages/StatementBand';

export const metadata = {
  title: 'Why Shrinkless',
  description: 'Organic cotton, garment dyed, built to hold its fit. Made in USA.',
};

/* The photographs and the words are both the admin's to change, so they are
   data rather than constants. The keys are the ones the four points have
   always used — only the composition around them changed. */
const points = ({ editorial }: SiteMedia, copy: SiteContent): Chapter[] => [
  { index: copy['why.1.index'], title: copy['why.1.title'], body: copy['why.1.body'], image: editorial.fabric },
  { index: copy['why.2.index'], title: copy['why.2.title'], body: copy['why.2.body'], image: editorial.folded },
  { index: copy['why.3.index'], title: copy['why.3.title'], body: copy['why.3.body'], image: editorial.hanging },
  { index: copy['why.4.index'], title: copy['why.4.title'], body: copy['why.4.body'], image: editorial.craft },
];

/**
 * The four things that separate this tee from the one that stopped fitting.
 *
 * They were a four-across grid of tiles, which put four photographs and four
 * paragraphs on the screen at once and gave a shopper no order to read them
 * in. They are chapters now: one at a time, each with room, in the order they
 * are numbered.
 */
export default async function WhyShrinklessPage() {
  const [media, copy, layer, mediaLayer] = await Promise.all([
    getSiteMedia(),
    getSiteContent(),
    getContentLayer('why-shrinkless'),
    getMediaLayer('why-shrinkless'),
  ]);

  return (
    <>
      <PageOpener
        media={{ kind: 'image', image: media.editorial.fabric }}
        title={copy['why.title']}
        body={copy['why.lede']}
      />

      {/* Keeps the `tiles` class so the Media tab's section settings land. */}
      <ChapterBand chapters={points(media, copy)} label="The four points" sectionClass="tiles" />

      <HomeScene className={`pg-proof ${homeFonts}`} aria-label="Measured shrinkage">
        <div className="hm-wrap">
          <div className="hm-mask hm-mask--tall">
            <p className="pg-proof__figure" data-hm-rise>{copy['why.proof.figure']}</p>
          </div>
          <p className="pg-proof__caption" data-hm-fade data-hm-delay="0.15">
            {copy['why.proof.caption']}
          </p>
        </div>
      </HomeScene>

      <StatementBand
        sectionClass="imageband"
        image={media.editorial.craft}
        statement={copy['why.title']}
        cta={{ href: '/shop', label: copy['why.cta'] }}
      />

      <ContentLayer {...layer} />

      <MediaLayer {...mediaLayer} />
    </>
  );
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit && npx eslint && npm test && npm run build
```

Expected: all pass. `npm run dev` and open `/why-shrinkless`: transparent masthead over the fabric photograph, four points alternating one at a time, the figure very large on ink, the pill at the foot. Check reduced motion.

- [ ] **Step 4: Confirm `OverlayTiles` and the old page classes are dead, then remove them**

```bash
grep -rn "OverlayTiles" app components lib tests
grep -rn "pagehead\|shopcta" app components lib tests
```

If `OverlayTiles` has **no** matches outside its own file, `git rm components/editorial/OverlayTiles.tsx`. If either `pagehead` or `shopcta` has no match outside `app/storefront.css`, delete those rule blocks from the stylesheet. **If anything else still uses them, leave it and say so in the commit message** — another page depending on them is a fact about the codebase, not a reason to break it.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Give the four points room to be read

They were a four-across grid: four photographs and four paragraphs on the
screen at once, numbered 01 to 04 but with no order to read them in, and the
least homepage-like composition in the store. They are chapters now, one at a
time.

All four points keep the copy keys they have always had — only what is around
them changed.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Rebuild the catalogue heads

**Files:**
- Create: `components/pages/CatalogueHead.tsx`
- Modify: `app/(shop)/(instagram-last)/shop/[[...category]]/page.tsx`, `components/pages/pages.css` (append)

**Interfaces:**
- Consumes: `homeFonts`, `HomeScene`, `cropStyle`, `categoryImage` (`lib/services/site-media.ts`), `SHOPPABLE` (`lib/shop/navigation.ts`).
- Produces:

```ts
export function CatalogueHead(props: {
  title: string;
  eyebrow?: string;
  lede?: string;
  count?: number;
  image?: BrandImage;
}): JSX.Element;
```

Task 11 reuses it for Wholesale.

- [ ] **Step 1: Write `CatalogueHead.tsx`**

```tsx
import Image from 'next/image';
import { cropStyle } from '@/lib/media/crop';
import type { BrandImage } from '@/lib/brand/images';
import { homeFonts } from '@/components/home/fonts';
import { HomeScene } from '@/components/home/HomeScene';
import './pages.css';

type Props = {
  title: string;
  eyebrow?: string;
  lede?: string;
  /** Shown as a two-digit count beside the title. */
  count?: number;
  /** When the collection has photography of its own. Without it the head is
   *  type on paper — a stand-in photograph would be a lie about the page. */
  image?: BrandImage;
};

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * What a collection opens on.
 *
 * A band rather than a hero: a grid of products is the point of these pages,
 * and a full screen of photography above it is a door the shopper has already
 * come through. The masthead stays on paper over it — these routes are not in
 * `lib/shop/chrome.ts`.
 */
export function CatalogueHead({ title, eyebrow, lede, count, image }: Props) {
  const lit = Boolean(image);

  return (
    <HomeScene
      className={`pg-head${lit ? ' pg-head--lit' : ''} ${homeFonts}`}
      aria-label={title}
    >
      {image ? (
        <>
          <div className="pg-head__media" data-hm-parallax="5">
            <Image
              src={image.url}
              alt=""
              fill
              priority
              sizes="100vw"
              className="pg-head__image"
              style={cropStyle(image)}
            />
          </div>
          <div className="pg-head__scrim" aria-hidden="true" />
        </>
      ) : null}

      <div className="hm-wrap pg-head__inner">
        {eyebrow ? <p className="hm-eyebrow" data-hm-fade>{eyebrow}</p> : null}

        <div className="pg-head__line">
          <div className="hm-mask hm-mask--tall">
            <h1 className="pg-head__title" data-hm-rise data-hm-delay="0.08">{title}</h1>
          </div>

          {typeof count === 'number' && count > 0 ? (
            <p className="pg-head__count tnum" data-hm-fade data-hm-delay="0.2">
              {pad(count)} {count === 1 ? 'style' : 'styles'}
            </p>
          ) : null}
        </div>

        {lede ? <p className="pg-head__lede" data-hm-fade data-hm-delay="0.25">{lede}</p> : null}
      </div>
    </HomeScene>
  );
}
```

- [ ] **Step 2: Append its rules to `components/pages/pages.css`**

```css
/* --- a collection's head -------------------------------------------------- */

.pg-head {
  position: relative;
  overflow: hidden;
  padding-block: clamp(2.5rem, 7vh, 5rem);
  background: var(--hm-chalk);
  color: var(--hm-ink);
}

/* With a photograph it is a band, not a hero: the grid below is the page. */
.pg-head--lit {
  display: grid;
  align-items: end;
  min-height: clamp(18rem, 44svh, 28rem);
  background: var(--hm-ink);
  color: var(--hm-white);
}

.pg-head__media { position: absolute; inset: -4% 0; z-index: 0; }
.pg-head__image { object-fit: cover; }

.pg-head__scrim {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(to top, rgba(10, 10, 10, 0.7), rgba(10, 10, 10, 0.2));
}

.pg-head__inner { position: relative; z-index: 2; }

.pg-head__line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: clamp(0.75rem, 2vw, 1.5rem);
  margin-top: 0.5rem;
}

.pg-head__title {
  margin: 0;
  font-family: var(--hm-bebas);
  font-size: clamp(2.75rem, 9vw, 7rem);
  font-weight: 400;
  letter-spacing: 0;
  line-height: 0.88;
  text-transform: uppercase;
}

.pg-head__count {
  margin: 0;
  color: var(--hm-smoke);
  font-family: var(--hm-mono);
  font-size: 0.6875rem;
  text-transform: uppercase;
}

.pg-head--lit .pg-head__count { color: rgba(255, 255, 255, 0.72); }

.pg-head__lede {
  max-width: 46ch;
  margin: clamp(0.9rem, 2vw, 1.4rem) 0 0;
  color: var(--hm-stone);
  font-family: var(--hm-accent);
  font-size: clamp(0.95rem, 1.1vw, 1.05rem);
  line-height: 1.6;
}

.pg-head--lit .pg-head__lede { color: rgba(255, 255, 255, 0.82); }
.pg-head--lit :focus-visible { outline: 2px solid var(--hm-white); outline-offset: 3px; }
```

- [ ] **Step 3: Rewrite the shop route's head**

In `app/(shop)/(instagram-last)/shop/[[...category]]/page.tsx`: delete the `FALLBACK` constant (its wording is in the content registry now) and replace the `<header className="shoppage__head">…</header>` block. Keep every line of the filtering, `notFound()` and facet code exactly as it is.

Add imports:

```tsx
import { categoryImage, getSiteMedia } from '@/lib/services/site-media';
import { CatalogueHead } from '@/components/pages/CatalogueHead';
import { HomeGateway } from '@/components/home/HomeGateway';
import { SHOPPABLE } from '@/lib/shop/navigation';
```

After `const copy = await getSiteContent();` add:

```tsx
  const media = await getSiteMedia();

  // Men and Women open on their own photograph; the unfiltered grid has no art
  // of its own, and a stand-in would be a lie about the page. Both facts are
  // read off one value, so the type narrows without an assertion.
  const minimalKey = categorySlug ? MINIMAL_TITLE_KEYS[categorySlug] : undefined;
  const lit = categorySlug && minimalKey
    ? { title: copy[minimalKey], image: categoryImage(media, categorySlug) }
    : null;

  // The door to the other collection, so Men and Women cross-link the way the
  // homepage's two doors do.
  const others = SHOPPABLE.filter(({ slug }) => slug !== categorySlug);
```

Replace the returned JSX with:

```tsx
  return (
    <>
      {lit ? (
        <CatalogueHead title={lit.title} count={all.length} image={lit.image} />
      ) : (
        <CatalogueHead
          eyebrow={copy['shop.all.eyebrow']}
          title={copy['shop.all.title']}
          lede={copy['shop.all.lede']}
          count={all.length}
        />
      )}

      <div className="band band--tight shoppage">
        <div className="wrap">
          <ShopBrowser
            products={products}
            filter={filter}
            sizes={sizes}
            colors={colors}
            priceFloor={priceFloor}
            priceCeiling={priceCeiling}
            basePath={basePath}
            focusSearch={rawSearch?.focus === 'search'}
          />
        </div>
      </div>

      {/* One door on a category page, both on the unfiltered grid. */}
      <HomeGateway
        gateways={others.map(({ slug, label }) => ({
          slug,
          label,
          count: 0,
          image: categoryImage(media, slug),
        }))}
      />
    </>
  );
```

**The count is `all.length`, not `products.length`** — it describes the collection, not the current filter, the same reasoning the file already gives for the facet lists.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit && npx eslint && npm test && npm run build
```

Expected: all pass, including every existing filter test untouched. Then `npm run dev` and check `/shop`, `/shop/men`, `/shop/women`: paper masthead from first paint on all three; Men and Women open on their photograph with a white Bebas title and a mono count; All Products is type on paper; the grid and every filter still work; the door at the foot goes to the other collection. Confirm `/shop/men/anything` still 404s.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Open the collections the way the homepage opens

Men and Women open on their own photograph as a band — a band rather than a
hero, because the grid is the point of the page and a full screen of
photography is a door the shopper has already come through. All Products stays
type on paper: it has no art of its own and a stand-in would be a lie about it.

Its title and lede move out of the route file into the Content tab, where the
rest of the store's wording lives.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Rebuild Wholesale

**Files:**
- Modify: `app/(shop)/(instagram-last)/wholesale/page.tsx`, `components/pages/pages.css` (append)

**Interfaces:**
- Consumes: `CatalogueHead` (Task 10), `SpecStrip`, `StatementBand` (Task 7), `.hm-dark` (Task 1), the wholesale copy keys and `tradeStatement` slot (Task 6).
- Produces: nothing.

- [ ] **Step 1: Append the dark-ground rules to `components/pages/pages.css`**

```css
/* --- on ink --------------------------------------------------------------- */

/* Wholesale is set on ink. `.hm-dark` swaps what the tokens mean, so the
   sections above need no dark copies of themselves — only the two grounds that
   are painted rather than inherited have to be told. */
.hm-dark .pg-head,
.hm-dark .pg-spec {
  background: var(--hm-chalk);
  color: var(--hm-ink);
}

.hm-dark .pg-spec { border-block-color: var(--hm-line-light); }
```

- [ ] **Step 2: Rewrite the page's head and foot**

In `app/(shop)/(instagram-last)/wholesale/page.tsx`, keep every line of the filtering, sorting and facet code exactly as it is. Add imports:

```tsx
import { getSiteMedia } from '@/lib/services/site-media';
import { CatalogueHead } from '@/components/pages/CatalogueHead';
import { SpecStrip } from '@/components/pages/SpecStrip';
import { StatementBand } from '@/components/pages/StatementBand';
```

Change the data fetch to bring in the photography and the content layer together:

```tsx
  const [all, copy, media, layer] = await Promise.all([
    listWholesaleProducts(),
    getSiteContent(),
    getSiteMedia(),
    getContentLayer('wholesale'),
  ]);
```

and replace the `return (…)` block with:

```tsx
  return (
    <div className="hm-dark tradesheet">
      <CatalogueHead
        title={copy['wholesale.title']}
        lede={copy['wholesale.lede']}
        count={all.length}
      />

      {/* The four facts a buyer looks for before anything else. They were
          somewhere further down the page, or on a style's own page. */}
      <SpecStrip
        label="Trade terms"
        items={[
          copy['wholesale.terms.1'],
          copy['wholesale.terms.2'],
          copy['wholesale.terms.3'],
          copy['wholesale.terms.4'],
        ]}
      />

      <div className="band band--tight">
        <div className="wrap">
          <ContentLayer {...layer} />

          <ShopBrowser
            filter={filter}
            sizes={sizes}
            colors={colors}
            genders={genders}
            priceFloor={priceFloor}
            priceCeiling={priceCeiling}
            basePath="/wholesale"
            count={styles.length}
            grid={<WholesaleGrid styles={styles} />}
            emptyMessage="Nothing matches that. Clear a filter and try again."
          />
        </div>
      </div>

      <StatementBand
        image={media.editorial.tradeStatement}
        statement={copy['wholesale.statement']}
        cta={{ href: '/wholesale#enquiry', label: copy['wholesale.cta'] }}
      />
    </div>
  );
```

Note `getContentLayer('wholesale')` moves out of the JSX into the `Promise.all` — awaiting inside the returned markup made it a second, serial round trip.

- [ ] **Step 3: Check the enquiry anchor is real**

```bash
grep -rn "id=\"enquiry\"\|WholesaleEnquiryForm" app components
```

The enquiry form lives on a style's own page, not on the line sheet, so `#enquiry` almost certainly does not exist here. **Do not ship a link to an anchor that is not on the page.** Take the first of these that the grep supports:

1. If `/wholesale` does render an element with `id="enquiry"`, keep `href="/wholesale#enquiry"`.
2. Otherwise point the pill at the store's email, which the page already has in scope through settings — read it the way `app/(shop)/layout.tsx` does (`getStoreSettings()` → `settings.storeEmail`), add it to this page's `Promise.all`, and use:

```tsx
        cta={{ href: `mailto:${settings.storeEmail}?subject=Wholesale enquiry`, label: copy['wholesale.cta'] }}
```

   `StatementBand` renders the pill through `HomePill`, which uses `next/link`. A `mailto:` needs the plain anchor instead, so pass `external` through — if `HomePill`'s `external` prop is not already reachable from `StatementBand`, add it to `StatementBand`'s `cta` type as `external?: boolean` and forward it.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit && npx eslint && npm test && npm run build
```

Expected: all pass, wholesale tests untouched. `npm run dev`, open `/wholesale`: paper masthead, dark page, Bebas title, the four terms readable as a strip, the line sheet and every filter working, the closing band's pill going somewhere real.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Put the trade terms where a buyer looks for them

MOQ, styles, lead time and whether it is made to order are the four things a
wholesale buyer reads before anything else, and the line sheet made them hunt
for them. They are a strip under the title now.

The page is on ink, so it sets .hm-dark and the shared sections follow rather
than being copied.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Restyle the filter panel

**Files:**
- Modify: `app/storefront.css` (the `.filters`, `.browser` and related blocks)
- Possibly modify: `components/shop/ShopBrowser.tsx`, `components/shop/FilterPanel.tsx` — **class names and markup only**

**Interfaces:**
- Consumes: `hm-core.css` tokens.
- Produces: nothing.

**This is the task most likely to overrun its boundary.** The rule: no change to props, state, URL parameters, event handlers or the filtering logic. If a change would require editing a filter test, stop and report.

- [ ] **Step 1: Find the rules and the tests that guard the behaviour**

```bash
grep -n "\.filters\|\.browser\|\.chip\|\.sortbar" app/storefront.css | head -40
npx vitest run tests/unit/shop tests/unit/validation
```

Note which tests pass now. They must still pass, unchanged, at Step 3.

- [ ] **Step 2: Append one override block to `app/storefront.css`**

Do **not** rewrite the existing `.filters`, `.chip` and `.swatch` blocks in place. Append a single clearly-marked section at the end of the file that restates only the properties that carry voice — face, size, tracking, colour, radius. Everything about layout, position and behaviour is left exactly where it is, which is what keeps this task from becoming a behaviour change.

No component file is edited in this task. The class names below are the ones `FilterPanel.tsx` and `ShopBrowser.tsx` already render.

```css
/* --------------------------------------------------------------------------
   The collection controls, in the storefront's voice

   Appended rather than edited into the blocks above: what is restated here is
   only what carries voice — the face, the size, the tracking, the colour and
   the radius. Every rule about where a control sits and how it behaves is left
   untouched further up this file, which is why the filter panel still works
   exactly as it did.

   The tokens come from components/home/hm-core.css, which the layout loads
   through the masthead, so they resolve on every storefront page.
   -------------------------------------------------------------------------- */

.filters__legend,
.filters__price,
.filters__hint,
.shoplayout__bar,
.shoplayout__sheetbar {
  color: var(--hm-stone);
  font-family: var(--hm-mono);
  font-size: 0.6875rem;
  font-weight: 400;
  letter-spacing: 0;
  line-height: 1.4;
  text-transform: uppercase;
}

.filters__input,
.filters__select,
.filters__color {
  font-family: var(--hm-mono);
  font-size: 0.6875rem;
  letter-spacing: 0;
  text-transform: uppercase;
}

.filters__input { border-bottom-color: var(--hm-line-light); }
.filters__input:focus-visible { border-bottom-color: var(--hm-ink); }

/* The chips become pills, the same shape as the pill the pages call to action
   with — a store should have one idea of what a rounded control looks like. */
.chip {
  border-radius: 999px;
  border-color: var(--hm-line-light);
  color: var(--hm-ink);
  font-family: var(--hm-mono);
  font-size: 0.6875rem;
  letter-spacing: 0;
  text-transform: uppercase;
}

.chip--on {
  background: var(--hm-ink);
  border-color: var(--hm-ink);
  color: var(--hm-white);
}

.chip:has(:focus-visible),
.swatch:has(:focus-visible),
.filters__color:has(:focus-visible) {
  outline-color: var(--hm-ink);
}

.swatch--on { border-color: var(--hm-ink); }

/* The toggle that collapses the filter column, and the count beside it. */
.filters__toggle {
  font-family: var(--hm-mono);
  font-size: 0.6875rem;
  letter-spacing: 0;
  text-transform: uppercase;
}

.filters__dot { background: var(--hm-ink); }

/* On ink — the wholesale line sheet. `.hm-dark` has already swapped what the
   tokens mean, so these rules need no dark variants of their own; only the
   two that paint rather than inherit have to be told. */
.hm-dark .chip--on {
  background: var(--hm-ink);
  color: var(--hm-chalk);
}
```

- [ ] **Step 3: Verify the behaviour is untouched**

```bash
npx tsc --noEmit && npx eslint && npm test && npm run build
```

Expected: all pass **with no test file edited in this task**. `git diff --stat tests/` must be empty. If it is not, revert the component change that forced it.

- [ ] **Step 4: Exercise the filters by hand**

`npm run dev`. On `/shop/men` and `/wholesale`: open the panel, select two sizes and a colour, drag the price range, type in search, change the sort, clear a filter. The URL must update exactly as it did before and the grid must match. At phone width, confirm the panel is still a sheet and not a column.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Set the filters in the same voice as the pages around them

Mono labels, pill chips, Bebas facet headings, hairlines from the shared token.
The panel is shared by all four grid pages, so it was the one place left where
a collection page changed voice halfway down.

Behaviour, props and the URL contract are untouched — no test changed.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Final gates and manual verification

**Files:** none, unless a check fails.

- [ ] **Step 1: Run every gate**

```bash
npx tsc --noEmit
npx eslint
npm test
npm run build
```

All four must pass. Record the test count — it should be 575 plus the 13 added in Tasks 2 and 5, minus none.

- [ ] **Step 2: Walk every route**

`npm run dev`, then at **desktop, tablet and phone** widths:

| Route | Must be true |
|---|---|
| `/` | Charcoal bar; transparent masthead over the campaign, paper on scroll; campaign ends where it did; closing the bar does not move the page |
| `/our-story` | Transparent masthead over the film; three chapters; care strip; closing band |
| `/why-shrinkless` | Transparent masthead; four points one at a time; the figure large on ink |
| `/shop` | Paper masthead from first paint; type-only head; grid and filters work |
| `/shop/men`, `/shop/women` | Photographic head band; mono count; door to the other collection |
| `/wholesale` | Paper masthead; dark page; terms strip; line sheet and filters work |
| `/cart`, `/checkout`, `/faq`, `/product/[slug]`, `/wholesale/[slug]` | New masthead and bar behave; bodies unchanged and still functional |

- [ ] **Step 3: Check the announcement bar specifically**

- Close it. Navigate to three other pages — it stays closed on all of them.
- In the admin Settings tab, change the announcement text. Reload the storefront: **the bar comes back**, because the cookie holds the old message's tag.
- At a narrow phone width, watch a full marquee loop: no type passes under the X.
- With a keyboard: tab to the close button, confirm a visible focus ring, activate with Enter.

- [ ] **Step 4: Check reduced motion**

Turn on the OS "reduce motion" setting and reload every one of the six pages. **Every element must be present in its finished position.** Nothing invisible, nothing mid-transform, and the marquee must be still.

- [ ] **Step 5: Check the admin tabs still agree with the site**

Open `/admin/content` and `/admin/media`. Content lists Home, Our Story, Why Shrinkless and FAQ with the new sections. Media lists four pages — Homepage, Our Story, Why Shrinkless, Wholesale — each with at least one frame. Change one heading and one photograph, publish, and confirm the storefront shows it.

- [ ] **Step 6: Push**

```bash
git status
git push origin main
```

`git status` must be clean apart from `AGENTS.md` if `next dev` rewrote it — in which case commit it with the work.

---

## Notes for whoever executes this

- **Tasks 1, 4 and 5 touch the homepage**, which is currently correct and is not one of the six pages being redesigned. If the homepage looks different after any of them, that is a regression, not a redesign.
- **Task 4 is the single riskiest edit.** Re-read hazard 5 in the spec before starting it, and verify at more than one window height.
- **Tasks 8 through 11 are independent of each other** once 6 and 7 are done. They can be reviewed in any order.
- **If a task needs a filter, cart, checkout or pricing test edited, stop.** That is the signal that the restyle has become a behaviour change.
