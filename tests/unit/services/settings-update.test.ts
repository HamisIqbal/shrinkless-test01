import { describe, expect, it } from 'vitest';
import { getStoreSettings, updateStoreSettings } from '@/lib/services/settings';
import { settingsInputSchema } from '@/lib/validation/settings';
import { withTestDatabase } from '@/tests/setup/db';

withTestDatabase();

const input = {
  storeEmail: 'orders@shrinkless.com',
  announcement: 'Free shipping over $75',
  shippingZones: [{ name: 'Domestic', states: ['TX', 'CA'], rateCents: 500 }],
  freeShippingThresholdCents: 7500,
  taxMode: 'flat' as const,
  flatTaxRateBasisPoints: 825,
};

describe('updateStoreSettings', () => {
  it('creates the singleton when none exists', async () => {
    const saved = await updateStoreSettings(input);

    expect(saved.announcement).toBe('Free shipping over $75');
    expect(saved.shippingZones[0]).toMatchObject({ name: 'Domestic', rateCents: 500 });
  });

  it('updates in place rather than creating a second document', async () => {
    await updateStoreSettings(input);
    await updateStoreSettings({ ...input, announcement: 'Changed' });

    const settings = await getStoreSettings();
    expect(settings.announcement).toBe('Changed');
  });

  it('can clear the free shipping threshold', async () => {
    await updateStoreSettings(input);
    const saved = await updateStoreSettings({ ...input, freeShippingThresholdCents: null });

    expect(saved.freeShippingThresholdCents).toBeNull();
  });
});

describe('settingsInputSchema', () => {
  it('rejects a non-integer rate, because money is integer cents', () => {
    const result = settingsInputSchema.safeParse({
      ...input,
      shippingZones: [{ name: 'Domestic', states: ['TX'], rateCents: 5.5 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(settingsInputSchema.safeParse({ ...input, storeEmail: 'nope' }).success).toBe(false);
  });

  it('uppercases state codes', () => {
    const parsed = settingsInputSchema.parse({
      ...input,
      shippingZones: [{ name: 'Domestic', states: ['tx'], rateCents: 500 }],
    });
    expect(parsed.shippingZones[0].states).toEqual(['TX']);
  });
});
