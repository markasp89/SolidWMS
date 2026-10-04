import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formatDateTime } from '@/core/format'
import { useAsync } from '@/core/hooks/useAsync'
import { Button } from '@/core/ui/Button'
import { useFeedback } from '@/core/ui/feedback'
import { ErrorMessage, PageHeader, Spinner } from '@/core/ui/misc'
import { notifyStockChanged } from '@/modules/inventory'
import { pickingApi } from '../api'
import { PickLineCard } from '../components/PickLineCard'
import { PickQuantityModal } from '../components/PickQuantityModal'
import { ProgressBar } from '../components/ProgressBar'
import { STATUS_BADGES, STATUS_LABELS } from '../labels'
import type { PickLine, PickListDetail } from '../types'

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Wystąpił nieoczekiwany błąd.')

/** Phone-first picking screen: walk the lines in order and confirm each pick. */
export function PickListPage() {
  const { id } = useParams()
  const { toast, confirm } = useFeedback()
  const { data: list, error, loading, reload, setData } = useAsync((signal) => pickingApi.get(Number(id), signal), [id])
  const [busyLine, setBusyLine] = useState<number | null>(null)
  const [busyAction, setBusyAction] = useState<'complete' | 'cancel' | null>(null)
  const [lineErrors, setLineErrors] = useState<Record<number, string>>({})
  const [partial, setPartial] = useState<PickLine | null>(null)

  if (error) return <ErrorMessage error={error} onRetry={reload} />
  if (loading || !list) return <Spinner />

  const pending = list.lines.filter((l) => l.status === 'pending')
  const short = list.lines.filter((l) => l.status === 'short')
  const done = list.lines.length - pending.length
  const nextId = pending[0]?.id
  const editable = list.status === 'open'

  const applyUpdate = (updated: PickListDetail, lineId: number) => {
    setData(updated)
    notifyStockChanged()
    setLineErrors(({ [lineId]: _removed, ...rest }) => rest)
    if (updated.status === 'completed') {
      toast(`Lista ${updated.number} zebrana w całości.`)
      return
    }
    // Bring the next line to pick into view.
    const next = updated.lines.find((l) => l.status === 'pending')
    if (next) requestAnimationFrame(() => document.getElementById(`pick-line-${next.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  /** Throws on failure so the partial-quantity modal can show the error. */
  const pickQuantity = async (line: PickLine, quantity?: number) => {
    setBusyLine(line.id)
    try {
      applyUpdate(await pickingApi.pick(list.id, line.id, quantity), line.id)
    } catch (e) {
      setLineErrors((prev) => ({ ...prev, [line.id]: errorMessage(e) }))
      throw e
    } finally {
      setBusyLine(null)
    }
  }

  const pick = (line: PickLine) =>
    pickQuantity(line).catch((e: unknown) => toast(errorMessage(e), 'error'))

  const closeList = async (action: 'complete' | 'cancel') => {
    const ok = await confirm(
      action === 'complete'
        ? {
            title: `Zakończyć ${list.number}?`,
            message: pending.length
              ? `Na liście zostało ${pending.length} niezebranych pozycji – nie zostaną już zebrane.`
              : 'Lista zostanie oznaczona jako zakończona.',
            confirmLabel: 'Zakończ listę',
          }
        : {
            title: `Anulować ${list.number}?`,
            message: 'Lista zostanie anulowana. Towar już zebrany pozostaje wydany z magazynu.',
            confirmLabel: 'Anuluj listę',
            danger: true,
          },
    )
    if (!ok) return
    setBusyAction(action)
    try {
      setData(action === 'complete' ? await pickingApi.complete(list.id) : await pickingApi.cancel(list.id))
      toast(action === 'complete' ? 'Lista zakończona.' : 'Lista anulowana.')
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div className="pick-screen">
      <PageHeader
        back={
          <Link to="/picking" className="link-muted">
            ← Kompletacja
          </Link>
        }
        title={
          <span className="pick-title">
            {list.number} <span className={`badge ${STATUS_BADGES[list.status]}`}>{STATUS_LABELS[list.status]}</span>
          </span>
        }
        subtitle={
          <>
            {list.warehouse ? `${list.warehouse.code} – ${list.warehouse.name}` : '—'} · {formatDateTime(list.created_at)}
            {list.created_by && ` · ${list.created_by.name}`}
            {list.note && (
              <>
                <br />
                {list.note}
              </>
            )}
          </>
        }
      />

      <section className="card pick-summary">
        <div className="card-body">
          <ProgressBar done={done} total={list.lines.length} />
          <p className="muted pick-summary-text">
            Do zebrania: <strong>{pending.length}</strong>
            {short.length > 0 && (
              <>
                {' · '}
                <span className="pick-summary-short">brak w magazynie: {short.length}</span>
              </>
            )}
            {list.completed_at && ` · zamknięta ${formatDateTime(list.completed_at)}`}
          </p>
        </div>
      </section>

      <ol className="pick-lines">
        {list.lines.map((line) => (
          <PickLineCard
            key={line.id}
            line={line}
            warehouseId={list.warehouse?.id}
            editable={editable}
            isNext={line.id === nextId}
            busy={busyLine === line.id}
            error={lineErrors[line.id]}
            onPick={() => void pick(line)}
            onPartial={() => setPartial(line)}
          />
        ))}
      </ol>

      {editable && (
        <div className="pick-footer">
          <Button variant="danger" icon="close" loading={busyAction === 'cancel'} disabled={busyAction !== null} onClick={() => closeList('cancel')}>
            Anuluj
          </Button>
          <Button variant="primary" icon="check" loading={busyAction === 'complete'} disabled={busyAction !== null} onClick={() => closeList('complete')}>
            Zakończ listę
          </Button>
        </div>
      )}

      {partial && <PickQuantityModal line={partial} onPick={(quantity) => pickQuantity(partial, quantity)} onClose={() => setPartial(null)} />}
    </div>
  )
}
