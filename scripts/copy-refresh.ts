import { PRODUCT_COPY } from './product-copy';
import { connectToDatabase, disconnectFromDatabase } from '@/lib/db/connection';
import { Product } from '@/lib/db/models/product';

/**
 * Writes the long-form copy onto an already-seeded catalogue.
 *
 * `seed:shrinkless` sets it too, but it starts by deleting every product and
 * variant in the database — right for a fresh environment, wrong for one with
 * carts and orders in it. This touches one field on six documents, so it is
 * safe against a live store and running it twice does what running it once
 * does.
 *
 *   npm run copy:refresh
 */
async function main() {
  await connectToDatabase();

  let written = 0;
  let missing = 0;

  for (const [slug, description] of Object.entries(PRODUCT_COPY)) {
    const result = await Product.updateOne({ slug }, { $set: { description } });

    if (result.matchedCount === 0) {
      console.warn(`  ${slug.padEnd(24)} not in this database`);
      missing += 1;
      continue;
    }

    console.log(`  ${slug.padEnd(24)} ${description.length} chars`);
    written += 1;
  }

  console.log(`\nrefreshed ${written} products${missing ? `, ${missing} missing` : ''}`);

  await disconnectFromDatabase();
}

main().catch(async (error) => {
  console.error(error);
  await disconnectFromDatabase();
  process.exit(1);
});
