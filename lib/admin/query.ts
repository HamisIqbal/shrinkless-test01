import { z } from 'zod';

/**
 * The shared shape of every admin list.
 *
 * Admin lists are the one place in this codebase where "just load them all
 * and filter in the component" is a trap that only springs in production: it
 * looks fine against a seeded catalogue and falls over at the first thousand
 * orders. Everything list-shaped goes through this — the query is built here,
 * the database does the work, and the page receives one page of rows.
 */

export const PER_PAGE_DEFAULT = 25;
export const PER_PAGE_MAX = 100;

export type SortDirection = 'asc' | 'desc';

export type ListParams = {
  /** Free text. Meaning is per-list; the service decides which fields it hits. */
  q: string;
  page: number;
  perPage: number;
  sort: string;
  direction: SortDirection;
  /** Everything else on the query string, already narrowed to strings. */
  filters: Record<string, string>;
};

export type Paged<T> = {
  rows: T[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
  /** Echoed back so a page can render its own controls without re-parsing. */
  params: ListParams;
};

/** Query-string values as Next hands them over. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

const pageSchema = z.coerce.number().int().min(1).catch(1);
const perPageSchema = z.coerce.number().int().min(1).max(PER_PAGE_MAX).catch(PER_PAGE_DEFAULT);

/**
 * Never throws. A hand-edited admin URL should degrade to the default list,
 * not to an error page — the same forgiveness the storefront's filters get.
 */
export function parseListParams(
  raw: RawSearchParams,
  options: {
    /** Sort keys this list understands. The first is the default. */
    sorts: readonly string[];
    /** Query-string keys this list treats as filters. */
    filters?: readonly string[];
    defaultDirection?: SortDirection;
    perPage?: number;
  },
): ListParams {
  const { sorts, filters = [], defaultDirection = 'desc' } = options;

  const sortRaw = firstValue(raw.sort);
  const sort = sorts.includes(sortRaw) ? sortRaw : sorts[0];

  const directionRaw = firstValue(raw.direction);
  const direction: SortDirection =
    directionRaw === 'asc' || directionRaw === 'desc' ? directionRaw : defaultDirection;

  const chosen: Record<string, string> = {};
  for (const key of filters) {
    const value = firstValue(raw[key]).trim();
    if (value) chosen[key] = value;
  }

  return {
    q: firstValue(raw.q).trim(),
    page: pageSchema.parse(firstValue(raw.page) || 1),
    perPage: perPageSchema.parse(firstValue(raw.perPage) || options.perPage || PER_PAGE_DEFAULT),
    sort,
    direction,
    filters: chosen,
  };
}

/** `{ skip, limit }` for a Mongo query, clamped so page 9,000 of 3 is empty
 *  rather than expensive. */
export function pageWindow(params: ListParams): { skip: number; limit: number } {
  return { skip: (params.page - 1) * params.perPage, limit: params.perPage };
}

export function pageCountFor(total: number, perPage: number): number {
  return total === 0 ? 1 : Math.ceil(total / perPage);
}

export function toPaged<T>(rows: T[], total: number, params: ListParams): Paged<T> {
  return {
    rows,
    total,
    page: params.page,
    perPage: params.perPage,
    pageCount: pageCountFor(total, params.perPage),
    params,
  };
}

/**
 * Escapes a user's search term for use inside a RegExp.
 *
 * Mongo takes a regex object here, so this is not an injection hole in the SQL
 * sense — but an unescaped `(` is still a crash, and `.*.*.*` is still a way
 * to make the database work very hard for one request.
 */
export function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A case-insensitive "contains" match, or null when there is nothing to
 *  search for. Capped: an unbounded term is a denial-of-service knob. */
export function searchRegex(term: string): RegExp | null {
  const trimmed = term.trim().slice(0, 100);
  if (!trimmed) return null;
  return new RegExp(escapeRegex(trimmed), 'i');
}

/** `{ field: 1 | -1 }`, built only from a key the caller allow-listed. */
export function sortStage(
  field: string,
  direction: SortDirection,
): Record<string, 1 | -1> {
  return { [field]: direction === 'asc' ? 1 : -1 };
}
