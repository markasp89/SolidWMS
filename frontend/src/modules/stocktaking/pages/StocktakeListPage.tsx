import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { formatDateTime } from '@/core/format'
import { useAsync } from '@/core/hooks/useAsync'
import { Button } from '@/core/ui/Button'
import { ColorDot, EmptyState, ErrorMessage, PageHeader, Spinner } from '@/core/ui/misc'
import { stocktakingApi } from '../api'
import { NewStocktakeModal } from '../components/NewStocktakeModal'
import { StatusBadge } from '../components/StatusBadge'
import type { StocktakeStatus } from '../types'

const STATUS_ORDER: Record<StocktakeStatus, number> = { open: 0, completed: 1, cancelled: 2 }

export function StocktakeListPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') ?? '') as StocktakeStatus | ''
  const [creating, setCreating] = useState(false)
  const { data, error, loading, reload } = useAsync((signal) => stocktakingApi.list({ status }, signal), [status])

  // Open stocktakes first, then the newest.
  const rows = useMemo(
    () =>
      [...(data ?? [])].sort(
        (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.created_at.localeCompare(a.created_at),
      ),
    [data],
  )

  return (
    <>
      <PageHeader
        title="Inwentaryzacja"
        subtitle="Przeliczanie sektorów i korekta stanów na podstawie spisu z natury."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
            Nowa inwentaryzacja
          </Button>
        }
      />
      <div className="filters">
        <select
          className="input"
          value={status}
          aria-label="Status"
          onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {}, { replace: true })}
        >
          <option value="">Wszystkie</option>
          <option value="open">W trakcie</option>
          <option value="completed">Zakończone</option>
          <option value="cancelled">Anulowane</option>
        </select>
      </div>

      {error && <ErrorMessage error={error} onRetry={reload} />}
      {loading && !data && <Spinner />}
      {data && rows.length === 0 && (
        <EmptyState icon="clipboard" title="Brak inwentaryzacji">
          Rozpocznij inwentaryzację sektora przyciskiem „Nowa inwentaryzacja” albo z mapy magazynu.
        </EmptyState>
      )}
      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="table table-hover st-table">
            <thead>
              <tr>
                <th>Numer</th>
                <th>Sektor</th>
                <th>Status</th>
                <th className="num">Pozycje</th>
                <th>Rozpoczęta</th>
                <th>Zakończona</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} onClick={() => navigate(`/stocktaking/${s.id}`)}>
                  <td className="nowrap">
                    <Link to={`/stocktaking/${s.id}`} onClick={(e) => e.stopPropagation()}>
                      {s.reference}
                    </Link>
                  </td>
                  <td>
                    <span className="st-sector">
                      <ColorDot color={s.sector.color} />
                      {s.sector.warehouse?.code}/{s.sector.code} – {s.sector.name}
                    </span>
                    {s.note && <div className="muted">{s.note}</div>}
                  </td>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="num">{s.lines_count}</td>
                  <td className="nowrap">
                    {formatDateTime(s.created_at)}
                    {s.created_by && <div className="muted">{s.created_by.name}</div>}
                  </td>
                  <td className="nowrap">
                    {formatDateTime(s.completed_at)}
                    {s.completed_by && <div className="muted">{s.completed_by.name}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <NewStocktakeModal onClose={() => setCreating(false)} onCreated={(s) => navigate(`/stocktaking/${s.id}`)} />
      )}
    </>
  )
}
