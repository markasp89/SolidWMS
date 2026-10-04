import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatDateTime } from '@/core/format'
import { useAsync } from '@/core/hooks/useAsync'
import { Extension, useModuleEnabled } from '@/core/modules/registry'
import { Button } from '@/core/ui/Button'
import { useFeedback } from '@/core/ui/feedback'
import { Card, ColorDot, EmptyState, ErrorMessage, PageHeader, Spinner } from '@/core/ui/misc'
import { inventoryApi, LocationList, MovementList, notifyStockChanged, useStockVersion } from '@/modules/inventory'
import { palletsApi } from './api'
import { AddToPalletModal, MovePalletModal } from './PalletModals'

export function PalletPage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { toast, confirm } = useFeedback()
  const version = useStockVersion()
  const labels = useModuleEnabled('labels')
  const [moving, setMoving] = useState(false)
  const [adding, setAdding] = useState(false)
  const { data: pallet, error, loading, reload } = useAsync((signal) => palletsApi.byCode(code!, signal), [code, version])
  const history = useAsync(
    (signal) => (pallet ? inventoryApi.movements({ pallet_id: pallet.id }, signal) : Promise.resolve(null)),
    [pallet?.id, version],
  )

  if (error) return <ErrorMessage error={error} onRetry={reload} />
  if (loading && !pallet) return <Spinner />
  if (!pallet) return null

  const remove = async () => {
    const ok = await confirm({ title: 'Usunąć paletę?', message: `Pusta paleta ${pallet.code} zostanie usunięta.`, confirmLabel: 'Usuń', danger: true })
    if (!ok) return
    try {
      await palletsApi.remove(pallet.id)
      toast('Paleta usunięta.')
      navigate('/pallets')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const items = pallet.items ?? []

  return (
    <>
      <PageHeader
        back={
          <Link to="/pallets" className="link-muted">
            ← Palety
          </Link>
        }
        title={<span className="pallet-code">{pallet.code}</span>}
        subtitle={
          pallet.sector ? (
            <Link to={`/warehouses/${pallet.sector.warehouse?.id}?sector=${pallet.sector.id}`} className="location-where">
              <ColorDot color={pallet.sector.color} /> {pallet.sector.warehouse?.code} › <strong>{pallet.sector.code}</strong>
              {pallet.slot && `-${pallet.slot}`} · {pallet.sector.name}
            </Link>
          ) : (
            'Paleta nie ma przypisanego miejsca'
          )
        }
        actions={
          <>
            <Button variant="primary" icon="move" onClick={() => setMoving(true)}>
              Przenieś paletę
            </Button>
            <Button icon="plus" onClick={() => setAdding(true)} disabled={!pallet.sector}>
              Dodaj towar
            </Button>
            {labels && (
              <Button icon="qr" onClick={() => navigate(`/labels?pallet=${encodeURIComponent(pallet.code)}`)}>
                Etykieta
              </Button>
            )}
            {items.length === 0 && <Button icon="trash" variant="ghost" onClick={remove} aria-label="Usuń paletę" title="Usuń paletę" />}
          </>
        }
      />
      {pallet.note && <p className="muted">{pallet.note}</p>}
      <p className="location-meta">
        Utworzył(a) {pallet.created_by?.name ?? '—'} {formatDateTime(pallet.created_at)}
        {pallet.moved_at && ` · ostatnio przeniósł(a) ${pallet.moved_by?.name ?? '—'} ${formatDateTime(pallet.moved_at)}`}
      </p>

      <div className="split">
        <div className="split-main">
          <Card title={`Zawartość (${items.length})`}>
            {items.length ? (
              <LocationList items={items} show="product" hidePallet onChanged={notifyStockChanged} />
            ) : (
              <EmptyState icon="pallet" title="Paleta jest pusta" />
            )}
          </Card>
          <Card title="Historia palety">
            {history.data?.data.length ? <MovementList movements={history.data.data} /> : <EmptyState icon="history" title="Brak operacji" />}
          </Card>
        </div>
        <aside className="split-side">
          <Extension name="pallet.sidebar" props={{ pallet }} />
        </aside>
      </div>

      {moving && (
        <MovePalletModal
          pallet={pallet}
          onClose={() => setMoving(false)}
          onDone={(p) => {
            setMoving(false)
            toast(`Paleta przeniesiona do ${p.sector?.code ?? ''}${p.slot ? `-${p.slot}` : ''}.`)
            notifyStockChanged()
          }}
        />
      )}
      {adding && (
        <AddToPalletModal
          pallet={pallet}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false)
            toast('Dodano towar na paletę.')
            notifyStockChanged()
          }}
        />
      )}
    </>
  )
}
