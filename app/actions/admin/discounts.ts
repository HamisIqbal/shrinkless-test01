'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { adminAction } from '@/lib/admin/action';
import {
  DiscountCodeTakenError,
  DiscountNotFoundError,
  archiveDiscount,
  saveDiscount,
} from '@/lib/services/discounts';
import { discountInputSchema } from '@/lib/validation/discount';

function revalidateDiscounts(): void {
  revalidatePath('/admin/discounts');
  revalidatePath('/cart');
}

function translate(error: unknown): string | null {
  if (error instanceof DiscountCodeTakenError) return error.message;
  if (error instanceof DiscountNotFoundError) return 'That discount no longer exists.';
  return null;
}

export const saveDiscountAction = adminAction(
  {
    permission: 'discounts:write',
    schema: discountInputSchema,
    translate,
    genericError: 'Could not save the discount.',
  },
  async (input) => {
    const id = await saveDiscount(input);
    revalidateDiscounts();
    return { id };
  },
);

export const archiveDiscountAction = adminAction(
  {
    permission: 'discounts:write',
    schema: z.object({ id: z.string().min(1), archived: z.boolean() }),
    translate,
    genericError: 'Could not archive the discount.',
  },
  async (input) => {
    await archiveDiscount(input.id, input.archived);
    revalidateDiscounts();
    return undefined;
  },
);
