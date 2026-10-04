import type { Queued } from '@/core/api/client'
import { formatNumber } from '@/core/format'
import { useAsync } from '@/core/hooks/useAsync'
import { useModuleEnabled } from '@/core/modules/registry'
import { collectErrors, FormModal, rules, TextField, toNumber, useForm, type FormApi } from '@/core/ui/form'
import { api } from '@/core/api/client'
import { inventoryApi, isDeleted } from '../api'
import type { Product, SectorSummary, StockItem } from '../types'
import { ProductPicker } from './ProductPicker'
import { SectorSelect } from './SectorSelect'

const UNITS = ['szt', 'opak', 'kg', 'm', 'l', 'paleta', 'karton', 'rol', 'worek', 'para']
const SLOT_PATTERN = /^[A-Za-z0-9_.\-/ ]*$/

/* Shared optional fields ----------------------------------------------------- */

type WithDims = { slot: string; batch: string; expires_at: string }

/** Slot (module "slots") and batch / expiry date (module "batches") inputs. */
function DimensionFields<T extends WithDims>({ form, withBatch = true }: { form: FormApi<T>; withBatch?: boolean }) {
  const slots = useModuleEnabled('slots')
  const batches = useModuleEnabled('batches') && withBatch
  if (!slots && !batches) return null

  return (
    <div className="form-row">
      {slots && (
        <TextField form={form} name="slot" label="Miejsce w sektorze" maxLength={32} placeholder="np. 03-2" className="w-sm" hint="półka-poziom" />
      )}
      {batches && (
        <>
          <TextField form={form} name="batch" label="Partia" maxLength={64} />
          <TextField form={form} name="expires_at" label="Ważne do" type="date" className="w-md" />
        </>
      )}
    </div>
  )
}

const slotRule = (slot: string) => (SLOT_PATTERN.test(slot) ? null : 'Dozwolone: litery, cyfry oraz - _ . /')

interface Suggestion {
  sector: SectorSummary
  slot: string | null
  quantity: number
  reason: 'stored' | 'history'
  label: string
}

/** "Already lies in A1-03-2" chips (module "suggestions"). */
function LocationSuggestions({ productId, onPick }: { productId: number; onPick: (s: Suggestion) => void }) {
  const { data } = useAsync((signal) => api.get<Suggestion[]>(`/products/${productId}/suggested-locations`, undefined, signal), [productId])
  if (!data?.length) return null

  return (
    <div className="suggestions">
      <span className="muted">Podpowiedź:</span>
      {data.map((s) => (
        <button key={`${s.sector.id}-${s.slot}`} type="button" className="chip" onClick={() => onPick(s)} title={s.label}>
          <span className="color-dot" style={{ background: s.sector.color }} />
          {s.sector.warehouse?.code}/{s.sector.code}
          {s.slot ? `-${s.slot}` : ''}
          <small>{s.reason === 'stored' ? `${formatNumber(s.quantity)} tu leży` : s.label}</small>
        </button>
      ))}
    </div>
  )
}

/* Receive (put goods into a sector) ------------------------------------------ */

interface ReceiveProps {
  /** Fixed target sector (e.g. opened from the map). */
  sectorId?: number
  sectorLabel?: string
  /** Fixed product (e.g. opened from the product page). */
  product?: Product
  onClose: () => void
  onDone: (item: StockItem | Queued) => void
}

