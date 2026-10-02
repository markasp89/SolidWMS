import { formatNumber } from '@/core/format'
import { collectErrors, FormModal, rules, TextField, toNumber, useForm } from '@/core/ui/form'
import { inventoryApi, isDeleted } from '../api'
import type { Product, StockItem } from '../types'
import { ProductPicker } from './ProductPicker'
import { SectorSelect } from './SectorSelect'

const UNITS = ['szt', 'opak', 'kg', 'm', 'l', 'paleta', 'karton', 'rol', 'worek', 'para']

/* Receive (put goods into a sector) ---------------------------------------- */

interface ReceiveProps {
  /** Fixed target sector (e.g. opened from the map). */
  sectorId?: number
  sectorLabel?: string
  /** Fixed product (e.g. opened from the product page). */
  product?: Product
  onClose: () => void
  onDone: (item: StockItem) => void
}

export function ReceiveModal({ sectorId, sectorLabel, product, onClose, onDone }: ReceiveProps) {
  const form = useForm(
    {
      tab: 'existing' as 'existing' | 'new',
      product: product ?? (null as Product | null),
      sku: '',
      name: '',
      unit: 'szt',
      sector_id: (sectorId ?? '') as number | '',
      quantity: '',
      note: '',
    },
    {
      validate: (v) =>
        collectErrors([
          ['product', v.tab === 'existing' && !v.product && 'Wybierz produkt.'],
          ['sku', v.tab === 'new' && rules.required(v.sku)],
          ['name', v.tab === 'new' && rules.required(v.name)],
          ['sector_id', rules.required(v.sector_id, 'Wybierz sektor.')],
          ['quantity', rules.required(v.quantity) ?? rules.positive(v.quantity)],
        ]),
      onSubmit: async (v) => {
        const quantity = toNumber(v.quantity)
        const note = v.note || undefined
        if (v.tab === 'new') {
          const created = await inventoryApi.createProduct({
            sku: v.sku,
            name: v.name,
            unit: v.unit,
            barcode: '',
            description: '',
            initial_stock: { sector_id: Number(v.sector_id), quantity, note },
          })
          onDone(created.locations!.find((l) => l.sector_id === Number(v.sector_id))!)
        } else {
          onDone(await inventoryApi.receive({ product_id: v.product!.id, sector_id: Number(v.sector_id), quantity, note }))
        }
      },
    },
  )
  const unit = form.values.tab === 'new' ? form.values.unit : form.values.product?.unit

  return (
    <FormModal
      title={sectorLabel ? `Dodaj towar do sektora ${sectorLabel}` : `Dodaj lokalizację – ${product?.name ?? 'produkt'}`}
      form={form}
      onClose={onClose}
      submitLabel="Dodaj"
    >
      {!product && (
        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={form.values.tab === 'existing'}
            className={form.values.tab === 'existing' ? 'is-active' : ''}
            onClick={() => form.set('tab', 'existing')}
          >
            Istniejący produkt
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={form.values.tab === 'new'}
            className={form.values.tab === 'new' ? 'is-active' : ''}
            onClick={() => form.set('tab', 'new')}
          >
            Nowy produkt
          </button>
        </div>
      )}

      {form.values.tab === 'existing' ? (
        !product && (
          <ProductPicker
            name="product"
            value={form.values.product}
            onChange={(p) => form.set('product', p)}
            error={form.errors.product ?? form.errors.product_id}
          />
        )
      ) : (
        <>
          <div className="form-row">
            <TextField form={form} name="sku" label="SKU / indeks" required maxLength={64} className="w-sm" />
            <TextField form={form} name="name" label="Nazwa produktu" required maxLength={255} />
          </div>
          <TextField form={form} name="unit" label="Jednostka" list="units" maxLength={16} className="w-sm" />
          <datalist id="units">
            {UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </>
      )}

      {!sectorId && (
        <SectorSelect
          name="sector_id"
          label="Sektor"
          required
          value={form.values.sector_id}
          onChange={(v) => form.set('sector_id', v)}
          error={form.errors.sector_id ?? form.errors['initial_stock.sector_id']}
        />
      )}

      <div className="form-row">
        <TextField
          form={form}
          name="quantity"
          label={`Ilość${unit ? ` (${unit})` : ''}`}
          required
          inputMode="decimal"
          className="w-sm"
        />
        <TextField form={form} name="note" label="Uwagi" maxLength={255} placeholder="np. paleta przy słupie" />
      </div>
    </FormModal>
  )
}

/* Issue (take goods out) ---------------------------------------------------- */

interface ItemProps {
  item: StockItem
  onClose: () => void
  onDone: (item: StockItem | null) => void
}

const describe = (item: StockItem) =>
  `${item.product?.name ?? ''} – ${item.sector?.warehouse?.code ?? ''}/${item.sector?.code ?? ''}`

export function IssueModal({ item, onClose, onDone }: ItemProps) {
  const form = useForm(
    { quantity: '', note: '' },
    {
      validate: (v) =>
        collectErrors([
          [
            'quantity',
            rules.required(v.quantity) ??
              rules.positive(v.quantity) ??
              (toNumber(v.quantity) > item.quantity ? `Dostępne: ${formatNumber(item.quantity)}.` : null),
          ],
        ]),
      onSubmit: async (v) => {
        const result = await inventoryApi.issue(item.id, { quantity: toNumber(v.quantity), note: v.note || undefined })
        onDone(isDeleted(result) ? null : result)
      },
    },
  )

  return (
    <FormModal title={`Wydaj: ${describe(item)}`} form={form} onClose={onClose} submitLabel="Wydaj">
      <p className="muted">
        Obecnie: <strong>{formatNumber(item.quantity)} {item.product?.unit}</strong>
      </p>
      <div className="form-row">
        <TextField form={form} name="quantity" label="Ilość do wydania" required inputMode="decimal" className="w-sm" />
        <button type="button" className="link field-aside" onClick={() => form.set('quantity', String(item.quantity))}>
          wszystko
        </button>
      </div>
      <TextField form={form} name="note" label="Uwagi" maxLength={255} placeholder="np. numer zamówienia" />
    </FormModal>
  )
}

/* Move to another sector --------------------------------------------------- */

export function MoveModal({ item, onClose, onDone }: ItemProps) {
  const form = useForm(
    { to_sector_id: '' as number | '', quantity: String(item.quantity), note: '' },
    {
      validate: (v) =>
        collectErrors([
          ['to_sector_id', rules.required(v.to_sector_id, 'Wybierz sektor docelowy.')],
          [
            'quantity',
            rules.required(v.quantity) ??
              rules.positive(v.quantity) ??
              (toNumber(v.quantity) > item.quantity ? `Dostępne: ${formatNumber(item.quantity)}.` : null),
          ],
        ]),
      onSubmit: async (v) => {
        await inventoryApi.move(item.id, {
          to_sector_id: Number(v.to_sector_id),
          quantity: toNumber(v.quantity),
          note: v.note || undefined,
        })
        onDone(null)
      },
    },
  )

  return (
    <FormModal title={`Przenieś: ${describe(item)}`} form={form} onClose={onClose} submitLabel="Przenieś">
      <SectorSelect
        name="to_sector_id"
        label="Sektor docelowy"
        required
        value={form.values.to_sector_id}
        onChange={(v) => form.set('to_sector_id', v)}
        error={form.errors.to_sector_id}
        excludeSectorId={item.sector_id}
        defaultWarehouseId={item.sector?.warehouse?.id}
      />
      <div className="form-row">
        <TextField
          form={form}
          name="quantity"
          label={`Ilość (z ${formatNumber(item.quantity)} ${item.product?.unit ?? ''})`}
          required
          inputMode="decimal"
          className="w-sm"
        />
        <TextField form={form} name="note" label="Uwagi" maxLength={255} />
      </div>
    </FormModal>
  )
}

/* Adjust (stocktaking / edit note) ----------------------------------------- */

export function AdjustModal({ item, onClose, onDone }: ItemProps) {
  const form = useForm(
    { quantity: String(item.quantity), note: item.note ?? '' },
    {
      validate: (v) => collectErrors([['quantity', rules.nonNegative(v.quantity)]]),
      onSubmit: async (v) => {
        const result = await inventoryApi.adjust(item.id, { quantity: toNumber(v.quantity), note: v.note || null })
        onDone(isDeleted(result) ? null : result)
      },
    },
  )

  return (
    <FormModal title={`Edytuj: ${describe(item)}`} form={form} onClose={onClose}>
      <TextField
        form={form}
        name="quantity"
        label={`Faktyczna ilość (${item.product?.unit ?? ''})`}
        hint="Ustawienie 0 usuwa produkt z tego sektora. Zmiana ilości zapisuje się w historii jako korekta."
        required
        inputMode="decimal"
        className="w-sm"
      />
      <TextField form={form} name="note" label="Uwagi" maxLength={255} placeholder="np. górna półka, paleta przy bramie" />
    </FormModal>
  )
}
