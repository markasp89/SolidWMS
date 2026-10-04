import { Link } from 'react-router-dom'
import { useAsync } from '@/core/hooks/useAsync'
import { Card } from '@/core/ui/misc'
import { describeLocation, ExpiryBadge } from '@/modules/inventory'
import { expiringApi } from './ExpiringPage'

/** Extension "dashboard.widgets": goods expiring within 30 days. */
export function ExpiryWidget() {
  const { data } = useAsync((signal) => expiringApi(30, signal), [])
  if (!data?.length) return null

  return (
    <Card title={`Kończące się terminy (${data.length})`} actions={<Link to="/expiring">Wszystkie →</Link>} className="widget widget-warn">
      <ul className="widget-list">
        {data.slice(0, 6).map((item) => (
          <li key={item.id}>
            <span>
              <Link to={`/products/${item.product_id}`}>{item.product?.name}</Link> <span className="muted">{describeLocation(item)}</span>
            </span>
            {item.expires_at && <ExpiryBadge date={item.expires_at} />}
          </li>
        ))}
      </ul>
    </Card>
  )
}
