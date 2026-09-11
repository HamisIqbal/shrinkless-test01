import { z } from 'zod';
import { WHOLESALE_CATALOGUE } from '@/lib/wholesale/catalogue';
import { WHOLESALE_TIERS, type WholesaleTier } from '@/lib/wholesale/pricing';

/**
 * What a trade buyer is allowed to send.
 *
 * Notice what a line does NOT carry: a price, a title, or a total. The browser
 * is shown all three and is trusted with none of them — the action looks the
 * style up and re-prices it through `lib/wholesale/pricing.ts`. An enquiry is
 * a request for a quote, and a request that could name its own price is not a
 * request.
 */

/**
 * Turns the `slug:tier` pairs a form sends into objects.
 *
 * A malformed pair is kept, not skipped. Dropping it would leave the buyer
 * with a confirmation for fewer styles than they chose and no indication that
 * anything went missing; carrying it through means the schema rejects the
 * submission and says so.
 */
export function parseEnquiryLines(values: readonly string[]): unknown[] {
  return values.map((value) => {
    const separator = value.lastIndexOf(':');
    if (separator < 0) return { slug: value, tier: Number.NaN };

    return {
      slug: value.slice(0, separator),
      tier: Number(value.slice(separator + 1)),
    };
  });
}

const lineSchema = z.object({
  slug: z.string().trim().min(1).max(200),
  tier: z
    .number()
    .refine(
      (value): value is WholesaleTier =>
        (WHOLESALE_TIERS as readonly number[]).includes(value),
      { message: `Choose one of ${WHOLESALE_TIERS.join(', ')} units` },
    ),
});

export const wholesaleEnquirySchema = z.object({
  company: z.string().trim().min(2, 'Tell us the company name').max(120),
  contactName: z.string().trim().min(2, 'Tell us who to reply to').max(120),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address')),
  phone: z.string().trim().max(40).default(''),
  country: z.string().trim().min(2, 'Tell us where the order is shipping').max(80),
  message: z.string().trim().max(2000).default(''),
  lines: z
    .array(lineSchema)
    .min(1, 'Choose a style and a quantity before sending')
    // One line per style in the line sheet is the most an enquiry can hold.
    // The cap is a guard against a scripted submission, not a rule a real
    // buyer could ever meet.
    .max(WHOLESALE_CATALOGUE.length)
    .refine(
      (lines) => new Set(lines.map((line) => line.slug)).size === lines.length,
      { message: 'Each style can only appear once — change its quantity instead' },
    ),
});

export type WholesaleEnquiryInput = z.infer<typeof wholesaleEnquirySchema>;
