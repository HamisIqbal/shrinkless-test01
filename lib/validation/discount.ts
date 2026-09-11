import { z } from 'zod';

/** Coupon codes are typed by people, in a hurry, from a phone. Case and
 *  surrounding space are never meaningful. */
export const discountCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(3, 'A code needs at least 3 characters')
  .max(32, 'Keep codes under 32 characters')
  .regex(/^[A-Z0-9_-]+$/, 'Codes may contain letters, numbers, dashes and underscores');

const dateInput = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined || value === '') return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  });

export const discountInputSchema = z
  .object({
    id: z.string().min(1).optional(),
    code: discountCodeSchema,
    description: z.string().trim().max(200).default(''),
    type: z.enum(['percentage', 'fixed']),
    /** Basis points for a percentage, cents for a fixed amount. Bounded below
     *  by the schema and above by the refinement, because "110% off" is a
     *  typo, not an offer. */
    value: z.number().int().min(1, 'A discount has to be worth something'),
    active: z.boolean().default(true),
    startsAt: dateInput,
    endsAt: dateInput,
    usageLimit: z.number().int().min(1).nullable().default(null),
    perCustomerLimit: z.number().int().min(1).nullable().default(null),
    minOrderCents: z.number().int().min(0).default(0),
    productIds: z.array(z.string().min(1)).default([]),
    categorySlugs: z.array(z.string().trim().toLowerCase().min(1)).default([]),
  })
  .refine((input) => input.type !== 'percentage' || input.value <= 10_000, {
    message: 'A percentage discount cannot exceed 100%',
    path: ['value'],
  })
  .refine(
    (input) => !input.startsAt || !input.endsAt || input.endsAt.getTime() > input.startsAt.getTime(),
    { message: 'The end date has to come after the start date', path: ['endsAt'] },
  );

export type DiscountInput = z.infer<typeof discountInputSchema>;
