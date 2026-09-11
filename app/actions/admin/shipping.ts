'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { adminAction } from '@/lib/admin/action';
import {
  ShippingCodeTakenError,
  ShippingMethodNotFoundError,
  archiveShippingMethod,
  saveShippingMethod,
} from '@/lib/services/shipping';
import { shippingMethodInputSchema } from '@/lib/validation/shipping';

function revalidateShipping(): void {
  revalidatePath('/admin/shipping');
  revalidatePath('/cart');
}

function translate(error: unknown): string | null {
  if (error instanceof ShippingCodeTakenError) return error.message;
  if (error instanceof ShippingMethodNotFoundError) return 'That method no longer exists.';
  return null;
}

export const saveShippingMethodAction = adminAction(
  {
    permission: 'shipping:write',
    schema: shippingMethodInputSchema,
    translate,
    genericError: 'Could not save the shipping method.',
  },
  async (input) => {
    const id = await saveShippingMethod(input);
    revalidateShipping();
    return { id };
  },
);

export const archiveShippingMethodAction = adminAction(
  {
    permission: 'shipping:write',
    schema: z.object({ id: z.string().min(1), archived: z.boolean() }),
    translate,
    genericError: 'Could not archive the shipping method.',
  },
  async (input) => {
    await archiveShippingMethod(input.id, input.archived);
    revalidateShipping();
    return undefined;
  },
);
