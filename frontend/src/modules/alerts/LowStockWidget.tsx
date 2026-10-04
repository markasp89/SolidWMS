import { Link } from 'react-router-dom'
import { api } from '@/core/api/client'
import { formatNumber } from '@/core/format'
import { useAsync } from '@/core/hooks/useAsync'
import { Card } from '@/core/ui/misc'

interface LowStock {
  id: number
  sku: string
  name: string
  unit: string
  total_quantity: number
  min_quantity: number
}

/** Extension "dashboard.widgets": products below their minimum. */
export function LowStockWidget() {
  const { data } = useAsync((signal) => api.get<LowStock[]>('/alerts/low-stock', undefined, signal), [])
  if (!data?.length) return null

  return (
    <Card title={`Niski stan (${data.length})`} className="widget widget-warn">
      <ul className="widget-list">
        {data.slice(0, 8).map((p) => (
          <li key={p.id}>
            <Link to={`/products/${p.id}`}>{p.name}</Link>
            <span className="nowrap">
              <strong>{formatNumber(p.total_quantity)}</strong> / {formatNumber(p.min_quantity)} {p.unit}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
