'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { adminAction, type AdminResult } from '@/lib/admin/action';
import {
  ProductNotFoundError,
  SkuTakenError,
  SlugTakenError,
  saveProduct,
} from '@/lib/services/products';
import { productInputSchema } from '@/lib/validation/product';
import { WHOLESALE_TAG } from '@/lib/wholesale/catalogue';

/**
 * Saving a wholesale style.
 *
 * A thin collar around `saveProduct`, not a second save path. A wholesale
 * style is a product — it has a slug, copy, photography, option sets and
 * variants like any other — and giving it its own persistence would mean two
 * places to fix the day a field is added.
 *
 * What the collar does is guarantee the one thing that makes a product a
 * wholesale style: the tag. `lib/services/products.ts` excludes it from every
 * customer-facing query, so a style saved without it would silently appear on
 * the retail shop grid at its retail price — the single worst outcome this
 * editor could produce. The tag is therefore reapplied here rather than
 * carried in a form field an admin could clear.
 */
function withWholesaleTag(tags: readonly string[]): string[] {
  return tags.includes(WHOLESALE_TAG) ? [...tags] : [WHOLESALE_TAG, ...tags];
}

function translateWholesaleError(error: unknown): string | null {
  if (error instanceof SlugTakenError) return error.message;
  if (error instanceof SkuTakenError) return error.message;
  if (error instanceof ProductNotFoundError) return 'That wholesale style no longer exists.';
  return null;
}

const saveSchema = productInputSchema.extend({ id: z.string().min(1).optional() });

export type SaveWholesaleResult = AdminResult<{ id: string }>;

export const saveWholesaleProductAction = adminAction(
  {
    permission: 'products:write',
    schema: saveSchema,
    translate: translateWholesaleError,
    genericError: 'Could not save the wholesale style.',
  },
  async (input, actor) => {
    const id = await saveProduct(
      { ...input, tags: withWholesaleTag(input.tags) },
      { id: actor.id, email: actor.email },
    );

    // The line sheet is the surface that changed; the admin list and the
    // header (which carries the wholesale flag) follow it.
    revalidatePath('/wholesale');
    revalidatePath('/admin/wholesale');

    return { id };
  },
);
