'use server';

import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe';
import { unsubscribe } from '@/lib/services/subscribers';

export type UnsubscribeState = { status: 'idle' | 'done' | 'error'; message: string };

/** The confirm button on /unsubscribe. The signed token is the whole check:
 *  it proves the link came from a mail this store sent to that address. */
export async function unsubscribeAction(
  _previous: UnsubscribeState,
  formData: FormData,
): Promise<UnsubscribeState> {
  const email = String(formData.get('e') ?? '');
  const token = String(formData.get('t') ?? '');

  if (!verifyUnsubscribeToken(email, token)) {
    return {
      status: 'error',
      message: 'That link is not valid. Email us and we will take you off the list by hand.',
    };
  }

  try {
    await unsubscribe(email);
  } catch (error) {
    console.error('unsubscribe failed', error);
    return { status: 'error', message: 'Something went wrong. Please try again.' };
  }

  return { status: 'done', message: 'You are unsubscribed. We will not send you marketing email again.' };
}
