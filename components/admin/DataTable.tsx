import type { ReactNode } from 'react';
import { EmptyState } from '@/components/admin/EmptyState';

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Right-aligns and sets tabular figures. For money and counts. */
  numeric?: boolean;
  /** Right-aligns without the figures treatment. For a row's controls. */
  actions?: boolean;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty: string;
  /** The second line of the empty state: what this list is for. */
  emptyBody?: string;
  emptyAction?: ReactNode;
};

/**
 * Generous rows, one hairline between them, no vertical rules and no zebra.
 * A table this quiet is scanned rather than read, which is what a list of
 * orders is for.
 *
 * The wrapper scrolls horizontally on its own so a wide table never pushes the
 * page sideways. On a phone it does not have to: each row stands as a card,
 * its first cell as the title and the rest as labelled lines under it, so
 * nothing is off the edge of the screen waiting to be scrolled to. The labels
 * are the column headers, carried on each cell.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  emptyBody,
  emptyAction,
}: Props<T>) {
  if (!rows.length) {
    return <EmptyState title={empty} body={emptyBody} action={emptyAction} />;
  }

  return (
    <div className="tablewrap">
      <table className="atable atable--cards">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={column.numeric ? 'atable__num' : column.actions ? 'atable__actions' : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  data-label={column.header}
                  className={column.numeric ? 'atable__num' : column.actions ? 'atable__actions' : undefined}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
