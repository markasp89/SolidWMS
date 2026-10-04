import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/core/api/client'
import { formatNumber } from '@/core/format'
import { useAsync } from '@/core/hooks/useAsync'
import { EmptyState, ErrorMessage, PageHeader, Spinner } from '@/core/ui/misc'
import { describeLocation, ExpiryBadge, useStockVersion, type StockItem } from '@/modules/inventory'

export const expiringApi = (days: number, signal?: AbortSignal) => api.get<StockItem[]>('/batches/expiring', { days }, signal)

/** Goods that are expired or expire soon, oldest first (FEFO). */
export function ExpiringPage() {
  const [days, setDays] = useState(30)
  const version = useStockVersion()
  const { data, error, loading, reload } = useAsync((signal) => expiringApi(days, signal), [days, version])

  return (
    <>
      <PageHeader title="Terminy ważności" subtitle="Towar przeterminowany i kończący się – wydawaj go najpierw (FEFO)." />
      <div className="filters">
        <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Zakres">
          <option value={0}>Tylko przeterminowane</option>
          <option value={7}>Do 7 dni</option>
          <option value={30}>Do 30 dni</option>
          <option value={90}>Do 90 dni</option>
        </select>
      </div>
      {error && <ErrorMessage error={error} onRetry={reload} />}
      {loading && !data && <Spinner />}
      {data && data.length === 0 && <EmptyState icon="clock" title="Brak towaru z bliskim terminem" />}
      {data && data.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Termin</th>
                <th>Produkt</th>
                <th>Partia</th>
                <th>Miejsce</th>
                <th className="num">Ilość</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.id}>
                  <td>{item.expires_at && <ExpiryBadge date={item.expires_at} />}</td>
                  <td>
                    <Link to={`/products/${item.product_id}`}>{item.product?.name}</Link>
                    <div className="muted">{item.product?.sku}</div>
                  </td>
                  <td>{item.batch ?? '—'}</td>
                  <td className="nowrap">
                    <Link to={`/warehouses/${item.sector?.warehouse?.id}?sector=${item.sector_id}`}>{describeLocation(item)}</Link>
                  </td>
                  <td className="num nowrap">
                    {formatNumber(item.quantity)} {item.product?.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
