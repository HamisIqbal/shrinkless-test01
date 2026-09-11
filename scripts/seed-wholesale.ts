import { disconnectFromDatabase } from '@/lib/db/connection';
import { WHOLESALE_COLORS, WHOLESALE_SIZES } from '@/lib/wholesale/catalogue';
import { seedWholesale } from '@/lib/wholesale/seed';

/**
 * Puts the ten wholesale styles into the catalogue.
 *
 * The work is in `lib/wholesale/seed.ts` and is covered by
 * `tests/unit/wholesale/seed.test.ts`; this file is the command line around
 * it. That split is deliberate. The first version of this seed lived entirely
 * in a script, was written against a catalogue that only exists in
 * `scripts/seed-shrinkless.ts`, and nothing caught it — a script's assumptions
 * about the data are only checked the day someone runs it.
 *
 * Unlike `seed:shrinkless`, this deletes nothing and rewrites nothing. A style
 * that already exists is left exactly as it is, including its category and its
 * images: the genders are a placeholder split the store owner is expected to
 * correct in the product editor, and photography is added there too.
 *
 *   npm run seed:wholesale
 *
 * To seed a database other than the one in .env.local — a production Atlas
 * cluster, say — pass it on the command line:
 *
 *   MONGODB_URI="mongodb://..." npm run seed:wholesale
 */
async function main() {
  const report = await seedWholesale();

  console.log(
    `\ncopy and price from ${report.sourceSlug} — ` +
      `$${(report.priceCents / 100).toFixed(2)} retail basis\n`,
  );

  for (const slug of report.skipped) {
    console.log(`  skip    ${slug.padEnd(28)} already in the catalogue`);
  }

  for (const slug of report.created) {
    console.log(
      `  create  ${slug.padEnd(28)} ` +
        `${WHOLESALE_COLORS.length}x${WHOLESALE_SIZES.length} variants, no images`,
    );
  }

  console.log(
    `\n${report.created.length} wholesale styles created ` +
      `(${report.variantCount} variants), ${report.skipped.length} left alone`,
  );

  if (report.created.length) {
    console.log('Add photography to each style in the admin product editor.\n');
  }

  await disconnectFromDatabase();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await disconnectFromDatabase().catch(() => {});
  process.exit(1);
});
