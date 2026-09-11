'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { adminAction } from '@/lib/admin/action';
import { InsufficientStockError } from '@/lib/services/inventory';
import {
  InvalidTransitionError,
  OrderNotFoundError,
  RefundError,
  addOrderNote,
  recordRefund,
  transitionOrder,
} from '@/lib/services/orders';

function revalidateOrder(id: string): void {
  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath('/admin');
  revalidatePath('/account');
}

function translate(error: unknown): string | null {
  if (error instanceof InvalidTransitionError) return error.message;
  if (error instanceof InsufficientStockError) {
    return `${error.message}. Adjust the stock, then mark it paid.`;
  }
  if (error instanceof RefundError) return error.message;
  if (error instanceof OrderNotFoundError) return 'That order no longer exists.';
  return null;
}

export type TransitionResult = Awaited<ReturnType<typeof transitionOrderAction>>;

/**
 * The one way an order changes status.
 *
 * The target statuses are enumerated here as well as in the service, so a
 * malformed payload is rejected before any lookup happens — but the *legality*
 * of a particular move is still the service's decision, because only it knows
 * where the order currently stands.
 */
export const transitionOrderAction = adminAction(
  {
    permission: 'orders:write',
    schema: z.object({
      id: z.string().min(1),
      to: z.enum(['paid', 'shipped', 'delivered', 'cancelled', 'payment_failed']),
      trackingNumber: z.string().trim().max(80).default(''),
      note: z.string().trim().max(500).default(''),
    }),
    translate,
    genericError: 'Could not update the order.',
  },
  async (input, actor) => {
    await transitionOrder({
      id: input.id,
      to: input.to,
      actor: actor.email,
      actorId: actor.id,
      note: input.note,
      trackingNumber: input.trackingNumber || undefined,
    });

    revalidateOrder(input.id);
    return undefined;
  },
);

export const addOrderNoteAction = adminAction(
  {
    permission: 'orders:write',
    schema: z.object({
      id: z.string().min(1),
      body: z.string().trim().min(1, 'Write something first').max(2000),
    }),
    translate,
    genericError: 'Could not save the note.',
  },
  async (input, actor) => {
    await addOrderNote({
      id: input.id,
      body: input.body,
      actor: { id: actor.id, email: actor.email },
    });

    revalidateOrder(input.id);
    return undefined;
  },
);

/**
 * Records a refund. Moves no money — see `recordRefund`.
 *
 * Amount arrives in cents so no float ever reaches the calculation, and the
 * service caps it at what the order is actually worth.
 */
export const refundOrderAction = adminAction(
  {
    permission: 'orders:write',
    schema: z.object({
      id: z.string().min(1),
      amountCents: z.number().int().positive('A refund has to be more than nothing'),
      note: z.string().trim().max(500).default(''),
    }),
    translate,
    genericError: 'Could not record the refund.',
  },
  async (input, actor) => {
    await recordRefund({
      id: input.id,
      amountCents: input.amountCents,
      actor: { id: actor.id, email: actor.email },
      note: input.note,
    });

    revalidateOrder(input.id);
    return undefined;
  },
);
