import { z } from 'zod';

import { ZOOM_MAX, ZOOM_MIN } from '@/lib/media/crop';

const optionValue = z.string().trim().toLowerCase().min(1);
const cents = z.number().int().min(0);

const imageSchema = z.object({
  publicId: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string().trim().default(''),
  /* The crop. Percentages only, because this value ends up in a style
     attribute — the same rule `lib/validation/media.ts` applies to site
     media, for the same reason. */
  focus: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || /^\d{1,3}% \d{1,3}%$/.test(value),
      'Focus looks like "50% 30%"',
    )
    .default(''),
  zoom: z.coerce.number().min(ZOOM_MIN).max(ZOOM_MAX).default(ZOOM_MIN),
  mobileFocus: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || /^\d{1,3}% \d{1,3}%$/.test(value),
      'Focus looks like "50% 30%"',
    )
    .default(''),
  /* Absent, not 1, until the phone has a zoom of its own. */
  mobileZoom: z.coerce.number().min(ZOOM_MIN).max(ZOOM_MAX).optional(),
});

export const seoInputSchema = z.object({
  title: z.string().trim().max(70, 'Keep the SEO title under 70 characters').default(''),
  description: z
    .string()
    .trim()
    .max(160, 'Keep the SEO description under 160 characters')
    .default(''),
  keywords: z.array(z.string().trim().toLowerCase().min(1)).max(20).default([]),
});

/**
 * How a product may be bought.
 *
 * `step` is what makes "sold in pairs" or "twelve at a time" expressible:
 * quantities are `min`, `min + step`, `min + 2·step`, … The refinements catch
 * the two rules that would otherwise produce a product nobody can buy — a max
 * below the min, and a max that no step ever lands on.
 */
export const quantityRuleSchema = z
  .object({
    min: z.number().int().min(1, 'Minimum quantity must be at least 1').default(1),
    step: z.number().int().min(1, 'Quantity step must be at least 1').default(1),
    max: z.number().int().min(1).nullable().default(null),
  })
  .refine((rule) => rule.max === null || rule.max >= rule.min, {
    message: 'Maximum quantity cannot be below the minimum',
    path: ['max'],
  })
  .refine((rule) => rule.max === null || (rule.max - rule.min) % rule.step === 0, {
    message: 'The maximum has to be reachable from the minimum in whole steps',
    path: ['max'],
  });

const variantInputSchema = z.object({
  variantId: z.string().min(1).nullable().default(null),
  size: optionValue,
  color: optionValue,
  sku: z.string().trim().toUpperCase().min(1, 'Every variant needs a SKU'),
  priceCents: cents,
  stock: z.number().int().min(0, 'Stock cannot be negative'),
  enabled: z.boolean().default(true),
  lowStockThreshold: z.number().int().min(0).nullable().default(null),
  imagePublicId: z.string().trim().default(''),
});

export const productInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Keep the title under 200 characters'),
  slug: z.string().trim().toLowerCase().min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug may contain lowercase letters, numbers and dashes only'),
  description: z
    .string()
    .trim()
    .max(20_000, 'That description is longer than any product page needs')
    .default(''),
  category: z.string().trim().toLowerCase().min(1, 'Category is required'),
  status: z.enum(['draft', 'published']),
  featured: z.boolean().default(false),
  badge: z.enum(['none', 'new']).default('none'),
  rating: z.number().min(0).max(5).default(0),
  tags: z.array(z.string().trim().toLowerCase().min(1)).max(30).default([]),
  baseSku: z.string().trim().toUpperCase().default(''),
  seo: seoInputSchema.default({ title: '', description: '', keywords: [] }),
  quantityRule: quantityRuleSchema.default({ min: 1, step: 1, max: null }),
  images: z.array(imageSchema).default([]),
  sizes: z.array(optionValue).default([]),
  colors: z.array(optionValue).default([]),
  variants: z.array(variantInputSchema).default([]),
});

export type ProductInput = z.infer<typeof productInputSchema>;
export type VariantInput = z.infer<typeof variantInputSchema>;
export type SeoInput = z.infer<typeof seoInputSchema>;
export type QuantityRule = z.infer<typeof quantityRuleSchema>;

/**
 * Is this a quantity the product actually sells in?
 *
 * Enforced on the server for every add-to-cart and every quantity change. The
 * picker in the browser offers only legal values, but a picker is a
 * convenience — this is the rule.
 */
export function isAllowedQuantity(
  quantity: number,
  rule: { min: number; step: number; max: number | null },
): boolean {
  if (!Number.isInteger(quantity) || quantity < rule.min) return false;
  if (rule.max !== null && quantity > rule.max) return false;

  return (quantity - rule.min) % rule.step === 0;
}

/** The nearest legal quantity at or above `quantity`, capped by `max`. Used to
 *  correct a value rather than reject it where correcting is kinder. */
export function snapQuantity(
  quantity: number,
  rule: { min: number; step: number; max: number | null },
): number {
  if (quantity <= rule.min) return rule.min;

  const steps = Math.ceil((quantity - rule.min) / rule.step);
  const snapped = rule.min + steps * rule.step;

  return rule.max !== null ? Math.min(snapped, rule.max) : snapped;
}

/**
 * The lowest and highest legal quantity a stepper may offer.
 *
 * Three ceilings meet here: what the shelf holds, what the product's own rule
 * allows, and where the last whole step lands below both. `available` is null
 * before a variant is chosen, when there is no stock figure to cap against —
 * the stepper opens on ten steps' worth so it is not stuck on its minimum.
 *
 * Shared, because the product page and the quick view are the same control in
 * two frames and had drifted: one honoured the rule and the other stepped by
 * one, so a tee sold in twelves could be added as a single from the grid and
 * refused by the server for it.
 */
export function quantityBounds(
  rule: { min: number; step: number; max: number | null },
  available: number | null,
): { lowest: number; highest: number } {
  const stockCeiling = available ?? rule.min + rule.step * 9;
  const ruleCeiling = rule.max ?? Number.POSITIVE_INFINITY;
  const ceiling = Math.max(Math.min(stockCeiling, ruleCeiling), rule.min);

  const highest = rule.min + Math.floor((ceiling - rule.min) / rule.step) * rule.step;

  return { lowest: rule.min, highest: Math.max(highest, rule.min) };
}

/** The legal quantities, for a picker to render. Capped so an unbounded rule
 *  cannot produce an unbounded list. */
export function quantityOptions(
  rule: { min: number; step: number; max: number | null },
  available: number,
  limit = 50,
): number[] {
  const ceiling = rule.max === null ? available : Math.min(rule.max, available);
  const options: number[] = [];

  for (let value = rule.min; value <= ceiling && options.length < limit; value += rule.step) {
    options.push(value);
  }

  return options;
}
