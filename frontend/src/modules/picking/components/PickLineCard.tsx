import { Link } from 'react-router-dom'
import { formatDateTime, formatNumber } from '@/core/format'
import { Button } from '@/core/ui/Button'
import { Icon } from '@/core/ui/Icon'
import { ColorDot } from '@/core/ui/misc'
import { ExpiryBadge } from '@/modules/inventory'
import type { PickLine } from '../types'

interface Props {
  line: PickLine
  warehouseId: number | undefined
  /** The list accepts picks (status open). */
  editable: boolean
  isNext: boolean
  busy: boolean
  error?: string
  onPick: () => void
  onPartial: () => void
}

export function PickLineCard({ line, warehouseId, editable, isNext, busy, error, onPick, onPartial }: Props) {
  const unit = line.product?.unit ?? ''
  const product = (
    <div className="pick-line-product">
      <strong>{line.product?.name ?? 'Produkt usunięty'}</strong>
      <span className="muted">
        {line.product?.sku}
        {line.product?.barcode && ` · ${line.product.barcode}`}
      </span>
    </div>
  )

  if (line.status === 'short') {
    return (
      <li id={`pick-line-${line.id}`} className="pick-line pick-line-short">
        <div className="pick-line-short-head">
          <span className="badge badge-out">Brak w magazynie</span>
          <span className="pick-line-seq">#{line.sequence}</span>
        </div>
        {product}
        <div>
          Brakuje:{' '}
          <strong>
            {formatNumber(line.quantity)} {unit}
          </strong>
        </div>
      </li>
    )
  }

  if (line.status === 'picked') {
    return (
      <li id={`pick-line-${line.id}`} className="pick-line pick-line-done">
        <Icon name="check" size={20} />
        <div className="pick-line-done-main">
          <span>
            <strong>{line.product?.name}</strong> · {formatNumber(line.picked)} {unit}
          </span>
          <span className="muted">
            {line.sector?.code}
            {line.slot && `-${line.slot}`}
            {line.picked_by && ` · zebrał(a) ${line.picked_by.name}`}
            {line.picked_at && `, ${formatDateTime(line.picked_at)}`}
          </span>
        </div>
      </li>
    )
  }

  const remaining = line.quantity - line.picked
  const mapWarehouse = line.sector?.warehouse?.id ?? warehouseId

  return (
    <li id={`pick-line-${line.id}`} className={`pick-line pick-line-pending ${isNext ? 'is-next' : ''}`}>
      <div className="pick-line-location">
        {line.sector && <ColorDot color={line.sector.color} />}
        <span className="pick-line-sector">{line.sector?.code ?? '—'}</span>
        {line.slot && <span className="pick-line-slot">{line.slot}</span>}
        <span className="pick-line-seq">#{line.sequence}</span>
      </div>
      {line.sector && (
        <div className="pick-line-sector-name muted">
          {line.sector.name}
          {mapWarehouse && (
            <>
              {' · '}
              <Link to={`/warehouses/${mapWarehouse}?sector=${line.sector.id}`}>
                <Icon name="map" size={14} /> Pokaż na mapie
              </Link>
            </>
          )}
        </div>
      )}

      {product}

      <div className="pick-line-qty">
        <span className="pick-line-qty-value">
          {formatNumber(remaining)} <small>{unit}</small>
        </span>
        {line.picked > 0 && (
          <span className="muted">
            zebrano {formatNumber(line.picked)} z {formatNumber(line.quantity)}
          </span>
        )}
      </div>

      {(line.batch || line.expires_at) && (
        <div className="pick-line-batch">
          {line.batch && (
            <span>
              Partia: <strong>{line.batch}</strong>
            </span>
          )}
          {line.expires_at && <ExpiryBadge date={line.expires_at} />}
        </div>
      )}

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {editable && (
        <div className="pick-line-actions">
          <Button variant="primary" icon="check" className="pick-line-button" loading={busy} onClick={onPick}>
            Zebrano
          </Button>
          <button type="button" className="link" onClick={onPartial} disabled={busy}>
            inna ilość
          </button>
        </div>
      )}
    </li>
  )
}
