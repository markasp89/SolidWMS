import type { StocktakeStatus } from '../types'

const LABELS: Record<StocktakeStatus, string> = {
  open: 'W trakcie',
  completed: 'Zakończona',
  cancelled: 'Anulowana',
}

export function StatusBadge({ status }: { status: StocktakeStatus }) {
  return <span className={`badge st-status-${status}`}>{LABELS[status]}</span>
}
