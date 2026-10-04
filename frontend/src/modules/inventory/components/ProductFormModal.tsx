import { collectErrors, FormModal, rules, TextAreaField, TextField, toNumber, useForm } from '@/core/ui/form'
import { inventoryApi } from '../api'
import type { Product } from '../types'
import { SectorSelect } from './SectorSelect'
import { DimensionFields } from './StockModals'

interface Props {
  product?: Product
  onClose: () => void
  onSaved: (product: Product) => void
}

export function ProductFormModal({ product, onClose, onSaved }: Props) {
  const form = useForm(
    {
      sku: product?.sku ?? '',
      name: product?.name ?? '',
      barcode: product?.barcode ?? '',
      unit: product?.unit ?? 'szt',
      description: product?.description ?? '',
      sector_id: '' as number | '',
      quantity: '',
      slot: '',
      batch: '',
      expires_at: '',
    },
    {
      validate: (v) =>
        collectErrors([
          ['sku', rules.required(v.sku)],
          ['name', rules.required(v.name)],
          ['unit', rules.required(v.unit)],
          // The initial location is optional, but needs both parts.
          ['quantity', !product && v.sector_id !== '' && (rules.required(v.quantity) ?? rules.positive(v.quantity))],
          ['sector_id', !product && v.quantity.trim() !== '' && v.sector_id === '' && 'Wybierz sektor.'],
        ]),
      onSubmit: async ({ sector_id, quantity, slot, batch, expires_at, ...data }) => {
        const saved = product
          ? await inventoryApi.updateProduct(product.id, data)
          : await inventoryApi.createProduct({
              ...data,
              initial_stock:
                sector_id !== ''
                  ? { sector_id, quantity: toNumber(quantity), slot: slot || null, batch: batch || null, expires_at: expires_at || null }
                  : undefined,
            })
        onSaved(saved)
      },
    },
  )

  return (
    <FormModal title={product ? `Edycja: ${product.name}` : 'Nowy produkt'} form={form} onClose={onClose} size="lg">
      <div className="form-row">
        <TextField form={form} name="sku" label="SKU / indeks" required maxLength={64} className="w-sm" />
        <TextField form={form} name="name" label="Nazwa" required maxLength={255} />
      </div>
      <div className="form-row">
        <TextField form={form} name="barcode" label="Kod kreskowy" maxLength={64} />
        <TextField form={form} name="unit" label="Jednostka" required maxLength={16} className="w-sm" />
      </div>
      <TextAreaField form={form} name="description" label="Opis" />

      {!product && (
        <fieldset className="fieldset">
          <legend>Gdzie leży? (opcjonalnie)</legend>
          <SectorSelect
            name="sector_id"
            label="Sektor"
            value={form.values.sector_id}
            onChange={(v) => form.set('sector_id', v)}
            error={form.errors.sector_id ?? form.errors['initial_stock.sector_id']}
          />
          <DimensionFields form={form} />
          <TextField form={form} name="quantity" label="Ilość" inputMode="decimal" className="w-sm" />
        </fieldset>
      )}
    </FormModal>
  )
}
