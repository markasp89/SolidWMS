import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatNumber } from '@/core/format'
import { useAsync } from '@/core/hooks/useAsync'
import { useDebounced } from '@/core/hooks/useDebounced'
import { EmptyState, ErrorMessage, Spinner } from '@/core/ui/misc'
import { reportsApi } from '../api'
import { periodError, spreadsheetDateTime } from '../dates'
import { exportCsv, useSortedRows, type Column } from '../table'
import type { Period, RotationRow } from '../types'
import { DbDateTime, ExportButton, Stat } from './common'
import { PeriodFilter } from './PeriodFilter'
import { ReportTable } from './ReportTable'

const withUnit = (value: number, unit: string) => (value ? `${formatNumber(value)} ${unit}` : <span className="muted">0</span>)

const COLUMNS: Column<RotationRow>[] = [
  { key: 'sku', label: 'SKU', value: (r) => r.sku, render: (r) => <code>{r.sku}</code> },
  { key: 'name', label: 'Produkt', value: (r) => r.name, render: (r) => <Link to={`/products/${r.product_id}`}>{r.name}</Link> },
  { key: 'unit', label: 'Jednostka', value: (r) => r.unit, csvOnly: true },
  { key: 'received', label: 'Przyjęto', value: (r) => r.received, render: (r) => withUnit(r.received, r.unit), numeric: true, bar: true },
  { key: 'issued', label: 'Wydano', value: (r) => r.issued, render: (r) => withUnit(r.issued, r.unit), numeric: true, bar: true },
  { key: 'moves', label: 'Przesunięcia', value: (r) => r.moves, numeric: true },
  { key: 'operations', label: 'Operacje', value: (r) => r.operations, numeric: true },
  { key: 'stock', label: 'Stan obecny', value: (r) => r.stock, render: (r) => withUnit(r.stock, r.unit), numeric: true },
  {
    key: 'last_movement',
    label: 'Ostatni ruch',
    value: (r) => spreadsheetDateTime(r.last_movement),
    render: (r) => <DbDateTime value={r.last_movement} />,
  },
]

type Show = 'all' | 'moving' | 'idle'

/** Lying in stock without any operation in the period. */
const isIdle = (r: RotationRow) => r.operations === 0 && r.stock > 0

export function RotationReport({ period, onPeriodChange }: { period: Period; onPeriodChange: (p: Period) => void }) {
  const invalid = periodError(period)
  const { data, error, loading, reload } = useAsync(
    (signal) => (invalid ? Promise.resolve(undefined) : reportsApi.rotation(period, signal)),
    [period.from, period.to],
  )
  const [query, setQuery] = useState('')
  const [show, setShow] = useState<Show>('all')
  const q = useDebounced(query.trim().toLowerCase())

  const all = useMemo(() => data?.rows ?? [], [data])
  const rows = useMemo(
    () =>
      all.filter(
        (r) =>
          (show === 'all' || (show === 'moving' ? r.operations > 0 : isIdle(r))) &&
          (!q || r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q)),
      ),
    [all, show, q],
  )
  const { sorted, sort, toggle } = useSortedRows(rows, COLUMNS, { key: 'issued', dir: 'desc' })

  const stats = useMemo(() => {
    const top = all.reduce<RotationRow | null>((best, r) => (!best || r.issued > best.issued ? r : best), null)
    return {
      moving: all.filter((r) => r.operations > 0).length,
      idle: all.filter(isIdle).length,
      operations: all.reduce((sum, r) => sum + r.operations, 0),
      top: top && top.issued > 0 ? top : null,
    }
  }, [all])

  return (
    <>
      <div className="filters rp-toolbar">
        <PeriodFilter value={period} onChange={onPeriodChange} />
        <ExportButton disabled={sorted.length === 0} onClick={() => exportCsv('rotacja', sorted, COLUMNS)} />
      </div>

      {invalid && <div className="alert alert-warn">{invalid}</div>}
      {error && <ErrorMessage error={error} onRetry={reload} />}
      {loading && !data && !invalid && <Spinner />}
      {data && (
        <>
          <div className="stats">
            <Stat value={formatNumber(stats.moving)} label="Produkty z ruchem" hint={`z ${formatNumber(all.length)} w kartotece`} />
            <Stat value={formatNumber(stats.operations)} label="Operacje w okresie" />
            <Stat
              value={stats.top ? stats.top.sku : '—'}
              label="Najczęściej wydawany"
              hint={stats.top && `${stats.top.name} – ${formatNumber(stats.top.issued)} ${stats.top.unit}`}
            />
            <Stat value={formatNumber(stats.idle)} label="Zalegające (bez ruchu)" warn={stats.idle > 0} />
          </div>

          <div className="filters">
            <input
              className="input"
              type="search"
              placeholder="Filtruj po nazwie lub SKU…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Filtruj produkty"
            />
            <select className="input" value={show} onChange={(e) => setShow(e.target.value as Show)} aria-label="Pokaż">
              <option value="all">Wszystkie produkty</option>
              <option value="moving">Tylko z ruchem w okresie</option>
              <option value="idle">Zalegające (stan bez ruchu)</option>
            </select>
          </div>

          {sorted.length === 0 ? (
            <EmptyState icon="chart" title="Brak produktów do pokazania" />
          ) : (
            <ReportTable rows={sorted} columns={COLUMNS} rowKey={(r) => r.product_id} sort={sort} onSort={toggle} />
          )}
        </>
      )}
    </>
  )
}
