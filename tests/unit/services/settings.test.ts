import { describe, expect, it } from 'vitest';
import { withTestDatabase } from '@/tests/setup/db';
import { Settings } from '@/lib/db/models/settings';
import { getStoreSettings } from '@/lib/services/settings';

withTestDatabase();

describe('getStoreSettings', () => {
  it('creates a default document when none exists', async () => {
    const settings = await getStoreSettings();

    expect(settings.taxMode).toBe('none');
    expect(settings.shippingZones).toEqual([]);
    expect(await Settings.countDocuments()).toBe(1);
  });

  it('does not create a second document on a repeat call', async () => {
    await getStoreSettings();
    await getStoreSettings();

    expect(await Settings.countDocuments()).toBe(1);
  });

  it('returns the stored values once configured', async () => {
    await Settings.create({
      key: 'store', storeEmail: 'hi@shrinkless.com', taxMode: 'flat',
      flatTaxRateBasisPoints: 825, freeShippingThresholdCents: 10000,
      shippingZones: [{ name: 'Domestic', states: [], rateCents: 500 }],
    });

    const settings = await getStoreSettings();
    expect(settings.flatTaxRateBasisPoints).toBe(825);
    expect(settings.shippingZones[0].rateCents).toBe(500);
  });
});
