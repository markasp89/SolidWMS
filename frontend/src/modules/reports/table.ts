import { useMemo, useState, type ReactNode } from 'react'
import { downloadCsv, toCsv, type CsvValue } from './csv'

export interface Column<T> {
  key: string
  label: string
  /** Raw value: used for sorting and for the CSV export. */
  value: (row: T) => CsvValue
  /** Cell content (default: the formatted value). */
  render?: (row: T) => ReactNode
  numeric?: boolean
  /** Draw a thin bar proportional to the largest value in the column. */
  bar?: boolean
  /** Only in the CSV file, not in the table (e.g. the unit). */
  csvOnly?: boolean
  /** Only in the table, not in the CSV file. */
  tableOnly?: boolean
}

export type SortDir = 'asc' | 'desc'
export interface Sort {
  key: string
  dir: SortDir
}

const collator = new Intl.Collator('pl', { numeric: true, sensitivity: 'base' })

const isEmpty = (v: CsvValue) => v === null || v === undefined || v === ''

function compare(a: CsvValue, b: CsvValue): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return collator.compare(String(a), String(b))
}

/** Sortable rows; clicking a header toggles the direction (numbers start descending). */
export function useSortedRows<T>(rows: T[], columns: Column<T>[], initial: Sort) {
  const [sort, setSort] = useState<Sort>(initial)

  const sorted = useMemo(() => {
    const column = columns.find((c) => c.key === sort.key)
    if (!column) return rows
    const factor = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = column.value(a)
      const vb = column.value(b)
      // Empty values stay at the end in both directions.
      if (isEmpty(va) || isEmpty(vb)) return Number(isEmpty(va)) - Number(isEmpty(vb))
      return compare(va, vb) * factor
    })
  }, [rows, columns, sort])

  const toggle = (key: string) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: columns.find((c) => c.key === key)?.numeric ? 'desc' : 'asc' },
    )

  return { sorted, sort, toggle }
}

export function exportCsv<T>(name: string, rows: T[], columns: Column<T>[]) {
  const exported = columns.filter((c) => !c.tableOnly)
  void downloadCsv(
    name,
    toCsv(
      exported.map((c) => c.label),
      rows.map((row) => exported.map((c) => c.value(row))),
    ),
  ).catch(() => {})
}
