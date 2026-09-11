'use client';

import type { MatrixRow } from '@/lib/admin/variant-matrix';
import { MAX_STOCK } from '@/lib/inventory/limits';

type BulkField = 'priceCents' | 'stock' | 'enabled';

type Props = {
  rows: MatrixRow[];
  onRowChange: (key: string, patch: Partial<MatrixRow>) => void;
  /** Copies one row's value for one field onto every variant. SKU is excluded
   *  from this — it has to stay unique per variant. */
  onApplyToAll: (field: BulkField, value: MatrixRow[BulkField]) => void;
};

/**
 * Every size crossed with every colour, as a dense editable grid.
 *
 * Density is right here and nowhere else in this panel: an admin pricing a
 * twelve-variant tee is comparing numbers down a column, and generous rows
 * would put half of them off the screen.
 */
export function VariantMatrix({ rows, onRowChange, onApplyToAll }: Props) {
  if (!rows.length) {
    return (
      <p className="aquiet">
        Add at least one size and one colour above, and the variants appear here
        with a SKU already suggested.
      </p>
    );
  }

  return (
    <div className="matrix">
      <table>
        <thead>
          <tr>
            <th scope="col">Size</th>
            <th scope="col">Colour</th>
            <th scope="col">SKU</th>
            <th scope="col">Price, in cents</th>
            <th scope="col">Stock</th>
            <th scope="col">For sale</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const showApplyAll = index === 0 && rows.length > 1;

            return (
              <tr key={row.key} data-orphan={row.orphan || undefined}>
                <td>{row.size.toUpperCase()}</td>
                <td>
                  {row.color}
                  {row.orphan ? <span className="prow__meta">Option removed</span> : null}
                </td>
                <td>
                  <input
                    aria-label={'SKU for ' + row.size + ' ' + row.color}
                    value={row.sku}
                    onChange={(event) => onRowChange(row.key, { sku: event.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    aria-label={'Price for ' + row.size + ' ' + row.color}
                    value={row.priceCents}
                    onChange={(event) =>
                      onRowChange(row.key, { priceCents: Number(event.target.value) })
                    }
                  />
                  {showApplyAll ? (
                    <button
                      type="button"
                      className="abtn abtn--quiet abtn--sm matrix__applyall"
                      onClick={() => onApplyToAll('priceCents', row.priceCents)}
                    >
                      Apply to all
                    </button>
                  ) : null}
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={MAX_STOCK}
                    step={1}
                    aria-label={'Stock for ' + row.size + ' ' + row.color}
                    value={row.stock}
                    onChange={(event) =>
                      onRowChange(row.key, { stock: Number(event.target.value) })
                    }
                  />
                  {showApplyAll ? (
                    <button
                      type="button"
                      className="abtn abtn--quiet abtn--sm matrix__applyall"
                      onClick={() => onApplyToAll('stock', row.stock)}
                    >
                      Apply to all
                    </button>
                  ) : null}
                </td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={'Enable ' + row.size + ' ' + row.color}
                    checked={row.enabled}
                    onChange={(event) =>
                      onRowChange(row.key, { enabled: event.target.checked })
                    }
                  />
                  {showApplyAll ? (
                    <button
                      type="button"
                      className="abtn abtn--quiet abtn--sm matrix__applyall"
                      onClick={() => onApplyToAll('enabled', row.enabled)}
                    >
                      Apply to all
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
