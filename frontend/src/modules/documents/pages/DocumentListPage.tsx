import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { formatDateTime } from '@/core/format'
import { useAsync } from '@/core/hooks/useAsync'
import { useDebounced } from '@/core/hooks/useDebounced'
import { Button } from '@/core/ui/Button'
import { EmptyState, ErrorMessage, PageHeader, Spinner } from '@/core/ui/misc'
import { documentsApi } from '../api'
import { StatusBadge, TypeBadge } from '../components/badges'

export function DocumentListPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const type = params.get('type') ?? ''
  const status = params.get('status') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [query, setQuery] = useState(params.get('q') ?? '')
  const q = useDebounced(query.trim(), 300)

  const setFilters = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    // Changing a filter starts from the first page.
    if (!('page' in patch)) next.delete('page')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if (q !== (params.get('q') ?? '')) setFilters({ q })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const { data, error, loading, reload } = useAsync(
    (signal) => documentsApi.list({ type, status, q: params.get('q') ?? '', page }, signal),
    [type, status, params.get('q'), page],
  )
  const rows = data?.data ?? []

  return (
    <>
      <PageHeader
        title="Dokumenty PZ/WZ"
        subtitle="Przyjęcia i wydania zewnętrzne. Stan magazynu zmienia się dopiero po zatwierdzeniu dokumentu."
        actions={
          <>
            <Button variant="primary" icon="arrowIn" onClick={() => navigate('/documents/new?type=PZ')}>
              Nowe PZ
            </Button>
            <Button variant="primary" icon="arrowOut" onClick={() => navigate('/documents/new?type=WZ')}>
              Nowe WZ
            </Button>
          </>
        }
      />

      <div className="filters">
        <select className="input" value={type} onChange={(e) => setFilters({ type: e.target.value })} aria-label="Typ dokumentu">
          <option value="">Wszystkie typy</option>
          <option value="PZ">PZ – przyjęcia</option>
          <option value="WZ">WZ – wydania</option>
        </select>
        <select className="input" value={status} onChange={(e) => setFilters({ status: e.target.value })} aria-label="Status">
          <option value="">Wszystkie statusy</option>
          <option value="draft">Szkice</option>
          <option value="posted">Zatwierdzone</option>
        </select>
        <input
          className="input"
          type="search"
          placeholder="Numer lub kontrahent…"
          aria-label="Szukaj dokumentu"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {error && <ErrorMessage error={error} onRetry={reload} />}
      {loading && !data && <Spinner />}
      {data && rows.length === 0 && (
        <EmptyState icon="file" title="Brak dokumentów">
          {type || status || q ? 'Zmień filtry, aby zobaczyć więcej.' : 'Utwórz pierwsze PZ lub WZ.'}
        </EmptyState>
      )}

      {rows.length > 0 && (
        <div className="card">
          <div className="table-wrap">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Numer</th>
                  <th>Typ</th>
                  <th>Status</th>
                  <th>Magazyn</th>
                  <th>Kontrahent</th>
                  <th className="num">Pozycje</th>
                  <th>Utworzono</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} onClick={() => navigate(`/documents/${d.id}`)}>
                    <td className="nowrap">
                      <Link to={`/documents/${d.id}`} onClick={(e) => e.stopPropagation()}>
                        <strong>{d.number}</strong>
                      </Link>
                    </td>
                    <td>
                      <TypeBadge type={d.type} />
                    </td>
                    <td>
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="nowrap">{d.warehouse ? `${d.warehouse.code} – ${d.warehouse.name}` : '—'}</td>
                    <td>{d.counterparty ?? <span className="muted">—</span>}</td>
                    <td className="num">{d.lines_count}</td>
                    <td className="nowrap">
                      {formatDateTime(d.created_at)}
                      {d.created_by && <div className="muted">{d.created_by.name}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && data.meta.last_page > 1 && (
        <div className="pagination">
          <Button size="sm" disabled={page <= 1 || loading} onClick={() => setFilters({ page: String(page - 1) })}>
            ← Poprzednia
          </Button>
          <span className="muted">
            Strona {data.meta.current_page} z {data.meta.last_page}
          </span>
          <Button size="sm" disabled={page >= data.meta.last_page || loading} onClick={() => setFilters({ page: String(page + 1) })}>
            Następna →
          </Button>
        </div>
      )}
    </>
  )
}
