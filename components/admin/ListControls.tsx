import Link from 'next/link';
import type { ListParams, Paged } from '@/lib/admin/query';

/**
 * Search, filter and sort, as a plain GET form.
 *
 * No client component and no state: the query string *is* the state, which
 * means every admin list is linkable, bookmarkable, back-button-safe, and
 * works with JavaScript off. The server reads the same parameters it wrote.
 */
export type FilterOption = { value: string; label: string };

export type FilterSpec = {
  name: string;
  label: string;
  options: FilterOption[];
};

type Props = {
  action: string;
  params: ListParams;
  searchPlaceholder?: string;
  filters?: FilterSpec[];
  sorts?: { value: string; label: string }[];
};

export function ListControls({
  action,
  params,
  searchPlaceholder = 'Search',
  filters = [],
  sorts = [],
}: Props) {
  return (
    <form method="get" action={action} className="toolbar">
      <label className="adfield toolbar__search">
        <span className="visually-hidden">Search</span>
        <input
          type="search"
          name="q"
          defaultValue={params.q}
          placeholder={searchPlaceholder}
        />
      </label>

      {filters.map((filter) => (
        <label key={filter.name} className="adfield">
          {filter.label}
          <select name={filter.name} defaultValue={params.filters[filter.name] ?? ''}>
            <option value="">All</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}

      {sorts.length ? (
        <label className="adfield">
          Sort
          <select name="sort" defaultValue={params.sort}>
            {sorts.map((sort) => (
              <option key={sort.value} value={sort.value}>
                {sort.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="adfield">
        Order
        <select name="direction" defaultValue={params.direction}>
          <option value="desc">Newest first</option>
          <option value="asc">Oldest first</option>
        </select>
      </label>

      {/* Any change of criteria returns to page one. Staying on page 9 of a
          list that now has two pages is how an admin concludes the search is
          broken. */}
      <input type="hidden" name="page" value="1" />

      <button type="submit" className="abtn">Apply</button>
      <Link href={action} className="toolbar__reset">Reset</Link>
    </form>
  );
}

/** Builds a query string that keeps the current criteria and changes the page. */
function hrefFor(action: string, params: ListParams, page: number): string {
  const query = new URLSearchParams();

  if (params.q) query.set('q', params.q);
  for (const [key, value] of Object.entries(params.filters)) query.set(key, value);
  query.set('sort', params.sort);
  query.set('direction', params.direction);
  if (params.perPage) query.set('perPage', String(params.perPage));
  query.set('page', String(page));

  return `${action}?${query.toString()}`;
}

export function Pagination<T>({ action, page }: { action: string; page: Paged<T> }) {
  const noun = page.total === 1 ? 'result' : 'results';

  if (page.pageCount <= 1) {
    return (
      <div className="pager">
        <p className="pager__count">
          {page.total} {noun}
        </p>
      </div>
    );
  }

  const previous = Math.max(1, page.page - 1);
  const next = Math.min(page.pageCount, page.page + 1);

  return (
    <nav className="pager" aria-label="Pagination">
      <p className="pager__count">
        {page.total} {noun} — page {page.page} of {page.pageCount}
      </p>

      <div className="pager__links">
        {page.page > 1 ? (
          <Link href={hrefFor(action, page.params, previous)} rel="prev" className="pager__link">
            Previous
          </Link>
        ) : (
          <span className="pager__link" aria-disabled="true">Previous</span>
        )}

        {page.page < page.pageCount ? (
          <Link href={hrefFor(action, page.params, next)} rel="next" className="pager__link">
            Next
          </Link>
        ) : (
          <span className="pager__link" aria-disabled="true">Next</span>
        )}
      </div>
    </nav>
  );
}
