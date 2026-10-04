import type { Period } from '../types'
import { daysAgo, today as todayIso } from '../dates'

const PRESETS: Array<[number, string]> = [
  [7, '7 dni'],
  [30, '30 dni'],
  [90, '90 dni'],
]

export function PeriodFilter({ value, onChange }: { value: Period; onChange: (period: Period) => void }) {
  const today = todayIso()

  return (
    <div className="rp-period">
      <label className="rp-date">
        <span>Od</span>
        <input
          className="input"
          type="date"
          value={value.from}
          max={value.to || today}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
        />
      </label>
      <label className="rp-date">
        <span>Do</span>
        <input
          className="input"
          type="date"
          value={value.to}
          min={value.from}
          max={today}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
        />
      </label>
      <div className="rp-presets" role="group" aria-label="Szybki wybór okresu">
        {PRESETS.map(([days, label]) => {
          const active = value.to === today && value.from === daysAgo(days)
          return (
            <button
              key={days}
              type="button"
              className={`rp-preset ${active ? 'is-active' : ''}`}
              aria-pressed={active}
              onClick={() => onChange({ from: daysAgo(days), to: today })}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