export function ReceiveModal({ sectorId, sectorLabel, product, onClose, onDone }: ReceiveProps) {
  const suggestions = useModuleEnabled('suggestions')
  const form = useForm(
    {
      tab: 'existing' as 'existing' | 'new',
      product: product ?? (null as Product | null),
      sku: '',
      name: '',
      unit: 'szt',
      sector_id: (sectorId ?? '') as number | '',
      slot: '',
      batch: '',
      expires_at: '',
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
          ['slot', slotRule(v.slot)],
          ['quantity', rules.required(v.quantity) ?? rules.positive(v.quantity)],
        ]),
      onSubmit: async (v) => {
        const quantity = toNumber(v.quantity)
        const dims = { slot: v.slot || null, batch: v.batch || null, expires_at: v.expires_at || null }
        const note = v.note || undefined
        if (v.tab === 'new') {
          const created = await inventoryApi.createProduct({
            sku: v.sku,
            name: v.name,
            unit: v.unit,
            barcode: '',
            description: '',
            initial_stock: { sector_id: Number(v.sector_id), quantity, note, ...dims },
          })
          onDone(created.locations!.find((l) => l.sector_id === Number(v.sector_id))!)
        } else {
          onDone(await inventoryApi.receive({ product_id: v.product!.id, sector_id: Number(v.sector_id), quantity, note, ...dims }))
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
      size="lg"
    >
      {!product && (
        <div className="tabs" role="tablist">
          {(
            [
              ['existing', 'Istniejący produkt'],
              ['new', 'Nowy produkt'],
            ] as const
          ).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={form.values.tab === tab}
              className={form.values.tab === tab ? 'is-active' : ''}
              onClick={() => form.set('tab', tab)}
            >
              {label}
            </button>
          ))}
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
        <>
          {suggestions && form.values.tab === 'existing' && form.values.product && (
            <LocationSuggestions
              productId={form.values.product.id}
              onPick={(s) => form.setValues({ sector_id: s.sector.id, slot: s.slot ?? '' })}
            />
          )}
          <SectorSelect
            key={String(form.values.sector_id)}
            name="sector_id"
            label="Sektor"
            required
            value={form.values.sector_id}
            onChange={(v) => form.set('sector_id', v)}
            error={form.errors.sector_id ?? form.errors['initial_stock.sector_id']}
          />
        </>
      )}

      <DimensionFields form={form} />

      <div className="form-row">
        <TextField form={form} name="quantity" label={`Ilość${unit ? ` (${unit})` : ''}`} required inputMode="decimal" className="w-sm" />
        <TextField form={form} name="note" label="Uwagi" maxLength={255} placeholder="np. paleta przy słupie" />
      </div>
    </FormModal>
  )
}

/* Issue (take goods out) ---------------------------------------------------- */

interface ItemProps {
  item: StockItem
  onClose: () => void
  onDone: (item: StockItem | Queued | null) => void
}

export const describeLocation = (item: StockItem) =>
  `${item.sector?.warehouse?.code ?? ''}/${item.sector?.code ?? ''}${item.slot ? `-${item.slot}` : ''}`

const describe = (item: StockItem) => `${item.product?.name ?? ''} – ${describeLocation(item)}`

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
        {item.batch && <> · partia {item.batch}</>}
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

/* Move to another sector / slot ------------------------------------------ */

export function MoveModal({ item, onClose, onDone }: ItemProps) {
  const slots = useModuleEnabled('slots')
  const form = useForm(
    { to_sector_id: '' as number | '', to_slot: '', quantity: String(item.quantity), note: '' },
    {
      validate: (v) =>
        collectErrors([
          ['to_sector_id', rules.required(v.to_sector_id, 'Wybierz sektor docelowy.')],
          ['to_slot', slotRule(v.to_slot)],
          [
            'quantity',
            rules.required(v.quantity) ??
              rules.positive(v.quantity) ??
              (toNumber(v.quantity) > item.quantity ? `Dostępne: ${formatNumber(item.quantity)}.` : null),
          ],
        ]),
      onSubmit: async (v) => {
        const result = await inventoryApi.move(item.id, {
          to_sector_id: Number(v.to_sector_id),
          to_slot: v.to_slot || null,
          quantity: toNumber(v.quantity),
          note: v.note || undefined,
        })
        onDone(result)
      },
    },
  )

  return (
    <FormModal title={`Przenieś: ${describe(item)}`} form={form} onClose={onClose} submitLabel="Przenieś">
      {item.pallet && <p className="alert alert-info">Przeniesiony towar zostanie zdjęty z palety {item.pallet.code}.</p>}
      <SectorSelect
        name="to_sector_id"
        label="Sektor docelowy"
        required
        value={form.values.to_sector_id}
        onChange={(v) => form.set('to_sector_id', v)}
        error={form.errors.to_sector_id}
        excludeSectorId={slots ? undefined : item.sector_id}
        defaultWarehouseId={item.sector?.warehouse?.id}
      />
      <div className="form-row">
        {slots && <TextField form={form} name="to_slot" label="Miejsce" maxLength={32} placeholder="np. 01-2" className="w-sm" />}
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
        hint="Ustawienie 0 usuwa produkt z tego miejsca. Zmiana ilości zapisuje się w historii jako korekta."
        required
        inputMode="decimal"
        className="w-sm"
      />
      <TextField form={form} name="note" label="Uwagi" maxLength={255} placeholder="np. górna półka, paleta przy bramie" />
    </FormModal>
  )
}

export { DimensionFields }
