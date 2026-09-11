'use server';

import { revalidatePath } from 'next/cache';
import { adminAction } from '@/lib/admin/action';
import { updateStoreSettings } from '@/lib/services/settings';
import { settingsInputSchema } from '@/lib/validation/settings';

export const saveSettingsAction = adminAction(
  {
    permission: 'settings:write',
    schema: settingsInputSchema,
    genericError: 'Could not save the settings.',
  },
  async (input) => {
    await updateStoreSettings(input);

    revalidatePath('/admin/settings');
    // Settings reach the storefront through the layout: the announcement bar,
    // the store email in the footer, shipping and tax at checkout.
    revalidatePath('/', 'layout');

    return undefined;
  },
);
