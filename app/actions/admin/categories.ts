'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { adminAction } from '@/lib/admin/action';
import {
  CategoryNotEmptyError,
  CategoryNotFoundError,
  CategorySlugTakenError,
  archiveCategory,
  assignProductsToCategory,
  backfillCategoriesFromProducts,
  reorderCategories,
  saveCategory,
} from '@/lib/services/categories';
import { categoryInputSchema } from '@/lib/validation/category';

function revalidateCategories(): void {
  revalidatePath('/admin/categories');
  revalidatePath('/admin/products');
  revalidatePath('/shop');
  revalidatePath('/', 'layout');
}

function translate(error: unknown): string | null {
  if (error instanceof CategorySlugTakenError) return error.message;
  if (error instanceof CategoryNotEmptyError) return error.message;
  if (error instanceof CategoryNotFoundError) return 'That category no longer exists.';
  return null;
}

export const saveCategoryAction = adminAction(
  {
    permission: 'categories:write',
    schema: categoryInputSchema,
    translate,
    genericError: 'Could not save the category.',
  },
  async (input) => {
    const id = await saveCategory(input);
    revalidateCategories();
    return { id };
  },
);

export const archiveCategoryAction = adminAction(
  {
    permission: 'categories:write',
    schema: z.object({ id: z.string().min(1), archived: z.boolean() }),
    translate,
    genericError: 'Could not archive the category.',
  },
  async (input) => {
    await archiveCategory(input.id, input.archived);
    revalidateCategories();
    return undefined;
  },
);

export const reorderCategoriesAction = adminAction(
  {
    permission: 'categories:write',
    schema: z.object({ orderedIds: z.array(z.string().min(1)).min(1) }),
    translate,
    genericError: 'Could not reorder the categories.',
  },
  async (input) => {
    await reorderCategories(input.orderedIds);
    revalidateCategories();
    return undefined;
  },
);

/** Bulk assign. The only way to move many products at once, and the reason
 *  archiving a category can insist on being empty. */
export const assignProductsAction = adminAction(
  {
    permission: 'categories:write',
    schema: z.object({
      productIds: z.array(z.string().min(1)).min(1, 'Choose at least one product'),
      slug: z.string().trim().toLowerCase().min(1),
    }),
    translate,
    genericError: 'Could not move those products.',
  },
  async (input) => {
    const moved = await assignProductsToCategory(input.productIds, input.slug);
    revalidateCategories();
    return { moved };
  },
);

/** One-shot import of the slugs products already use. Safe to run twice. */
export const backfillCategoriesAction = adminAction(
  {
    permission: 'categories:write',
    schema: z.object({}),
    genericError: 'Could not import the existing categories.',
  },
  async () => {
    const created = await backfillCategoriesFromProducts();
    revalidateCategories();
    return { created };
  },
);
