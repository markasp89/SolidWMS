import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { isQueued } from '@/core/api/client'
import { useAuth } from '@/core/auth/AuthContext'
import { formatNumber } from '@/core/format'
import { useAsync } from '@/core/hooks/useAsync'
import { Extension } from '@/core/modules/registry'
import { Button } from '@/core/ui/Button'
import { useFeedback } from '@/core/ui/feedback'
import { Card, EmptyState, ErrorMessage, PageHeader, Spinner } from '@/core/ui/misc'
import { inventoryApi } from '../api'
import { LocationList } from '../components/LocationList'
import { LocationsMap } from '../components/LocationsMap'
import { MovementList } from '../components/MovementList'
import { ProductFormModal } from '../components/ProductFormModal'
import { ReceiveModal } from '../components/StockModals'
import { notifyStockChanged, useStockVersion } from '../stockEvents'

export function ProductDetailPage() {
  const { id } = useParams()
  const { isManager } = useAuth()
  const { toast, confirm } = useFeedback()
  const navigate = useNavigate()
  const version = useStockVersion()
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)

  const { data: product, error, loading, reload, setData } = useAsync(
    (signal) => inventoryApi.product(id!, signal),
    [id, version],
  )
  const history = useAsync((signal) => inventoryApi.movements({ product_id: Number(id) }, signal), [id, version])

  const remove = async () => {
    if (!product) return
    const ok = await confirm({
      title: 'Usunąć produkt?',
      message: `Produkt ${product.name} zostanie usunięty razem ze wszystkimi lokalizacjami i historią.`,
      confirmLabel: 'Usuń',
      danger: true,
    })
    if (!ok) return
    try {
      await inventoryApi.deleteProduct(product.id)
      toast('Produkt usunięty.')
      navigate('/products')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  if (error) return <ErrorMessage error={error} onRetry={reload} />
  if (loading && !product) return <Spinner />
  if (!product) return null

  const locations = product.locations ?? []

  return (
    <>
      <PageHeader
        back={
          <Link to="/products" className="link-muted">
            ← Produkty
          </Link>
        }
        title={product.name}
        subtitle={
          <>
            <code>{product.sku}</code>
            {product.barcode && <> · kod: {product.barcode}</>} · łącznie{' '}
            <strong>
              {formatNumber(product.total_quantity)} {product.unit}
            </strong>
          </>
        }
        actions={
          <>
            <Button icon="edit" onClick={() => setEditing(true)}>
              Edytuj
            </Button>
            {isManager && <Button icon="trash" variant="ghost" onClick={remove} aria-label="Usuń produkt" title="Usuń produkt" />}
          </>
        }
      />
      {product.description && <p className="muted">{product.description}</p>}

      <div className="split">
        <div className="split-main">
          <Card
            title={`Lokalizacje (${locations.length})`}
            actions={
              <Button size="sm" variant="primary" icon="plus" onClick={() => setAdding(true)}>
                Dodaj lokalizację
              </Button>
            }
          >
            {locations.length === 0 ? (
              <EmptyState icon="pin" title="Produkt nie ma jeszcze lokalizacji">
                Dodaj sektor, w którym leży towar.
              </EmptyState>
            ) : (
              <LocationList items={locations} show="location" onChanged={notifyStockChanged} />
            )}
          </Card>
        </div>
        <aside className="split-side">
          <Extension name="product.sidebar" props={{ product, onChanged: reload }} />
          <LocationsMap items={locations} />
        </aside>
      </div>

      <Card title="Historia">
        {history.data && history.data.data.length > 0 ? (
          <MovementList movements={history.data.data} showProduct={false} />
        ) : history.loading ? (
          <Spinner />
        ) : (
          <EmptyState icon="history" title="Brak operacji" />
        )}
        {history.data && history.data.meta.total > history.data.data.length && (
          <Link to={`/movements?product_id=${product.id}`}>Pełna historia ({history.data.meta.total})</Link>
        )}
      </Card>

      {editing && (
        <ProductFormModal
          product={product}
          onClose={() => setEditing(false)}
          onSaved={(p) => {
            setEditing(false)
            setData(p)
            toast('Zapisano zmiany.')
          }}
        />
      )}
      {adding && (
        <ReceiveModal
          product={product}
          onClose={() => setAdding(false)}
          onDone={(result) => {
            setAdding(false)
            toast(isQueued(result) ? 'Brak sieci – operacja czeka w kolejce.' : 'Dodano lokalizację.', isQueued(result) ? 'info' : 'success')
            notifyStockChanged()
          }}
        />
      )}
    </>
  )
}
