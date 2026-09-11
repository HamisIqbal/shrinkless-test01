'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { adminAction } from '@/lib/admin/action';
import { CustomerNotFoundError, addCustomerNote } from '@/lib/services/users';

export const addCustomerNoteAction = adminAction(
  {
    permission: 'customers:write',
    schema: z.object({
      id: z.string().min(1),
      body: z.string().trim().min(1, 'Write something first').max(2000),
    }),
    translate: (error) =>
      error instanceof CustomerNotFoundError ? 'That customer no longer exists.' : null,
    genericError: 'Could not save the note.',
  },
  async (input, actor) => {
    await addCustomerNote({
      id: input.id,
      body: input.body,
      actor: { id: actor.id, email: actor.email },
    });

    revalidatePath(`/admin/customers/${input.id}`);
    return undefined;
  },
);
