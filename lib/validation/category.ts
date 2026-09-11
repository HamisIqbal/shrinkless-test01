import { z } from 'zod';
import { seoInputSchema } from '@/lib/validation/product';

export const SLUG_PATTERN = /^[a-z0-9-]+$/;

export const categoryInputSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1, 'Name is required'),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Slug is required')
    .regex(SLUG_PATTERN, 'Slug may contain lowercase letters, numbers and dashes only'),
  description: z.string().trim().default(''),
  visible: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  seo: seoInputSchema.default({ title: '', description: '', keywords: [] }),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;
