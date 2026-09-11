import { describe, expect, it } from 'vitest';
import { buildFilterQuery, toggleValue } from '@/lib/shop/filters';

const empty = {
  sizes: [],
  colors: [],
  sort: 'newest' as const,
  q: '',
  minPrice: null,
  maxPrice: null,
  gender: null,
};

describe('toggleValue', () => {
  it('adds a value that is absent', () => {
    expect(toggleValue([], 'm')).toEqual(['m']);
  });

  it('removes a value that is present', () => {
    expect(toggleValue(['s', 'm'], 'm')).toEqual(['s']);
  });
});

describe('buildFilterQuery', () => {
  it('returns an empty string when nothing is selected', () => {
    expect(buildFilterQuery(empty, {})).toBe('');
  });

  it('serialises sizes as a comma-separated list', () => {
    expect(buildFilterQuery({ ...empty, sizes: ['s', 'm'] }, {})).toBe('size=s%2Cm');
  });

  it('omits the default sort', () => {
    expect(buildFilterQuery({ ...empty, sort: 'newest' }, {})).toBe('');
  });

  it('includes a non-default sort', () => {
    expect(buildFilterQuery({ ...empty, sort: 'price-asc' }, {})).toBe('sort=price-asc');
  });

  it('applies a change over the current state', () => {
    expect(buildFilterQuery(empty, { sizes: ['l'] })).toBe('size=l');
  });

  it('combines every dimension', () => {
    const q = buildFilterQuery({ ...empty, sizes: ['m'], colors: ['sand'], sort: 'price-desc' }, {});
    expect(q).toBe('size=m&color=sand&sort=price-desc');
  });
});

describe('buildFilterQuery with a search term', () => {
  it('keeps the query when a filter changes, so searching then filtering works', () => {
    expect(buildFilterQuery({ ...empty, q: 'charcoal' }, { sizes: ['l'] })).toBe(
      'q=charcoal&size=l',
    );
  });

  it('drops an empty query', () => {
    expect(buildFilterQuery({ ...empty, q: '' }, {})).toBe('');
  });
});

describe('buildFilterQuery with price bounds', () => {
  it('serialises both bounds', () => {
    expect(buildFilterQuery({ ...empty, minPrice: 40, maxPrice: 60 }, {})).toBe('min=40&max=60');
  });

  it('serialises a lone lower bound', () => {
    expect(buildFilterQuery({ ...empty, minPrice: 50 }, {})).toBe('min=50');
  });

  // Zero is a real bound. Treating it as "unset" would make "under $0" and
  // "no minimum" the same URL.
  it('keeps a zero bound', () => {
    expect(buildFilterQuery({ ...empty, minPrice: 0 }, {})).toBe('min=0');
  });

  it('drops a cleared bound', () => {
    expect(buildFilterQuery({ ...empty, minPrice: 40 }, { minPrice: null })).toBe('');
  });
});
