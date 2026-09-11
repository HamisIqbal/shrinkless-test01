import { describe, expect, it } from 'vitest';
import { applyRowEdits, buildVariantMatrix, pruneEditedRows, skuFor } from '@/lib/admin/variant-matrix';
import type { MatrixRow } from '@/lib/admin/variant-matrix';
import type { VariantDTO } from '@/types/dto';

function variant(overrides: Partial<VariantDTO>): VariantDTO {
  return {
    id: 'v1', size: 's', color: 'sand', sku: 'FIELD-TEE-S-SAND',
    priceCents: 4200, stock: 5, inStock: true, enabled: true,
    lowStockThreshold: null, imagePublicId: '',
    ...overrides,
  };
}

describe('skuFor', () => {
  it('derives an uppercase dash-joined sku', () => {
    expect(skuFor('field-tee', 's', 'sand')).toBe('FIELD-TEE-S-SAND');
  });

  it('normalises spaces and case in the option values', () => {
    expect(skuFor('Field Tee', 'XL', 'Off White')).toBe('FIELD-TEE-XL-OFF-WHITE');
  });
});

describe('buildVariantMatrix', () => {
  const base = { slug: 'field-tee', existing: [], defaultPriceCents: 4200 };

  it('generates the full cross product in option order', () => {
    const rows = buildVariantMatrix({ ...base, sizes: ['s', 'm'], colors: ['sand', 'black'] });

    expect(rows.map((row) => row.key)).toEqual(['s:sand', 's:black', 'm:sand', 'm:black']);
  });

  it('gives new rows the default price, zero stock, and enabled true', () => {
    const [row] = buildVariantMatrix({ ...base, sizes: ['s'], colors: ['sand'] });

    expect(row).toMatchObject({
      sku: 'FIELD-TEE-S-SAND', priceCents: 4200, stock: 0,
      enabled: true, variantId: null, orphan: false,
    });
  });

  it('preserves stock, price, sku and enabled on an existing combination', () => {
    const rows = buildVariantMatrix({
      ...base,
      sizes: ['s', 'm'],
      colors: ['sand'],
      existing: [variant({ id: 'abc', sku: 'LEGACY-1', priceCents: 3900, stock: 12, enabled: false })],
    });

    expect(rows[0]).toMatchObject({
      key: 's:sand', variantId: 'abc', sku: 'LEGACY-1',
      priceCents: 3900, stock: 12, enabled: false,
    });
    expect(rows[1]).toMatchObject({ key: 'm:sand', variantId: null, stock: 0 });
  });

  it('appends a colour without disturbing existing rows', () => {
    const rows = buildVariantMatrix({
      ...base,
      sizes: ['s'],
      colors: ['sand', 'black'],
      existing: [variant({ id: 'abc', stock: 12 })],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0].stock).toBe(12);
    expect(rows[1]).toMatchObject({ key: 's:black', stock: 0, variantId: null });
  });

  it('keeps a removed combination as a disabled orphan rather than deleting it', () => {
    const rows = buildVariantMatrix({
      ...base,
      sizes: ['m'],
      colors: ['sand'],
      existing: [variant({ id: 'abc', size: 's', color: 'sand', stock: 12 })],
    });

    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      key: 's:sand', variantId: 'abc', orphan: true, enabled: false, stock: 12,
    });
  });

  it('matches existing variants case-insensitively', () => {
    const rows = buildVariantMatrix({
      ...base,
      sizes: ['S'],
      colors: ['Sand'],
      existing: [variant({ id: 'abc', size: 's', color: 'sand' })],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].variantId).toBe('abc');
  });

  it('returns nothing when either option set is empty', () => {
    expect(buildVariantMatrix({ ...base, sizes: [], colors: ['sand'] })).toEqual([]);
    expect(buildVariantMatrix({ ...base, sizes: ['s'], colors: [] })).toEqual([]);
  });
});

describe('applyRowEdits', () => {
  const base = { slug: 'field-tee', existing: [], defaultPriceCents: 4200 };

  it('edits one row without pinning its siblings', () => {
    const generated = buildVariantMatrix({ ...base, sizes: ['s'], colors: ['sand', 'black'] });
    const edited: Record<string, MatrixRow> = {
      's:sand': { ...generated[0], stock: 9 },
    };

    const rows = applyRowEdits(generated, edited);

    expect(rows[0]).toMatchObject({ key: 's:sand', stock: 9 });
    // The sibling row was never edited, so it must come straight from the
    // freshly generated matrix, not a copy pinned by editing another row.
    expect(rows[1]).toEqual(generated[1]);
  });

  it('keeps an edited row alive across regeneration while its key still exists', () => {
    const generated = buildVariantMatrix({ ...base, sizes: ['s', 'm'], colors: ['sand'] });
    const edited: Record<string, MatrixRow> = {
      's:sand': { ...generated[0], stock: 9 },
    };

    // Regenerate again (e.g. after an unrelated re-render) with the same option sets.
    const regenerated = buildVariantMatrix({ ...base, sizes: ['s', 'm'], colors: ['sand'] });
    const rows = applyRowEdits(regenerated, edited);

    expect(rows[0]).toMatchObject({ key: 's:sand', stock: 9 });
  });
});

describe('pruneEditedRows', () => {
  const base = { slug: 'field-tee', existing: [], defaultPriceCents: 4200 };

  it('drops an edit whose key left the generated set', () => {
    const withBlack = buildVariantMatrix({ ...base, sizes: ['s'], colors: ['sand', 'black'] });
    const edited: Record<string, MatrixRow> = {
      's:sand': { ...withBlack[0], stock: 9 },
      's:black': { ...withBlack[1], stock: 3 },
    };

    // Colour removed: matrix no longer generates 's:black'.
    const withoutBlack = buildVariantMatrix({ ...base, sizes: ['s'], colors: ['sand'] });
    const pruned = pruneEditedRows(edited, withoutBlack);

    expect(pruned).toEqual({ 's:sand': edited['s:sand'] });
  });

  it('yields a clean regenerated row once a dropped combination is re-added', () => {
    const withBlack = buildVariantMatrix({ ...base, sizes: ['s'], colors: ['sand', 'black'] });
    const edited: Record<string, MatrixRow> = {
      's:sand': { ...withBlack[0], stock: 9 },
      's:black': { ...withBlack[1], stock: 3 },
    };

    const withoutBlack = buildVariantMatrix({ ...base, sizes: ['s'], colors: ['sand'] });
    const prunedAfterRemoval = pruneEditedRows(edited, withoutBlack);

    // Colour re-added: 's:black' regenerates fresh (stock 0), and since the
    // prune already dropped the stale edit, applyRowEdits must use the fresh row.
    const reAdded = buildVariantMatrix({ ...base, sizes: ['s'], colors: ['sand', 'black'] });
    const rows = applyRowEdits(reAdded, prunedAfterRemoval);

    expect(rows[0]).toMatchObject({ key: 's:sand', stock: 9 });
    expect(rows[1]).toMatchObject({ key: 's:black', stock: 0 });
  });

  it('returns the same object when nothing needs dropping', () => {
    const generated = buildVariantMatrix({ ...base, sizes: ['s'], colors: ['sand'] });
    const edited: Record<string, MatrixRow> = { 's:sand': { ...generated[0], stock: 9 } };

    expect(pruneEditedRows(edited, generated)).toBe(edited);
  });
});
