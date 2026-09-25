/**
 * Every legal page the storefront publishes, in the order the footer and the
 * policy sidebar list them.
 *
 * One list, because the places that must link a legal page are many — the
 * footer, the sidebar on each policy, the sitemap — and a page that exists but
 * is not linked from every page of the site is, for CalOPPA and the ADA
 * complaints that cite it, a page that does not exist. Add a page here and it
 * is linked everywhere; tests/unit/legal/pages.test.ts holds the rest in step.
 *
 * Pure data: the footer is a server component, but nothing here may import a
 * database.
 */
export const LEGAL_PAGES = [
  { id: 'terms', href: '/terms', label: 'Terms & Conditions' },
  { id: 'refunds', href: '/refund-policy', label: 'Refund Policy' },
  { id: 'shipping', href: '/shipping-returns', label: 'Shipping & Returns' },
  { id: 'privacy', href: '/privacy-policy', label: 'Privacy Policy' },
  { id: 'accessibility', href: '/accessibility', label: 'Accessibility' },
] as const;

export type LegalPageId = (typeof LEGAL_PAGES)[number]['id'];

/**
 * The date the current wording took effect. Shown at the head of every policy.
 *
 * Change it whenever the *default* wording of a policy changes in
 * lib/services/site-content.ts. Edits made on the admin Content tab are dated
 * by the database instead — see loadPolicy in components/pages/policy-data.ts.
 */
export const POLICIES_EFFECTIVE = '2026-09-24';

/** The facts the policies promise. Stated once so the refund page, the
 *  shipping page, the FAQ and the product page cannot disagree. */
export const RETURN_WINDOW_DAYS = 30;
export const DISPATCH_BUSINESS_DAYS = '1–3';
