import { describe, expect, it } from 'vitest';
import {
  PER_PAGE_MAX,
  escapeRegex,
  pageCountFor,
  pageWindow,
  parseListParams,
  searchRegex,
  sortStage,
} from '@/lib/admin/query';

const OPTIONS = { sorts: ['createdAt', 'title'] as const, filters: ['status'] as const };

describe('parseListParams', () => {
  it('falls back to the first sort and the default direction', () => {
    const params = parseListParams({}, OPTIONS);

    expect(params).toMatchObject({ sort: 'createdAt', direction: 'desc', page: 1, q: '' });
  });

  it('refuses a sort key the list did not offer', () => {
    // Otherwise the query string chooses which field the database sorts by,
    // which is an injection point dressed up as a convenience.
    expect(parseListParams({ sort: 'passwordHash' }, OPTIONS).sort).toBe('createdAt');
  });

  it('keeps only the filters the list declared', () => {
    const params = parseListParams({ status: 'draft', role: 'admin' }, OPTIONS);

    expect(params.filters).toEqual({ status: 'draft' });
  });

  it('degrades nonsense to the default rather than throwing', () => {
    const params = parseListParams(
      { page: 'banana', perPage: '-4', direction: 'sideways' },
      OPTIONS,
    );

    expect(params.page).toBe(1);
    expect(params.perPage).toBeGreaterThan(0);
    expect(params.direction).toBe('desc');
  });

  it('caps perPage, so one request cannot ask for everything', () => {
    expect(parseListParams({ perPage: '100000' }, OPTIONS).perPage).toBeLessThanOrEqual(
      PER_PAGE_MAX,
    );
  });

  it('takes the first value when a key repeats', () => {
    expect(parseListParams({ q: ['first', 'second'] }, OPTIONS).q).toBe('first');
  });
});

describe('pageWindow', () => {
  it('skips whole pages', () => {
    const params = parseListParams({ page: '3', perPage: '20' }, OPTIONS);

    expect(pageWindow(params)).toEqual({ skip: 40, limit: 20 });
  });
});

describe('pageCountFor', () => {
  it('is one page for an empty list, and rounds up otherwise', () => {
    expect(pageCountFor(0, 25)).toBe(1);
    expect(pageCountFor(26, 25)).toBe(2);
    expect(pageCountFor(50, 25)).toBe(2);
  });
});

describe('searchRegex', () => {
  it('is null for an empty term', () => {
    expect(searchRegex('   ')).toBeNull();
  });

  it('escapes what a user typed, so a stray bracket is not a crash', () => {
    expect(escapeRegex('a(b)c')).toBe('a\\(b\\)c');
    expect(() => searchRegex('a(b')).not.toThrow();
    expect(searchRegex('a(b')?.test('xa(by')).toBe(true);
  });

  it('caps the length of a term', () => {
    expect(searchRegex('x'.repeat(500))?.source.length).toBeLessThanOrEqual(100);
  });
});

describe('sortStage', () => {
  it('maps a direction to a Mongo sort value', () => {
    expect(sortStage('createdAt', 'asc')).toEqual({ createdAt: 1 });
    expect(sortStage('createdAt', 'desc')).toEqual({ createdAt: -1 });
  });
});
