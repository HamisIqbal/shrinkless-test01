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
