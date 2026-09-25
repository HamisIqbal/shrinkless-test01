import { formatCents } from '@/lib/money';
import type { ProductFilter, ProductSort } from '@/lib/validation/catalogue';

export type FilterChange = {
  sizes: string[];
  colors: string[];
  sort: ProductSort;
  q: string;
  minPrice: number | null;
  maxPrice: number | null;
  gender: 'men' | 'women' | null;
};

export function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function buildFilterQuery(
  current: ProductFilter,
  change: Partial<FilterChange>,
): string {
  const next = { ...current, ...change };
  const params = new URLSearchParams();

  if (next.q) params.set('q', next.q);
  if (next.sizes.length) params.set('size', next.sizes.join(','));
  if (next.colors.length) params.set('color', next.colors.join(','));
  if (next.sort !== 'newest') params.set('sort', next.sort);
  if (next.minPrice !== null && next.minPrice !== undefined) {
    params.set('min', String(next.minPrice));
  }
  if (next.maxPrice !== null && next.maxPrice !== undefined) {
    params.set('max', String(next.maxPrice));
  }
  if (next.gender) params.set('gender', next.gender);

  return params.toString();
}

/** One filter that is narrowing the grid: what to call it, and the change
 *  that takes it off again. */
export type AppliedFilter = { key: string; label: string; clear: Partial<FilterChange> };

const GENDER_LABELS = { men: 'Men', women: 'Women' } as const;

/**
 * Everything currently narrowing the grid, in the order the filter drawer asks
 * for it. The results bar draws its chips from this and the drawer counts it,
 * so the two can never disagree about what is on. Sort is not here: it orders
 * the result rather than narrowing it.
 */
export function appliedFilters(filter: ProductFilter): AppliedFilter[] {
  return [
    ...(filter.q ? [{ key: 'q', label: `“${filter.q}”`, clear: { q: '' } }] : []),
    ...(filter.gender
      ? [{ key: 'gender', label: GENDER_LABELS[filter.gender], clear: { gender: null } }]
      : []),
    ...filter.sizes.map((size) => ({
      key: `size-${size}`,
      label: size.toUpperCase(),
      clear: { sizes: filter.sizes.filter((value) => value !== size) },
    })),
    ...filter.colors.map((color) => ({
      key: `color-${color}`,
      label: color,
      clear: { colors: filter.colors.filter((value) => value !== color) },
    })),
    ...(filter.minPrice !== null
      ? [{ key: 'min', label: `From ${formatCents(filter.minPrice * 100)}`, clear: { minPrice: null } }]
      : []),
    ...(filter.maxPrice !== null
      ? [{ key: 'max', label: `Up to ${formatCents(filter.maxPrice * 100)}`, clear: { maxPrice: null } }]
      : []),
  ];
}

/** The change that takes every filter off, leaving the sort as it was. */
export const CLEAR_FILTERS: Partial<FilterChange> = {
  q: '',
  gender: null,
  sizes: [],
  colors: [],
  minPrice: null,
  maxPrice: null,
};
