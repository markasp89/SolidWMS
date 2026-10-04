import { TYPE_LABELS } from '../labels'
import type { DocumentStatus, DocumentType } from '../types'

export function TypeBadge({ type }: { type: DocumentType }) {
  return (
    <span className={`badge ${type === 'PZ' ? 'badge-in' : 'badge-out'}`} title={TYPE_LABELS[type]}>
      {type}
    </span>
  )
}

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return status === 'posted' ? (
    <span className="badge badge-in">Zatwierdzony</span>
  ) : (
    <span className="badge badge-warn">Szkic</span>
  )
}
