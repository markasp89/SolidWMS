import { useState } from 'react'
import { Link } from 'react-router-dom'
import { isQueued } from '@/core/api/client'
import { formatNumber, formatRelative } from '@/core/format'
import { Extension, useModuleEnabled } from '@/core/modules/registry'
import { Button } from '@/core/ui/Button'
import { useFeedback } from '@/core/ui/feedback'
import { ColorDot } from '@/core/ui/misc'
import type { StockItem } from '../types'
import { ExpiryBadge } from './ExpiryBadge'
import { AdjustModal, IssueModal, MoveModal } from './StockModals'

interface Props {
  items: StockItem[]
  /** What to show as the main label of a row. */
  show: 'product' | 'location'
  onChanged: () => void
  readOnly?: boolean
  /** Hide the pallet badge (e.g. on the pallet page itself). */
  hidePallet?: boolean
}

type Action = { kind: 'issue' | 'move' | 'adjust'; item: StockItem }

export function LocationList({ items, show, onChanged, readOnly = false, hidePallet = false }: Props) {
  const [action, setAction] = useState<Action | null>(null)
  const { toast } = useFeedback()
  const palletsEnabled = useModuleEnabled('pallets')
  const batchesEnabled = useModuleEnabled('batches')

  // FEFO: when the same product lies in several places, the earliest expiry goes out first.
  const firstOut = batchesEnabled && show === 'location' && items.length > 1 && items[0]?.expires_at ? items[0].id : null

  const done = (message: string) => (result: unknown) => {
    setAction(null)
    toast(isQueued(result) ? 'Brak sieci – operacja zostanie wysłana, gdy wróci połączenie.' : message, isQueued(result) ? 'info' : 'success')
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
                  <strong>
                    {item.sector.code}
                    {item.slot && <span className="slot">-{item.slot}</span>}
                  </strong>
                  <span className="muted location-sector-name">{item.sector.name}</span>
                </Link>
              ) : (
                <Link to={`/products/${item.product_id}`} className="location-where">
                  <strong>{item.product?.name}</strong>
                  <span className="muted">{item.product?.sku}</span>
                  {item.slot && <span className="badge badge-slot">miejsce {item.slot}</span>}
                </Link>
              )}
              <div className="location-tags">
                {firstOut === item.id && <span className="badge badge-fefo">Wydaj najpierw</span>}
                {!hidePallet && item.pallet && (
                  palletsEnabled ? (
                    <Link to={`/pallets/${encodeURIComponent(item.pallet.code)}`} className="badge badge-pallet">
                      {item.pallet.code}
                    </Link>
                  ) : (
                    <span className="badge badge-pallet">{item.pallet.code}</span>
                  )
                )}
                {item.batch && <span className="badge">partia {item.batch}</span>}
                {item.expires_at && <ExpiryBadge date={item.expires_at} />}
              </div>
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
                <Button size="sm" icon="arrowOut" onClick={() => setAction({ kind: 'issue', item })}>
                  Wydaj
                </Button>
                <Button size="sm" icon="move" onClick={() => setAction({ kind: 'move', item })}>
                  Przenieś
                </Button>
                <Button
                  size="sm"
                  icon="edit"
                  variant="ghost"
                  onClick={() => setAction({ kind: 'adjust', item })}
                  title="Edytuj ilość / uwagi"
                  aria-label="Edytuj ilość / uwagi"
                />
                <Extension name="location.actions" props={{ item, onChanged }} />
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
