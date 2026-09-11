import { connectToDatabase } from '@/lib/db/connection';
import { Settings } from '@/lib/db/models/settings';
import type { SettingsInput } from '@/lib/validation/settings';
import type { SettingsDTO } from '@/types/dto';

const DEFAULT_STORE_EMAIL = 'orders@shrinkless.com';

export async function getStoreSettings(): Promise<SettingsDTO> {
  await connectToDatabase();

  const settings = await Settings.findOneAndUpdate(
    { key: 'store' },
    { $setOnInsert: { key: 'store', storeEmail: DEFAULT_STORE_EMAIL } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean();

  // `upsert: true` with `returnDocument: 'after'` always returns a document, but the
  // Mongoose types cannot express that, so narrow it explicitly.
  if (!settings) throw new Error('Failed to load store settings');

  return {
    storeEmail: settings.storeEmail,
    announcement: settings.announcement,
    shippingZones: settings.shippingZones.map((zone) => ({
      name: zone.name,
      states: zone.states,
      rateCents: zone.rateCents,
    })),
    freeShippingThresholdCents: settings.freeShippingThresholdCents ?? null,
    lowStockThreshold: settings.lowStockThreshold ?? 3,
    taxMode: settings.taxMode as 'none' | 'flat' | 'stripe',
    flatTaxRateBasisPoints: settings.flatTaxRateBasisPoints,
  };
}

export async function updateStoreSettings(input: Omit<SettingsInput, 'lowStockThreshold'> & { lowStockThreshold?: number }): Promise<SettingsDTO> {
  await connectToDatabase();

  await Settings.findOneAndUpdate(
    { key: 'store' },
    {
      $set: {
        storeEmail: input.storeEmail,
        announcement: input.announcement,
        shippingZones: input.shippingZones,
        freeShippingThresholdCents: input.freeShippingThresholdCents,
        lowStockThreshold: input.lowStockThreshold ?? 3,
        taxMode: input.taxMode,
        flatTaxRateBasisPoints: input.flatTaxRateBasisPoints,
      },
      $setOnInsert: { key: 'store' },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );

  return getStoreSettings();
}
