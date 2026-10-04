import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, type Paginated } from '@/core/api/client'
import { labelCode } from '@/core/codes'
import { useAsync } from '@/core/hooks/useAsync'
import { useModuleEnabled } from '@/core/modules/registry'
import { Button } from '@/core/ui/Button'
import { Card, EmptyState, PageHeader, Spinner } from '@/core/ui/misc'
import { loadSectorsCached, ProductPicker, type Product } from '@/modules/inventory'
import { QrCode } from './QrCode'

interface Label {
  key: string
  code: string
  title: string
  subtitle: string
  color?: string
}

interface PalletRow {
  id: number
  code: string
  note: string | null
  slot: string | null
  sector?: { code: string; warehouse: { code: string } | null } | null
}

type Size = 'small' | 'large'

/** Printable QR labels for sectors, pallets and products. */
export function LabelsPage() {
  const [params] = useSearchParams()
  const palletsEnabled = useModuleEnabled('pallets')
  const [tab, setTab] = useState<'sectors' | 'pallets' | 'products'>(params.get('pallet') ? 'pallets' : params.get('product') ? 'products' : 'sectors')
  const [selected, setSelected] = useState<Map<string, Label>>(new Map())
  const [size, setSize] = useState<Size>('small')
  const [warehouseId, setWarehouseId] = useState<number | ''>('')
  const [product, setProduct] = useState<Product | null>(null)

  const warehouses = useAsync(() => loadSectorsCached(), [])
  const pallets = useAsync(
    (signal) => (palletsEnabled ? api.get<Paginated<PalletRow>>('/pallets', { per_page: 100 }, signal) : Promise.resolve(null)),
    [palletsEnabled],
  )

  const sectorLabels = useMemo<Label[]>(() => {
    const list = warehouses.data ?? []
    return list
      .filter((w) => warehouseId === '' || w.id === warehouseId)
      .flatMap((w) =>
        (w.sectors ?? []).map((s) => ({
          key: `s${s.id}`,
          code: labelCode.sector(s.id),
          title: s.code,
          subtitle: `${w.code} · ${s.name}`,
          color: s.color,
        })),
      )
  }, [warehouses.data, warehouseId])

  const palletLabels = useMemo<Label[]>(
    () =>
      (pallets.data?.data ?? []).map((p) => ({
        key: `p${p.id}`,
        code: labelCode.pallet(p.code),
        title: p.code,
        subtitle: p.sector ? `${p.sector.warehouse?.code ?? ''}/${p.sector.code}${p.slot ? `-${p.slot}` : ''}${p.note ? ` · ${p.note}` : ''}` : (p.note ?? ''),
      })),
    [pallets.data],
  )

  // Preselect from links like /labels?sector=12 or /labels?pallet=P-00001.
  useEffect(() => {
    const sector = params.get('sector')
    const pallet = params.get('pallet')
    const label = sector
      ? sectorLabels.find((l) => l.code === labelCode.sector(Number(sector)))
      : pallet
        ? palletLabels.find((l) => l.title === pallet)
        : undefined
    if (label) setSelected((prev) => (prev.has(label.key) ? prev : new Map(prev).set(label.key, label)))
  }, [params, sectorLabels, palletLabels])

  const toggle = (label: Label) =>
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(label.key)) next.delete(label.key)
      else next.set(label.key, label)
      return next
    })

  const selectAll = (labels: Label[], on: boolean) =>
    setSelected((prev) => {
      const next = new Map(prev)
      labels.forEach((l) => (on ? next.set(l.key, l) : next.delete(l.key)))
      return next
    })

  const list = tab === 'sectors' ? sectorLabels : tab === 'pallets' ? palletLabels : []
  const chosen = [...selected.values()]

  return (
    <>
      <div className="no-print">
        <PageHeader
          title="Etykiety QR"
          subtitle="Naklej etykiety na sektory i palety – pracownik skanuje je telefonem zamiast wybierać z listy."
          actions={
            <>
              <select className="input" value={size} onChange={(e) => setSize(e.target.value as Size)} aria-label="Rozmiar etykiet">
                <option value="small">Małe (3 w rzędzie)</option>
                <option value="large">Duże (2 w rzędzie)</option>
              </select>
              <Button variant="primary" icon="printer" disabled={chosen.length === 0} onClick={() => window.print()}>
                Drukuj ({chosen.length})
              </Button>
            </>
          }
        />

        <Card>
          <div className="tabs" role="tablist">
            <button type="button" className={tab === 'sectors' ? 'is-active' : ''} onClick={() => setTab('sectors')}>
              Sektory
            </button>
            {palletsEnabled && (
              <button type="button" className={tab === 'pallets' ? 'is-active' : ''} onClick={() => setTab('pallets')}>
                Palety
              </button>
            )}
            <button type="button" className={tab === 'products' ? 'is-active' : ''} onClick={() => setTab('products')}>
              Produkty
            </button>
          </div>

          {tab === 'sectors' && (
            <div className="filters labels-filters">
              <select className="input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : '')} aria-label="Magazyn">
                <option value="">Wszystkie magazyny</option>
                {warehouses.data?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} – {w.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {tab === 'products' ? (
            <div className="labels-product">
              <ProductPicker name="product" label="Dodaj produkt" value={product} onChange={setProduct} />
              {product && (
                <Button
                  icon="plus"
                  onClick={() => {
                    const label = { key: `i${product.id}`, code: labelCode.product(product.sku), title: product.sku, subtitle: product.name }
                    setSelected((prev) => new Map(prev).set(label.key, label))
                    setProduct(null)
                  }}
                >
                  Dodaj do wydruku
                </Button>
              )}
            </div>
          ) : warehouses.loading && !warehouses.data ? (
            <Spinner />
          ) : list.length === 0 ? (
            <EmptyState icon="qr" title="Brak pozycji" />
          ) : (
            <>
              <div className="button-row">
                <Button size="sm" onClick={() => selectAll(list, true)}>
                  Zaznacz wszystkie
                </Button>
                <Button size="sm" variant="ghost" onClick={() => selectAll(list, false)}>
                  Odznacz
                </Button>
              </div>
              <ul className="labels-pick">
                {list.map((l) => (
                  <li key={l.key}>
                    <label className="checkbox">
                      <input type="checkbox" checked={selected.has(l.key)} onChange={() => toggle(l)} />
                      <span>
                        {l.color && <span className="color-dot" style={{ background: l.color }} />} <strong>{l.title}</strong>{' '}
                        <span className="muted">{l.subtitle}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        {chosen.length > 0 && <h2 className="section-title">Podgląd wydruku</h2>}
      </div>

      <div className={`label-sheet label-sheet-${size}`}>
        {chosen.map((l) => (
          <div key={l.key} className="label" style={l.color ? { borderLeftColor: l.color } : undefined}>
            <QrCode value={l.code} size={size === 'small' ? 110 : 170} />
            <div className="label-text">
              <div className="label-title">{l.title}</div>
              <div className="label-subtitle">{l.subtitle}</div>
              <div className="label-brand">SolidWMS</div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
