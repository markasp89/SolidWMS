import { useMemo } from 'react'
import { formatNumber } from '@/core/format'
import type { Column, Sort } from '../table'

interface Props<T> {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string | number
  sort: Sort
  onSort: (key: string) => void
  /** Render at most this many rows (the CSV always has all of them). */
  limit?: number
}

export function ReportTable<T>({ rows, columns, rowKey, sort, onSort, limit = 500 }: Props<T>) {
  const visible = useMemo(() => columns.filter((c) => !c.csvOnly), [columns])
  const maxima = useMemo(() => {
    const result: Record<string, number> = {}
    for (const column of visible) {
      if (!column.bar) continue
      result[column.key] = rows.reduce((max, r) => Math.max(max, Number(column.value(r)) || 0), 0)
    }
    return result
  }, [rows, visible])

  const shown = rows.slice(0, limit)

  return (
    <>
      <div className="table-wrap">
        <table className="table rp-table">
          <thead>
            <tr>
              {visible.map((column) => {
                const active = sort.key === column.key
                return (
                  <th
                    key={column.key}
                    className={column.numeric ? 'num' : undefined}
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    <button type="button" className={`rp-sort ${active ? 'is-active' : ''}`} onClick={() => onSort(column.key)}>
                      {column.label}
                      <span className="rp-sort-arrow" aria-hidden="true">
                        {active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={rowKey(row)}>
                {visible.map((column) => {
                  const value = column.value(row)
                  const content = column.render ? column.render(row) : typeof value === 'number' ? formatNumber(value) : value
                  const max = maxima[column.key]
                  return (
                    <td key={column.key} className={column.numeric ? 'num nowrap' : undefined}>
                      {column.bar ? (
                        <div className="rp-bar-cell">
                          {content}
                          <span className="rp-bar" aria-hidden="true">
                            <span style={{ width: `${max ? ((Number(value) || 0) / max) * 100 : 0}%` }} />
                          </span>
                        </div>
                      ) : (
                        content
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > shown.length && (
        <p className="muted rp-limit">
          Pokazano {shown.length} z {rows.length} wierszy – pełna lista jest w pliku CSV.
        </p>
      )}
    </>
  )
}
