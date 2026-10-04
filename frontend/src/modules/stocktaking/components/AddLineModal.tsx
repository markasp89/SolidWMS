import { collectErrors, FormModal, rules, TextField, toNumber, useForm } from '@/core/ui/form'
import { DimensionFields, ProductPicker, type Product } from '@/modules/inventory'
import { stocktakingApi } from '../api'
import type { StocktakeDetail } from '../types'

interface Props {
  stocktakeId: number
  onClose: () => void
  onAdded: (stocktake: StocktakeDetail) => void
}

/** A product found in the sector that the system did not know about. */
export function AddLineModal({ stocktakeId, onClose, onAdded }: Props) {
  const form = useForm(
    { product: null as Product | null, counted: '', slot: '', batch: '', expires_at: '' },
    {
      validate: (v) =>
        collectErrors([
          ['product', !v.product && 'Wybierz produkt.'],
          ['counted', rules.required(v.counted) ?? rules.positive(v.counted)],
        ]),
      onSubmit: async (v) =>
        onAdded(
          await stocktakingApi.addLine(stocktakeId, {
            product_id: v.product!.id,
            counted: toNumber(v.counted),
            slot: v.slot.trim() || null,
            batch: v.batch.trim() || null,
            expires_at: v.expires_at || null,
          }),
        ),
    },
  )

  return (
    <FormModal title="Dodaj znaleziony produkt" form={form} onClose={onClose} submitLabel="Dodaj" size="lg">
      <ProductPicker
        name="product"
        value={form.values.product}
        onChange={(p) => form.set('product', p)}
        error={form.errors.product ?? form.errors.product_id}
      />
      <TextField
        form={form}
        name="counted"
        label={`Policzona ilość${form.values.product ? ` (${form.values.product.unit})` : ''}`}
        required
        inputMode="decimal"
        autoComplete="off"
        className="w-sm"
      />
      <DimensionFields form={form} />
    </FormModal>
  )
}
