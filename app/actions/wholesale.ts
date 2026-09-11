'use server';

import { headers } from 'next/headers';
import { sendMail } from '@/lib/email/send';
import { wholesaleEnquiryMail } from '@/lib/email/wholesale-enquiry';
import { LIMITS, consume } from '@/lib/security/rate-limit';
import { UnknownWholesaleStyleError, createWholesaleEnquiry } from '@/lib/services/wholesale';
import { getStoreSettings } from '@/lib/services/settings';
import { parseEnquiryLines, wholesaleEnquirySchema } from '@/lib/validation/wholesale';

/**
 * The trade quote request.
 *
 * An unauthenticated write, so it is throttled by source address exactly as
 * the newsletter and back-in-stock forms are. The limit is generous enough
 * that a buyer correcting a typo and resubmitting never meets it.
 */
export type WholesaleEnquiryState =
  | { status: 'idle' }
  | { status: 'ok'; message: string; reference: string }
  | { status: 'error'; message: string };

const THROTTLED = 'That is a lot of enquiries from one place. Try again shortly.';

async function withinLimit(): Promise<boolean> {
  const store = await headers();
  const address = (store.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown';

  const result = await consume(
    `wholesale:${address}`,
    LIMITS.publicWrite.limit,
    LIMITS.publicWrite.windowMs,
  );

  return result.allowed;
}

export async function submitWholesaleEnquiryAction(
  _previous: WholesaleEnquiryState,
  formData: FormData,
): Promise<WholesaleEnquiryState> {
  const parsed = wholesaleEnquirySchema.safeParse({
    company: formData.get('company'),
    contactName: formData.get('contactName'),
    email: formData.get('email'),
    phone: formData.get('phone') ?? undefined,
    country: formData.get('country'),
    message: formData.get('message') ?? undefined,
    lines: parseEnquiryLines(formData.getAll('line').map(String)),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Check the form and try again.',
    };
  }

  if (!(await withinLimit())) return { status: 'error', message: THROTTLED };

  let enquiry;

  try {
    enquiry = await createWholesaleEnquiry(parsed.data);
  } catch (error) {
    if (error instanceof UnknownWholesaleStyleError) {
      return {
        status: 'error',
        message: 'One of those styles is no longer on the line sheet. Reload and try again.',
      };
    }

    return { status: 'error', message: 'Could not send that just now. Try again shortly.' };
  }

  // The enquiry is already saved. Mail is how the store hears about it
  // quickly, not how it is recorded — so a missing RESEND_API_KEY or a
  // provider outage must not tell the buyer their request failed and invite
  // them to send it twice.
  try {
    const settings = await getStoreSettings();
    await sendMail(wholesaleEnquiryMail(settings.storeEmail, enquiry));
  } catch {
    // Swallowed deliberately. See above.
  }

  return {
    status: 'ok',
    message: 'Your request is in. We reply to trade enquiries within one business day.',
    // The last six of the enquiry id: enough for the store to find it, short
    // enough that a buyer can read it back over the phone.
    reference: enquiry.id.slice(-6).toUpperCase(),
  };
}
