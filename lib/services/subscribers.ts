import { connectToDatabase } from '@/lib/db/connection';
import { Subscriber } from '@/lib/db/models/subscriber';

/**
 * The footer sign-up actually stores the address. A newsletter field that
 * quietly discards what people type is worse than no field at all.
 *
 * Signing up is marketing consent, recorded with its time. Signing up again
 * after unsubscribing is fresh consent and lifts the unsubscribe.
 */
export async function subscribe(email: string, source = 'footer'): Promise<void> {
  await connectToDatabase();

  // Signing up twice is not an error the visitor should ever see.
  await Subscriber.updateOne(
    { email },
    {
      $setOnInsert: { email, source },
      $set: { marketing: true, consentAt: new Date(), unsubscribedAt: null },
    },
    { upsert: true },
  );
}

/**
 * A sold-out product has nothing to sell, so it asks for an address instead.
 * `$addToSet` rather than `$set`: asking twice about the same tee is not two
 * requests, and asking about a second tee must not overwrite the first.
 *
 * Not marketing consent: the address was given for this tee and nothing else.
 */
export async function notifyWhenBackInStock(
  email: string,
  slug: string,
  color: string,
): Promise<void> {
  await connectToDatabase();

  await Subscriber.updateOne(
    { email },
    {
      $setOnInsert: { email, source: 'restock' },
      $addToSet: { interests: `restock:${slug}:${color}` },
      $set: { unsubscribedAt: null },
    },
    { upsert: true },
  );
}

/**
 * Stops every mail to this address: news, and any restock alerts it asked for.
 * Idempotent, and silent about whether the address was ever on the list.
 */
export async function unsubscribe(email: string): Promise<void> {
  await connectToDatabase();

  await Subscriber.updateOne(
    { email: email.trim().toLowerCase() },
    { $set: { marketing: false, interests: [], unsubscribedAt: new Date() } },
  );
}

/** Addresses that may be sent news. Anything that mails the list reads this,
 *  never the collection directly. */
export async function listMarketingEmails(): Promise<string[]> {
  await connectToDatabase();

  const rows = await Subscriber.find({ marketing: true, unsubscribedAt: null })
    .select('email')
    .lean();

  return rows.map((row) => row.email);
}

export async function countSubscribers(): Promise<number> {
  await connectToDatabase();
  return Subscriber.countDocuments({ marketing: true, unsubscribedAt: null });
}
