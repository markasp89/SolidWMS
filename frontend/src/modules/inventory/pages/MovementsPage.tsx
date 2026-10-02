import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAsync } from '@/core/hooks/useAsync'
import { Button } from '@/core/ui/Button'
import { EmptyState, ErrorMessage, PageHeader, Spinner } from '@/core/ui/misc'
import { warehousesApi } from '@/modules/warehouses'
import { inventoryApi } from '../api'
import { MovementList } from '../components/MovementList'
import type { Movement } from '../types'

export function MovementsPage() {
  const [params, setParams] = useSearchParams()
  const warehouseId = params.get('warehouse_id') ?? ''
  const type = params.get('type') ?? ''
  const productId = params.get('product_id') ?? ''
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<Movement[]>([])

  const warehouses = useAsync((signal) => warehousesApi.list(signal), [])
  const { data, error, loading, reload } = useAsync(
    (signal) =>
      inventoryApi.movements(
        { warehouse_id: Number(warehouseId) || undefined, type, product_id: Number(productId) || undefined, page },
        signal,
      ),
    [warehouseId, type, productId, page],
  )

  useEffect(() => setPage(1), [warehouseId, type, productId])
  useEffect(() => {
    if (data) setRows((prev) => (data.meta.current_page === 1 ? data.data : [...prev, ...data.data]))
  }, [data])

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  return (
    <>
      <PageHeader title="Historia operacji" subtitle="Kto, kiedy i gdzie odłożył lub zabrał towar." />
      <div className="filters">
        <select className="input" value={warehouseId} onChange={(e) => setFilter('warehouse_id', e.target.value)} aria-label="Magazyn">
          <option value="">Wszystkie magazyny</option>
          {warehouses.data?.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code} – {w.name}
            </option>
          ))}
        </select>
        <select className="input" value={type} onChange={(e) => setFilter('type', e.target.value)} aria-label="Typ operacji">
          <option value="">Wszystkie operacje</option>
          <option value="in">Przyjęcia</option>
          <option value="out">Wydania</option>
          <option value="move">Przesunięcia</option>
          <option value="adjust">Korekty</option>
        </select>
        {productId && (
          <Button size="sm" icon="close" onClick={() => setFilter('product_id', '')}>
            Wszystkie produkty
          </Button>
        )}
      </div>

      {error && <ErrorMessage error={error} onRetry={reload} />}
      {loading && rows.length === 0 && <Spinner />}
      {!loading && rows.length === 0 && <EmptyState icon="history" title="Brak operacji" />}
      {rows.length > 0 && <MovementList movements={rows} />}
      {data && data.meta.current_page < data.meta.last_page && (
        <div className="pagination">
          <Button loading={loading} onClick={() => setPage((p) => p + 1)}>
            Załaduj więcej
          </Button>
        </div>
      )}
    </>
  )
}
