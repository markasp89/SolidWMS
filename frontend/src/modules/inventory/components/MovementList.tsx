import { Link } from 'react-router-dom'
import { formatDateTime, formatNumber } from '@/core/format'
import type { Movement, SectorSummary } from '../types'

const where = (s: SectorSummary | null) => (s ? `${s.warehouse?.code ?? '?'}/${s.code}` : '—')

export function MovementList({ movements, showProduct = true }: { movements: Movement[]; showProduct?: boolean }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Operacja</th>
            {showProduct && <th>Produkt</th>}
            <th className="num">Ilość</th>
            <th>Skąd → dokąd</th>
            <th>Kto</th>
            <th>Uwagi</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((m) => (
            <tr key={m.id}>
              <td className="nowrap">{formatDateTime(m.created_at)}</td>
              <td>
                <span className={`badge badge-${m.type}`}>{m.type_label}</span>
              </td>
              {showProduct && (
                <td>{m.product ? <Link to={`/products/${m.product.id}`}>{m.product.name}</Link> : '—'}</td>
              )}
              <td className="num nowrap">
                {m.type === 'adjust' && m.quantity > 0 ? '+' : ''}
                {formatNumber(m.quantity)} {m.product?.unit}
              </td>
              <td className="nowrap">
                {m.type === 'in' && `→ ${where(m.to_sector)}`}
                {m.type === 'out' && `${where(m.from_sector)} →`}
                {m.type === 'move' && `${where(m.from_sector)} → ${where(m.to_sector)}`}
                {m.type === 'adjust' && where(m.to_sector)}
              </td>
              <td>{m.user?.name ?? '—'}</td>
              <td className="muted">{m.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
