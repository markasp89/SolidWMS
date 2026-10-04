import { useMemo } from 'react'
import { formatNumber } from '@/core/format'
import { useAsync } from '@/core/hooks/useAsync'
import { EmptyState, ErrorMessage, Spinner } from '@/core/ui/misc'
import { reportsApi } from '../api'
import { periodError, spreadsheetDateTime } from '../dates'
import { exportCsv, useSortedRows, type Column } from '../table'
import type { ActivityRow, Period } from '../types'
import { DbDateTime, ExportButton, Stat } from './common'
import { PeriodFilter } from './PeriodFilter'
import { ReportTable } from './ReportTable'

const COLUMNS: Column<ActivityRow>[] = [
  { key: 'name', label: 'Pracownik', value: (r) => r.name, render: (r) => (r.user_id ? r.name : <span className="muted">{r.name}</span>) },
  { key: 'receipts', label: 'Przyjęcia', value: (r) => r.receipts, numeric: true },
  { key: 'issues', label: 'Wydania', value: (r) => r.issues, numeric: true },
  { key: 'moves', label: 'Przesunięcia', value: (r) => r.moves, numeric: true },
  { key: 'adjustments', label: 'Korekty', value: (r) => r.adjustments, numeric: true },
  {
    key: 'operations',
    label: 'Razem',
    value: (r) => r.operations,
    render: (r) => <strong>{formatNumber(r.operations)}</strong>,
    numeric: true,
    bar: true,
  },
  {
    key: 'last_activity',
    label: 'Ostatnia aktywność',
    value: (r) => spreadsheetDateTime(r.last_activity),
    render: (r) => <DbDateTime value={r.last_activity} />,
  },
]

export function ActivityReport({ period, onPeriodChange }: { period: Period; onPeriodChange: (p: Period) => void }) {
  const invalid = periodError(period)
  const { data, error, loading, reload } = useAsync(
    (signal) => (invalid ? Promise.resolve(undefined) : reportsApi.activity(period, signal)),
    [period.from, period.to],
  )
  const rows = useMemo(() => data?.rows ?? [], [data])
  const { sorted, sort, toggle } = useSortedRows(rows, COLUMNS, { key: 'operations', dir: 'desc' })

  const stats = useMemo(() => {
    const top = rows.reduce<ActivityRow | null>((best, r) => (!best || r.operations > best.operations ? r : best), null)
    const sum = (pick: (r: ActivityRow) => number) => rows.reduce((total, r) => total + pick(r), 0)
    return {
      people: rows.filter((r) => r.user_id !== null).length,
      operations: sum((r) => r.operations),
      receipts: sum((r) => r.receipts),
      issues: sum((r) => r.issues),
      top,
    }
  }, [rows])

  return (
    <>
      <div className="filters rp-toolbar">
        <PeriodFilter value={period} onChange={onPeriodChange} />
        <ExportButton disabled={sorted.length === 0} onClick={() => exportCsv('aktywnosc', sorted, COLUMNS)} />
      </div>

      {invalid && <div className="alert alert-warn">{invalid}</div>}
      {error && <ErrorMessage error={error} onRetry={reload} />}
      {loading && !data && !invalid && <Spinner />}
      {data && (
        <>
          <div className="stats">
            <Stat value={formatNumber(stats.people)} label="Aktywni pracownicy" />
            <Stat
              value={formatNumber(stats.operations)}
              label="Operacje razem"
              hint={`${formatNumber(stats.receipts)} przyjęć, ${formatNumber(stats.issues)} wydań`}
            />
            <Stat
              value={stats.top ? stats.top.name : '—'}
              label="Najbardziej aktywna osoba"
              hint={stats.top && `${formatNumber(stats.top.operations)} operacji`}
            />
          </div>
          {sorted.length === 0 ? (
            <EmptyState icon="users" title="Brak operacji w wybranym okresie" />
          ) : (
            <ReportTable rows={sorted} columns={COLUMNS} rowKey={(r) => r.user_id ?? 'system'} sort={sort} onSort={toggle} />
          )}
        </>
      )}
    </>
  )
}
