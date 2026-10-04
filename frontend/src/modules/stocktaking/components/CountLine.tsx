import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { formatNumber } from '@/core/format'
import { Button } from '@/core/ui/Button'
import { toNumber } from '@/core/ui/form'
import { ExpiryBadge } from '@/modules/inventory'
import type { StocktakeLine } from '../types'

interface Props {
  line: StocktakeLine
  readOnly: boolean
  showSlot: boolean
  showBatch: boolean
  /** Saves the counted quantity (null = clear the count). */
  onSave: (lineId: number, counted: number | null) => Promise<void>
}

/** Text shown in the input: Polish decimal comma, empty when not counted. */
const toDraft = (value: number | null) => (value === null ? '' : String(value).replace('.', ','))

type Parsed = { ok: true; value: number | null } | { ok: false; message: string }

function parse(draft: string): Parsed {
  if (draft.trim() === '') return { ok: true, value: null }
  const value = toNumber(draft.trim())
  if (!Number.isFinite(value)) return { ok: false, message: 'Podaj liczbę.' }
  if (value < 0) return { ok: false, message: 'Ilość nie może być ujemna.' }
  return { ok: true, value: Math.round(value * 1000) / 1000 }
}

const round = (value: number) => Math.round(value * 1000) / 1000

export function DifferenceLabel({ difference, unit }: { difference: number | null; unit: string }) {
  if (difference === null) return <span className="muted">nieprzeliczone</span>
  if (difference === 0) return <span className="st-diff st-diff-zero">zgodne</span>
  return (
    <span className={`st-diff ${difference < 0 ? 'st-diff-minus' : 'st-diff-plus'}`}>
      {difference > 0 ? '+' : '−'}
      {formatNumber(Math.abs(difference))} {unit}
    </span>
  )
}

/** One location to count: a card with a large quantity input (phone-first). */
export function CountLine({ line, readOnly, showSlot, showBatch, onSave }: Props) {
  const unit = line.product?.unit ?? ''
  const [draft, setDraft] = useState(() => toDraft(line.counted))
  const [synced, setSynced] = useState(line.counted)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Follow the saved value (e.g. after the server response).
  if (synced !== line.counted) {
    setSynced(line.counted)
    setDraft(toDraft(line.counted))
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const save = async (value: string) => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const parsed = parse(value)
    if (!parsed.ok) {
      setError(parsed.message)
      return
    }
    setError(null)
    if (parsed.value === line.counted) return
    setSaving(true)
    try {
      await onSave(line.id, parsed.value)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się zapisać.')
    } finally {
      setSaving(false)
    }
  }

  /** −/+ buttons: change immediately, save after a short pause (several taps = one request). */
  const step = (delta: number) => {
    const parsed = parse(draft)
    const base = parsed.ok ? (parsed.value ?? line.expected) : line.expected
    const next = toDraft(Math.max(0, round(base + delta)))
    setDraft(next)
    setError(null)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void save(next), 700)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    // Jump to the next line (its focus blurs this input, which saves it).
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('.st-count-input'))
    const next = inputs[inputs.indexOf(e.currentTarget) + 1]
    if (next) {
      next.focus()
      next.select()
    } else {
      e.currentTarget.blur()
    }
  }

  const parsed = parse(draft)
  const liveDifference = parsed.ok ? (parsed.value === null ? null : round(parsed.value - line.expected)) : line.difference
  const status = liveDifference === null ? 'is-pending' : liveDifference === 0 ? 'is-ok' : 'is-diff'

  return (
    <article className={`st-line ${status}`}>
      <div className="st-line-head">
        <div className="st-line-product">
          <strong>{line.product?.name ?? 'Usunięty produkt'}</strong>
          <div className="st-line-meta">
            {line.product && <code>{line.product.sku}</code>}
            {showSlot && line.slot && <span className="badge">miejsce {line.slot}</span>}
            {showBatch && line.batch && <span className="badge">partia {line.batch}</span>}
            {showBatch && line.expires_at && <ExpiryBadge date={line.expires_at} />}
            {line.expected === 0 && <span className="badge badge-warn">znaleziony</span>}
          </div>
        </div>
        <div className="st-expected">
          <span className="muted">w systemie</span>
          <strong>
            {formatNumber(line.expected)} {unit}
          </strong>
        </div>
      </div>

      {readOnly ? (
        <div className="st-line-foot">
          <span>
            Policzono:{' '}
            <strong>{line.counted === null ? '—' : `${formatNumber(line.counted)} ${unit}`}</strong>
          </span>
          <DifferenceLabel difference={line.difference} unit={unit} />
        </div>
      ) : (
        <>
          <div className="st-count">
            <Button icon="minus" aria-label="Zmniejsz o 1" onClick={() => step(-1)} className="st-step" />
            <input
              className="input st-count-input"
              type="text"
              inputMode="decimal"
              enterKeyHint="next"
              autoComplete="off"
              aria-label={`Policzona ilość: ${line.product?.name ?? ''}`}
              aria-invalid={error ? true : undefined}
              placeholder="?"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                setError(null)
              }}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={() => void save(draft)}
              onKeyDown={onKeyDown}
            />
            <Button icon="plus" aria-label="Zwiększ o 1" onClick={() => step(1)} className="st-step" />
            <Button
              icon="check"
              variant={liveDifference === 0 ? 'primary' : 'secondary'}
              onClick={() => {
                const value = toDraft(line.expected)
                setDraft(value)
                void save(value)
              }}
              className="st-match"
            >
              Zgadza się
            </Button>
          </div>
          <div className="st-line-foot">
            {error ? (
              <span className="field-error">{error}</span>
            ) : (
              <DifferenceLabel difference={liveDifference} unit={unit} />
            )}
            {saving && <span className="muted st-saving">Zapisywanie…</span>}
          </div>
        </>
      )}
    </article>
  )
}
