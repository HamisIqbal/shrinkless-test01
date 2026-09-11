import type { VariantDTO } from '@/types/dto';

export type MatrixRow = {
  key: string;
  size: string;
  color: string;
  sku: string;
  priceCents: number;
  stock: number;
  enabled: boolean;
  /** null for a combination that has never been saved. */
  variantId: string | null;
  /** True when the variant exists but its combination left the option sets. */
  orphan: boolean;
};

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

function slugify(value: string): string {
  return normalise(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function skuFor(slug: string, size: string, color: string): string {
  return [slug, size, color].map(slugify).filter(Boolean).join('-').toUpperCase();
}

function keyFor(size: string, color: string): string {
  return `${normalise(size)}:${normalise(color)}`;
}

export function buildVariantMatrix(input: {
  slug: string;
  sizes: string[];
  colors: string[];
  existing: VariantDTO[];
  defaultPriceCents: number;
}): MatrixRow[] {
  const { slug, sizes, colors, existing, defaultPriceCents } = input;

  const byKey = new Map(existing.map((variant) => [keyFor(variant.size, variant.color), variant]));
  const rows: MatrixRow[] = [];
  const claimed = new Set<string>();

  for (const size of sizes) {
    for (const color of colors) {
      const key = keyFor(size, color);
      claimed.add(key);
      const match = byKey.get(key);

      rows.push({
        key,
        size: normalise(size),
        color: normalise(color),
        sku: match?.sku ?? skuFor(slug, size, color),
        priceCents: match?.priceCents ?? defaultPriceCents,
        stock: match?.stock ?? 0,
        enabled: match ? match.enabled : true,
        variantId: match?.id ?? null,
        orphan: false,
      });
    }
  }

  // Combinations that left the option sets survive as disabled rows: carts hold
  // their ids and past orders were priced from them.
  for (const variant of existing) {
    const key = keyFor(variant.size, variant.color);
    if (claimed.has(key)) continue;

    rows.push({
      key,
      size: normalise(variant.size),
      color: normalise(variant.color),
      sku: variant.sku,
      priceCents: variant.priceCents,
      stock: variant.stock,
      enabled: false,
      variantId: variant.id,
      orphan: true,
    });
  }

  return rows;
}

/**
 * Layers per-row edits back onto a freshly generated matrix, by key. A row
 * with no edit passes through untouched; an edited row is used verbatim.
 */
export function applyRowEdits(
  generated: MatrixRow[],
  edited: Record<string, MatrixRow>,
): MatrixRow[] {
  return generated.map((row) => edited[row.key] ?? row);
}

/**
 * Drops edits whose key is no longer in the generated set, so a combination
 * that is removed and later re-added regenerates a clean row instead of
 * reviving stale sku/price/stock from before it left the option sets.
 * Returns the same object when nothing needs dropping.
 */
export function pruneEditedRows(
  edited: Record<string, MatrixRow>,
  generated: MatrixRow[],
): Record<string, MatrixRow> {
  const liveKeys = new Set(generated.map((row) => row.key));
  const entries = Object.entries(edited).filter(([key]) => liveKeys.has(key));

  if (entries.length === Object.keys(edited).length) return edited;
  return Object.fromEntries(entries);
}
