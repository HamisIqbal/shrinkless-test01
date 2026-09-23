# Compliance & security rules

The rules this store follows so it stays legal to run in the US and safe to
use. They came out of the audit of 2026-09-24. Tests enforce most of them:
`npm test` fails if one is broken. Read this before you change copy, forms,
policies, products, email, or admin actions.

This is engineering guidance, not legal advice. Have a US attorney review the
policy wording in `lib/legal/policy-text.ts` once, and again after any big
change.

## Where things live

| Concern | File |
|---|---|
| List of legal pages (footer, sidebar, sitemap all read it) | `lib/legal/pages.ts` |
| Policy wording (Terms, Refund, Shipping, Privacy, Accessibility) | `lib/legal/policy-text.ts` |
| Return window and dispatch time (stated once, used everywhere) | `lib/legal/pages.ts` → `RETURN_WINDOW_DAYS`, `DISPATCH_BUSINESS_DAYS` |
| Business name, address, phone, governing state | Admin → Settings → Business details |
| Consent line under forms | `components/legal/ConsentNote.tsx` |
| Unsubscribe links for marketing mail | `lib/email/unsubscribe.ts` |
| Order confirmation / shipped emails | `lib/email/order.ts` |
| Security headers | `next.config.ts` |

## Rules

### Copy and claims (FTC Act §5)
- **No placeholders on the live site.** Never ship `[TBC]`, `[TBD]`, `[TODO]` or
  lorem ipsum. The shipped defaults are tested. If an admin saves a placeholder,
  the storefront shows the default wording instead.
- **"Made in USA"** only if all or virtually all of the product, including its
  materials, is made in the US. Otherwise say "Imported" or give a qualified
  claim such as "Sewn in USA from imported fabric".
- **"Organic"** only with certification you can show (for example GOTS or USDA).
- **Shrink claims**: "doesn't shrink", "zero shrinkage" or "guaranteed" need
  wash-test results behind them. The measured-figure band on /why-shrinkless is
  hidden until a figure is entered, so only enter one you have tests for.
- A test fails if a default in `site-content.ts` says "made in USA" or
  "organic". When the claims are documented, update that test and the copy
  together.

### Reviews and ratings (16 CFR Part 465, the 2024 fake-reviews rule)
- **Real customers only**, used with their permission, not edited in a way
  that changes the meaning, and never paid for or invented. The home reviews
  band only shows quotes that have both text and a name, and it ships empty.
- **The product "rating" field is internal.** The storefront does not show it,
  because a number typed in by hand is a fake review. Only show star ratings
  once they come from real, collected reviews.

### Clothing labelling (Textile Rules, 16 CFR 303.34)
- Every product sold online must say its **fibre content** by percentage and
  its **country of origin**. Fill in *Fibre content* and *Country of origin* on
  every product in the admin editor. The product page shows them, and leaves a
  row out while it is blank.

### Shipping (FTC Mail Order Rule)
- Orders ship within `DISPATCH_BUSINESS_DAYS`. If one can't ship in time, email
  the customer **before** the deadline with a new date and the option to cancel
  for a full refund. Refund within 7 business days if they cancel.

### Policies
- Add a legal page by adding it to `LEGAL_PAGES`, adding its wording to
  `POLICY_TEXT`, and creating the route. The footer, sidebar and sitemap pick
  it up automatically. A test fails if the route is missing.
- Use `{{legalName}}`, `{{email}}`, `{{address}}`, `{{phone}}`, `{{state}}`
  tokens instead of hard-coding business details. A paragraph whose detail is
  blank is left out.
- After changing default wording, move `POLICIES_EFFECTIVE`. Edits saved in the
  admin Content tab update the "Effective" date automatically.
- If you start using analytics, ad pixels, or a "sell/share" data partner, the
  Privacy Policy's cookie and sharing sections become untrue. Update them and
  add a "Do Not Sell or Share" link and cookie consent **before** turning it on.

### Forms and email (CAN-SPAM, state privacy laws)
- Any new form that collects an email, address or payment shows
  `<ConsentNote>` next to its button, and gets added to
  `tests/unit/legal/consent.test.ts`.
- Marketing email goes only to `listMarketingEmails()` (people who opted in and
  have not unsubscribed). Every marketing email includes `unsubscribeUrl()` in
  the body, the `unsubscribeHeaders()` headers, and the business's postal
  address. Order and shipping emails are transactional, so never add
  promotions to them.
- Answer privacy requests (access, correct, delete) within 45 days.

### Security
- Every Server Action in `app/actions/admin` must use `adminAction()` or call
  `requirePermission()`. A test scans for this. The proxy is not enough.
- Public, unauthenticated writes (sign-up, newsletter, enquiries) are
  rate-limited using `clientAddress()` and `consume()` from `lib/security`.
- Never render user-supplied HTML. Escape anything a shopper typed before it
  goes into an email (see `escapeHtml` in `lib/email/order.ts`).
- Run `npm audit` before deploying. Upgrade Next.js promptly when an advisory
  lands.
- Secrets stay in `.env.local` and Vercel env vars, never in git.
  `.gitignore` already covers `.env*` and `*credentials*`.

## Things only the owner can do
- Fill in **Settings → Business details** (legal name, mailing address,
  governing-law state, and optionally a phone number).
- Fill in **fibre content and origin** on every product.
- Rewrite live product descriptions that say "organic" or "made in USA" unless
  those claims are documented. The same applies to the content overrides for
  the home hero lede and the Our Story text, which still say it.
- Confirm **RESEND_API_KEY** and a verified sending domain on Vercel, or
  confirmation and shipping emails will not go out. Also turn on Stripe's
  "successful payments" receipts as a backup.
- Decide on **sales tax**. Tax mode is "none". Once sales into a state pass its
  economic-nexus threshold, the store must collect that state's tax. Stripe Tax
  is already wired in as an option.
- Have an attorney review the policies. Consider whether to add an arbitration
  clause.
