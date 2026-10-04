import type { PickListStatus, PickListSummary } from './types'

export const STATUS_LABELS: Record<PickListStatus, string> = {
  open: 'W trakcie',
  completed: 'Zakończona',
  cancelled: 'Anulowana',
}

export const STATUS_BADGES: Record<PickListStatus, string> = {
  open: 'badge-move',
  completed: 'badge-in',
  cancelled: '',
}

/** Lines that are no longer waiting (picked or short) out of all lines. */
export const progressOf = (list: Pick<PickListSummary, 'lines_count' | 'pending_count'>) => ({
  done: list.lines_count - list.pending_count,
  total: list.lines_count,
  percent: list.lines_count ? Math.round(((list.lines_count - list.pending_count) / list.lines_count) * 100) : 0,
})
