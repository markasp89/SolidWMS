import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatNumber, formatRelative } from '@/core/format'
import { Button } from '@/core/ui/Button'
import { useFeedback } from '@/core/ui/feedback'
import { ColorDot } from '@/core/ui/misc'
import type { StockItem } from '../types'
import { AdjustModal, IssueModal, MoveModal } from './StockModals'

interface Props {
  items: StockItem[]
  /** What to show as the main label of a row. */
  show: 'product' | 'location'
  onChanged: () => void
  readOnly?: boolean
}

type Action = { kind: 'issue' | 'move' | 'adjust'; item: StockItem }

export function LocationList({ items, show, onChanged, readOnly = false }: Props) {
  const [action, setAction] = useState<Action | null>(null)
  const { toast } = useFeedback()

  const done = (message: string) => () => {
    setAction(null)
    toast(message)
    onChanged()
  }

  return (
    <>
      <ul className="locations">
        {items.map((item) => (
          <li key={item.id} className="location">
            <div className="location-main">
              {show === 'location' && item.sector ? (
                <Link
                  to={`/warehouses/${item.sector.warehouse?.id}?sector=${item.sector.id}`}
                  className="location-where"
                  title="Pokaż na mapie"
                >
                  <ColorDot color={item.sector.color} />
                  <span className="muted">{item.sector.warehouse?.code} ›</span>
                  <strong>{item.sector.code}</strong>
                  <span className="muted location-sector-name">{item.sector.name}</span>
                </Link>
              ) : (
                <Link to={`/products/${item.product_id}`} className="location-where">
                  <strong>{item.product?.name}</strong>
                  <span className="muted">{item.product?.sku}</span>
                </Link>
              )}
              {item.note && <div className="location-note">„{item.note}”</div>}
              <div className="location-meta">
                {item.updated_by ? `${item.updated_by.name}, ` : ''}
                {formatRelative(item.updated_at)}
              </div>
            </div>
            <div className="location-qty">
              {formatNumber(item.quantity)} <small>{item.product?.unit}</small>
            </div>
            {!readOnly && (
              <div className="location-actions">
                <Button size="sm" icon="arrowOut" onClick={() => setAction({ kind: 'issue', item })} title="Wydaj">
                  Wydaj
                </Button>
                <Button size="sm" icon="move" onClick={() => setAction({ kind: 'move', item })} title="Przenieś">
                  Przenieś
                </Button>
                <Button size="sm" icon="edit" variant="ghost" onClick={() => setAction({ kind: 'adjust', item })} title="Edytuj ilość / uwagi" aria-label="Edytuj ilość / uwagi" />
              </div>
            )}
          </li>
        ))}
      </ul>

      {action?.kind === 'issue' && (
        <IssueModal item={action.item} onClose={() => setAction(null)} onDone={done('Towar wydany.')} />
      )}
      {action?.kind === 'move' && (
        <MoveModal item={action.item} onClose={() => setAction(null)} onDone={done('Towar przeniesiony.')} />
      )}
      {action?.kind === 'adjust' && (
        <AdjustModal item={action.item} onClose={() => setAction(null)} onDone={done('Zapisano zmiany.')} />
      )}
    </>
  )
}
