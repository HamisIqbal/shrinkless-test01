import { z } from 'zod';

const zoneSchema = z.object({
  name: z.string().trim().min(1, 'Zone name is required'),
  states: z.array(z.string().trim().toUpperCase().length(2)).default([]),
  rateCents: z.number().int().min(0),
});

export const settingsInputSchema = z.object({
  storeEmail: z.string().trim().toLowerCase().pipe(z.email()),
  announcement: z.string().trim().default(''),
  shippingZones: z.array(zoneSchema).default([]),
  freeShippingThresholdCents: z.number().int().min(0).nullable().default(null),
  lowStockThreshold: z.number().int().min(0).max(10_000).default(3),
  taxMode: z.enum(['none', 'flat', 'stripe']),
  flatTaxRateBasisPoints: z.number().int().min(0).max(10_000).default(0),
});

export type SettingsInput = z.infer<typeof settingsInputSchema>;
