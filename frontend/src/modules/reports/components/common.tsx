import type { ReactNode } from 'react'
import { formatDateTime } from '@/core/format'
import { Button } from '@/core/ui/Button'
import { parseDbDate } from '../dates'

export function Stat({ value, label, hint, warn }: { value: ReactNode; label: string; hint?: ReactNode; warn?: boolean }) {
  return (
    <div className={`stat rp-stat ${warn ? 'stat-warn' : ''}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      {hint && <span className="rp-stat-hint">{hint}</span>}
    </div>
  )
}

export function ExportButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button icon="download" onClick={onClick} disabled={disabled} className="rp-export">
      Eksportuj CSV
    </Button>
  )
}

/** Formatted database timestamp ("—" when empty). */
export function DbDateTime({ value }: { value: string | null }) {
  const date = parseDbDate(value)
  return <>{date ? formatDateTime(date.toISOString()) : '—'}</>
}
