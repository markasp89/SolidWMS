import { useCallback, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '@/core/auth/AuthContext'
import { formatDateTime } from '@/core/format'
import { useAsync } from '@/core/hooks/useAsync'
import { useModuleEnabled } from '@/core/modules/registry'
import { Button } from '@/core/ui/Button'
import { useFeedback } from '@/core/ui/feedback'
import { ColorDot, EmptyState, ErrorMessage, PageHeader, Spinner } from '@/core/ui/misc'
import { notifyStockChanged } from '@/modules/inventory'
import { stocktakingApi } from '../api'
import { AddLineModal } from '../components/AddLineModal'
import { CountLine } from '../components/CountLine'
import { StatusBadge } from '../components/StatusBadge'
import type { StocktakeLine } from '../types'

const matches = (line: StocktakeLine, query: string) =>
  [line.product?.name, line.product?.sku, line.product?.barcode, line.slot, line.batch].some((v) =>
    v?.toLowerCase().includes(query),
  )

export function StocktakePage() {
  const { id } = useParams()
  const { isManager } = useAuth()
  const { toast, confirm } = useFeedback()
  const showSlot = useModuleEnabled('slots')
  const showBatch = useModuleEnabled('batches')
  const { data, error, loading, reload, setData } = useAsync((signal) => stocktakingApi.get(id!, signal), [id])

  const [onlyPending, setOnlyPending] = useState(false)
  // Lines counted while "only not counted" is on stay visible until the filter is toggled.
  const [keep, setKeep] = useState<Set<number>>(new Set())
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState<'complete' | 'cancel' | null>(null)

  const stocktakeId = data?.id
  const saveLine = useCallback(
    async (lineId: number, counted: number | null) => {
      if (!stocktakeId) return
      const fresh = await stocktakingApi.count(stocktakeId, lineId, counted)
      const updated = fresh.lines.find((l) => l.id === lineId)
      // Only take over this line: responses of parallel saves may arrive out of order.
      setData((prev) =>
        prev && updated ? { ...prev, lines: prev.lines.map((l) => (l.id === lineId ? updated : l)) } : fresh,
      )
      setKeep((prev) => new Set(prev).add(lineId))
    },
    [stocktakeId, setData],
  )

  const lines = useMemo(() => data?.lines ?? [], [data])
  const counted = lines.filter((l) => l.counted !== null).length
  const withDifference = lines.filter((l) => l.difference !== null && l.difference !== 0).length
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return lines.filter((l) => (!onlyPending || l.counted === null || keep.has(l.id)) && (!q || matches(l, q)))
  }, [lines, onlyPending, keep, query])

  if (error) return <ErrorMessage error={error} onRetry={reload} />
  if (loading && !data) return <Spinner />
  if (!data) return null

  const open = data.status === 'open'
  const progress = lines.length ? Math.round((counted / lines.length) * 100) : 0

  const complete = async () => {
    const pending = lines.length - counted
    const ok = await confirm({
      title: 'Zatwierdzić korekty?',
      message: (
        <>
          <p>
            Stany magazynowe sektora <strong>{data.sector.code}</strong> zostaną ustawione na policzone ilości. Każda zmiana
            zostanie zapisana w historii jako korekta z numerem <strong>{data.reference}</strong>.
          </p>
          <p>
            Pozycje z różnicą: <strong>{withDifference}</strong>.
            {pending > 0 && (
              <>
                {' '}
                Nieprzeliczone (<strong>{pending}</strong>) pozostaną bez zmian.
              </>
            )}
          </p>
          <p>Po zatwierdzeniu inwentaryzacji nie można już edytować.</p>
        </>
      ),
      confirmLabel: 'Zatwierdź korekty',
    })
    if (!ok) return
    setBusy('complete')
    try {
      const { result, ...detail } = await stocktakingApi.complete(data.id)
      setData(detail)
      notifyStockChanged()
      toast(`Inwentaryzacja zatwierdzona: zmieniono ${result.changed}, bez zmian ${result.unchanged}, pominięto ${result.skipped}.`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się zatwierdzić.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const cancel = async () => {
    const ok = await confirm({
      title: 'Anulować inwentaryzację?',
      message: 'Policzone ilości zostaną odrzucone, a stany magazynowe pozostaną bez zmian.',
      confirmLabel: 'Anuluj inwentaryzację',
      danger: true,
    })
    if (!ok) return
    setBusy('cancel')
    try {
      setData(await stocktakingApi.cancel(data.id))
      toast('Inwentaryzacja została anulowana.', 'info')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się anulować.', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="st-page">
      <PageHeader
        back={
          <Link to="/stocktaking" className="link-muted">
            ← Inwentaryzacje
          </Link>
        }
        title={
          <>
            {data.reference} <StatusBadge status={data.status} />
          </>
        }
        subtitle={
          <>
            <ColorDot color={data.sector.color} /> {data.sector.warehouse?.code}/{data.sector.code} – {data.sector.name}
            {' · '}rozpoczęta {formatDateTime(data.created_at)}
            {data.created_by && ` przez ${data.created_by.name}`}
            {data.completed_at && (
              <>
                {' · '}
                {data.status === 'completed' ? 'zatwierdzona' : 'anulowana'} {formatDateTime(data.completed_at)}
                {data.completed_by && ` przez ${data.completed_by.name}`}
              </>
            )}
            {data.note && <span className="st-note">{data.note}</span>}
          </>
        }
        actions={
          open && (
            <>
              <Button icon="plus" onClick={() => setAdding(true)}>
                Dodaj znaleziony produkt
              </Button>
              {isManager && (
                <>
                  <Button icon="close" variant="ghost" loading={busy === 'cancel'} disabled={busy !== null} onClick={cancel}>
                    Anuluj
                  </Button>
                  <Button icon="check" variant="primary" loading={busy === 'complete'} disabled={busy !== null} onClick={complete}>
                    Zatwierdź korekty
                  </Button>
                </>
              )}
            </>
          )
        }
      />

      {!open && (
        <div className={`alert ${data.status === 'completed' ? 'alert-success' : 'alert-info'}`}>
          {data.status === 'completed'
            ? 'Inwentaryzacja została zatwierdzona – korekty zapisano w stanach magazynowych.'
            : 'Inwentaryzacja została anulowana – stany magazynowe nie zostały zmienione.'}
        </div>
      )}
      {open && !isManager && (
        <p className="muted">Po przeliczeniu sektora kierownik zmiany zatwierdzi korekty.</p>
      )}

      <div className="filters st-filters">
        <input
          className="input"
          type="search"
          placeholder="Szukaj produktu, SKU, miejsca…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Szukaj pozycji"
        />
        <label className="checkbox">
          <input
            type="checkbox"
            checked={onlyPending}
            onChange={(e) => {
              setOnlyPending(e.target.checked)
              setKeep(new Set())
            }}
          />
          <span>tylko nieprzeliczone</span>
        </label>
      </div>

      {lines.length === 0 ? (
        <EmptyState icon="clipboard" title="Sektor był pusty w chwili rozpoczęcia">
          {open && 'Jeśli coś w nim leży, dodaj to przyciskiem „Dodaj znaleziony produkt”.'}
        </EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState icon="check" title={onlyPending && !query ? 'Wszystko przeliczone' : 'Brak pasujących pozycji'} />
      ) : (
        <div className="st-lines">
          {visible.map((line) => (
            <CountLine
              key={line.id}
              line={line}
              readOnly={!open}
              showSlot={showSlot}
              showBatch={showBatch}
              onSave={saveLine}
            />
          ))}
        </div>
      )}

      <div className="st-summary" role="status">
        <div className="st-progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        <span>
          Przeliczono <strong>{counted}</strong> / {lines.length}
        </span>
        <span className={withDifference ? 'st-diff st-diff-plus' : 'muted'}>
          z różnicą: <strong>{withDifference}</strong>
        </span>
      </div>

      {adding && (
        <AddLineModal
          stocktakeId={data.id}
          onClose={() => setAdding(false)}
          onAdded={(detail) => {
            setData(detail)
            setAdding(false)
            toast('Dodano pozycję.')
          }}
        />
      )}
    </div>
  )
}
