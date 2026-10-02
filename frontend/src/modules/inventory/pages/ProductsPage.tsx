import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { formatNumber } from '@/core/format'
import { useAsync } from '@/core/hooks/useAsync'
import { useDebounced } from '@/core/hooks/useDebounced'
import { Button } from '@/core/ui/Button'
import { EmptyState, ErrorMessage, PageHeader, Spinner } from '@/core/ui/misc'
import { inventoryApi } from '../api'
import { ProductFormModal } from '../components/ProductFormModal'

export function ProductsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const page = Number(params.get('page') ?? 1)
  const debounced = useDebounced(query.trim())
  const [creating, setCreating] = useState(false)

  const { data, error, loading, reload } = useAsync(
    (signal) => inventoryApi.products({ q: debounced, page, per_page: 25 }, signal),
    [debounced, page],
  )

  const goTo = (p: number) => setParams({ ...(debounced ? { q: debounced } : {}), page: String(p) })

  return (
    <>
      <PageHeader
        title="Produkty"
        subtitle={data ? `${data.meta.total} produktów` : undefined}
        actions={
          <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
            Nowy produkt
          </Button>
        }
      />
      <input
        className="input input-search"
        type="search"
        placeholder="Filtruj po nazwie, SKU lub kodzie kreskowym…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          if (page !== 1) setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })
        }}
      />

      {error && <ErrorMessage error={error} onRetry={reload} />}
      {loading && !data && <Spinner />}
      {data && data.data.length === 0 && <EmptyState title="Brak produktów" />}
      {data && data.data.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nazwa</th>
                  <th className="num">Ilość</th>
                  <th className="num">Lokalizacje</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((p) => (
                  <tr key={p.id} onClick={() => navigate(`/products/${p.id}`)}>
                    <td className="nowrap">
                      <code>{p.sku}</code>
                    </td>
                    <td>
                      <Link to={`/products/${p.id}`} onClick={(e) => e.stopPropagation()}>
                        {p.name}
                      </Link>
                    </td>
                    <td className="num nowrap">
                      {formatNumber(p.total_quantity)} {p.unit}
                    </td>
                    <td className="num">
                      {p.locations_count ? p.locations_count : <span className="badge badge-warn">brak</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.meta.last_page > 1 && (
            <div className="pagination">
              <Button size="sm" disabled={page <= 1} onClick={() => goTo(page - 1)}>
                ← Poprzednia
              </Button>
              <span>
                Strona {data.meta.current_page} z {data.meta.last_page}
              </span>
              <Button size="sm" disabled={page >= data.meta.last_page} onClick={() => goTo(page + 1)}>
                Następna →
              </Button>
            </div>
          )}
        </>
      )}

      {creating && (
        <ProductFormModal onClose={() => setCreating(false)} onSaved={(p) => navigate(`/products/${p.id}`)} />
      )}
    </>
  )
}
