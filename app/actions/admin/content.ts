'use server';

import { revalidatePath } from 'next/cache';
import { adminAction } from '@/lib/admin/action';
import {
  resetContentField,
  saveContentField,
  saveContentFields,
} from '@/lib/services/site-content';
import {
  contentFieldInputSchema,
  contentKeySchema,
  contentPageInputSchema,
} from '@/lib/validation/content';

/**
 * Copy reaches the storefront through pages rather than through the layout,
 * and one field can be set on any of them — so every route is swept rather
 * than a list that would rot the next time a field moves.
 */
function revalidateStorefront(): void {
  revalidatePath('/admin/content');
  revalidatePath('/', 'layout');
}

export const saveContentFieldAction = adminAction(
  {
    permission: 'content:write',
    schema: contentFieldInputSchema,
    genericError: 'Could not save that wording.',
  },
  async ({ key, value }) => {
    await saveContentField(key, value);
    revalidateStorefront();

    return undefined;
  },
);

export const resetContentFieldAction = adminAction(
  {
    permission: 'content:write',
    schema: contentKeySchema,
    genericError: 'Could not restore that wording.',
  },
  async ({ key }) => {
    await resetContentField(key);
    revalidateStorefront();

    return undefined;
  },
);

/**
 * Everything the admin changed on one page, in one write.
 *
 * The visual editor keeps its changes in the browser until Save is pressed —
 * that is the whole bargain of it, that an admin can try a heading at four
 * sizes without the shop seeing any of them. So the save is a page at a time,
 * and a failed one leaves the storefront exactly as it was.
 */
export const saveContentPageAction = adminAction(
  {
    permission: 'content:write',
    schema: contentPageInputSchema,
    genericError: 'Could not save those changes.',
  },
  async ({ entries }) => {
    await saveContentFields(entries);
    revalidateStorefront();

    return undefined;
  },
);
