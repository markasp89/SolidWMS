import { useModuleEnabled } from '@/core/modules/registry'
import { collectErrors, FormModal, rules, TextField, toNumber, useForm } from '@/core/ui/form'
import { ProductPicker, SectorSelect, type Product, type StockItem } from '@/modules/inventory'
import { palletsApi, type Pallet } from './api'

export function NewPalletModal({ sectorId, onClose, onSaved }: { sectorId?: number; onClose: () => void; onSaved: (p: Pallet) => void }) {
  const slots = useModuleEnabled('slots')
  const form = useForm(
    { sector_id: (sectorId ?? '') as number | '', slot: '', code: '', note: '' },
    {
      validate: (v) =>
        collectErrors([
          ['sector_id', rules.required(v.sector_id, 'Wybierz, gdzie stoi paleta.')],
          ['code', v.code.trim() !== '' && rules.code(v.code)],
        ]),
      onSubmit: async (v) =>
        onSaved(
          await palletsApi.create({
            sector_id: Number(v.sector_id),
            slot: v.slot || null,
            code: v.code || null,
            note: v.note || null,
          }),
        ),
    },
  )

  return (
    <FormModal title="Nowa paleta" form={form} onClose={onClose} submitLabel="Utwórz paletę">
      {!sectorId && (
        <SectorSelect name="sector_id" label="Gdzie stoi" required value={form.values.sector_id} onChange={(v) => form.set('sector_id', v)} error={form.errors.sector_id} />
      )}
      <div className="form-row">
        {slots && <TextField form={form} name="slot" label="Miejsce" maxLength={32} className="w-sm" />}
        <TextField form={form} name="code" label="Numer palety" maxLength={32} placeholder="automatycznie (P-00001)" />
      </div>
      <TextField form={form} name="note" label="Opis" maxLength={255} placeholder="np. dostawa od Pakmar, towar mieszany" />
    </FormModal>
  )
}

export function MovePalletModal({ pallet, onClose, onDone }: { pallet: Pallet; onClose: () => void; onDone: (p: Pallet) => void }) {
  const slots = useModuleEnabled('slots')
  const form = useForm(
    { to_sector_id: '' as number | '', to_slot: '', note: '' },
    {
      validate: (v) => collectErrors([['to_sector_id', rules.required(v.to_sector_id, 'Wybierz nowe miejsce.')]]),
      onSubmit: async (v) =>
        onDone(await palletsApi.move(pallet.id, { to_sector_id: Number(v.to_sector_id), to_slot: v.to_slot || null, note: v.note || undefined })),
    },
  )

  return (
    <FormModal title={`Przenieś paletę ${pallet.code}`} form={form} onClose={onClose} submitLabel="Przenieś">
      <p className="muted">Cała zawartość palety ({pallet.items_count ?? 0} pozycji) zmieni miejsce jednym ruchem.</p>
      <SectorSelect
        name="to_sector_id"
        label="Nowe miejsce"
        required
        value={form.values.to_sector_id}
        onChange={(v) => form.set('to_sector_id', v)}
        error={form.errors.to_sector_id}
        defaultWarehouseId={pallet.sector?.warehouse?.id}
      />
      <div className="form-row">
        {slots && <TextField form={form} name="to_slot" label="Miejsce" maxLength={32} className="w-sm" />}
        <TextField form={form} name="note" label="Uwagi" maxLength={255} />
      </div>
    </FormModal>
  )
}

export function AddToPalletModal({ pallet, onClose, onDone }: { pallet: Pallet; onClose: () => void; onDone: (item: StockItem) => void }) {
  const batches = useModuleEnabled('batches')
  const form = useForm(
    { product: null as Product | null, quantity: '', batch: '', expires_at: '', note: '' },
    {
      validate: (v) =>
        collectErrors([
          ['product', !v.product && 'Wybierz produkt.'],
          ['quantity', rules.required(v.quantity) ?? rules.positive(v.quantity)],
        ]),
      onSubmit: async (v) =>
        onDone(
          await palletsApi.addItem(pallet.id, {
            product_id: v.product!.id,
            quantity: toNumber(v.quantity),
            batch: v.batch || null,
            expires_at: v.expires_at || null,
            note: v.note || undefined,
          }),
        ),
    },
  )

  return (
    <FormModal title={`Dodaj towar na paletę ${pallet.code}`} form={form} onClose={onClose} submitLabel="Dodaj">
      <ProductPicker name="product" value={form.values.product} onChange={(p) => form.set('product', p)} error={form.errors.product} />
      <div className="form-row">
        <TextField form={form} name="quantity" label={`Ilość${form.values.product ? ` (${form.values.product.unit})` : ''}`} required inputMode="decimal" className="w-sm" />
        {batches && (
          <>
            <TextField form={form} name="batch" label="Partia" maxLength={64} />
            <TextField form={form} name="expires_at" label="Ważne do" type="date" className="w-md" />
          </>
        )}
      </div>
      <TextField form={form} name="note" label="Uwagi" maxLength={255} />
    </FormModal>
  )
}
