import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Every form that takes personal information shows the consent line next to
 * its button. A new form that collects an email, an address or a payment
 * belongs in this list.
 */
const FORMS: [file: string, kind: string][] = [
  ['components/account/AuthForm.tsx', 'account'],
  ['components/shop/CheckoutFlow.tsx', 'order'],
  ['components/site/NewsletterForm.tsx', 'marketing'],
  ['components/shop/RestockForm.tsx', 'restock'],
  ['components/shop/WholesaleEnquiryForm.tsx', 'enquiry'],
];

describe('consent notices', () => {
  it.each(FORMS)('%s shows the %s notice', (file, kind) => {
    const source = readFileSync(join(process.cwd(), file), 'utf8');
    expect(source).toContain(`<ConsentNote kind="${kind}"`);
  });
});
