import { connectToDatabase } from '@/lib/db/connection';
import { Subscriber } from '@/lib/db/models/subscriber';

/**
 * The footer sign-up actually stores the address. A newsletter field that
 * quietly discards what people type is worse than no field at all.
 */
export async function subscribe(email: string, source = 'footer'): Promise<void> {
  await connectToDatabase();

  // Signing up twice is not an error the visitor should ever see.
  await Subscriber.updateOne(
    { email },
    { $setOnInsert: { email, source } },
    { upsert: true },
  );
}

/**
 * A sold-out product has nothing to sell, so it asks for an address instead.
 * `$addToSet` rather than `$set`: asking twice about the same tee is not two
 * requests, and asking about a second tee must not overwrite the first.
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
    },
    { upsert: true },
  );
}

export async function countSubscribers(): Promise<number> {
  await connectToDatabase();
  return Subscriber.countDocuments({});
}
