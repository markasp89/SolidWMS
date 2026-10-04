import { useMemo, useState } from 'react'
import { formatNumber } from '@/core/format'
import { useAsync } from '@/core/hooks/useAsync'
import { EmptyState, ErrorMessage, Spinner } from '@/core/ui/misc'
import { warehousesApi } from '@/modules/warehouses'
import { reportsApi } from '../api'
import { spreadsheetDateTime } from '../dates'
import { exportCsv, useSortedRows, type Column } from '../table'
import type { OccupancyRow } from '../types'
import { DbDateTime, ExportButton, Stat } from './common'
import { ReportTable } from './ReportTable'

const COLUMNS: Column<OccupancyRow>[] = [
  { key: 'warehouse', label: 'Magazyn', value: (r) => r.warehouse, render: (r) => <span title={r.warehouse_name}>{r.warehouse}</span> },
  { key: 'warehouse_name', label: 'Nazwa magazynu', value: (r) => r.warehouse_name, csvOnly: true },
  {
    key: 'sector',
    label: 'Sektor',
    value: (r) => r.sector,
    render: (r) => (
      <>
        <strong>{r.sector}</strong> <span className="muted">{r.sector_name}</span>
        {r.locations_count === 0 && <span className="badge badge-warn rp-empty-badge">pusty</span>}
      </>
    ),
  },
  { key: 'sector_name', label: 'Nazwa sektora', value: (r) => r.sector_name, csvOnly: true },
  { key: 'products_count', label: 'Produkty', value: (r) => r.products_count, numeric: true },
  { key: 'locations_count', label: 'Lokalizacje', value: (r) => r.locations_count, numeric: true, bar: true },
  { key: 'total_quantity', label: 'Ilość łącznie', value: (r) => r.total_quantity, numeric: true, bar: true },
  {
    key: 'last_change',
    label: 'Ostatnia zmiana',
    value: (r) => spreadsheetDateTime(r.last_change),
    render: (r) => <DbDateTime value={r.last_change} />,
  },
]

export function OccupancyReport() {
  const [warehouseId, setWarehouseId] = useState<number | ''>('')
  const warehouses = useAsync((signal) => warehousesApi.list(signal), [])
  const { data, error, loading, reload } = useAsync((signal) => reportsApi.occupancy(warehouseId, signal), [warehouseId])
  const rows = useMemo(() => data ?? [], [data])
  const { sorted, sort, toggle } = useSortedRows(rows, COLUMNS, { key: 'warehouse', dir: 'asc' })

  const stats = useMemo(() => {
    const empty = rows.filter((r) => r.locations_count === 0).length
    const fullest = rows.reduce<OccupancyRow | null>((best, r) => (!best || r.locations_count > best.locations_count ? r : best), null)
    return {
      empty,
      locations: rows.reduce((sum, r) => sum + r.locations_count, 0),
      fullest: fullest && fullest.locations_count > 0 ? fullest : null,
    }
  }, [rows])

  return (
    <>
      <div className="filters rp-toolbar">
        <select
          className="input"
          value={warehouseId}
          aria-label="Magazyn"
          onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">Wszystkie magazyny</option>
          {warehouses.data?.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code} – {w.name}
            </option>
          ))}
        </select>
        <ExportButton disabled={rows.length === 0} onClick={() => exportCsv('zajetosc', sorted, COLUMNS)} />
      </div>

      {error && <ErrorMessage error={error} onRetry={reload} />}
      {loading && !data && <Spinner />}
      {data && (
        <div className="stats">
          <Stat value={formatNumber(rows.length)} label="Sektory" />
          <Stat
            value={formatNumber(stats.empty)}
            label="Puste sektory"
            hint={rows.length ? `${Math.round((stats.empty / rows.length) * 100)}% wszystkich` : undefined}
            warn={stats.empty > 0}
          />
          <Stat value={formatNumber(stats.locations)} label="Zajęte lokalizacje" />
          <Stat
            value={stats.fullest ? `${stats.fullest.warehouse}/${stats.fullest.sector}` : '—'}
            label="Najbardziej zajęty sektor"
            hint={stats.fullest && `${formatNumber(stats.fullest.locations_count)} lokalizacji`}
          />
        </div>
      )}
      {data && rows.length === 0 && <EmptyState icon="chart" title="Brak sektorów" />}
      {rows.length > 0 && <ReportTable rows={sorted} columns={COLUMNS} rowKey={(r) => r.sector_id} sort={sort} onSort={toggle} />}
    </>
  )
}
