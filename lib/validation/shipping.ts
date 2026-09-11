import { z } from 'zod';

const stateCode = z.string().trim().toUpperCase().length(2, 'Use two-letter codes');

export const shippingMethodInputSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1, 'Name is required'),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, 'A code needs at least 2 characters')
    .regex(/^[A-Z0-9_-]+$/, 'Codes may contain letters, numbers, dashes and underscores'),
  description: z.string().trim().max(200).default(''),
  rateCents: z.number().int().min(0, 'A rate cannot be negative'),
  freeOverCents: z.number().int().min(0).nullable().default(null),
  countries: z.array(stateCode).default([]),
  states: z.array(stateCode).default([]),
  estimate: z.string().trim().max(80).default(''),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

export type ShippingMethodInput = z.infer<typeof shippingMethodInputSchema>;
