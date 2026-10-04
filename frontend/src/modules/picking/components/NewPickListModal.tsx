import { useEffect } from 'react'
import { useAsync } from '@/core/hooks/useAsync'
import { Button } from '@/core/ui/Button'
import { collectErrors, Field, FormModal, rules, SelectField, TextField, toNumber, useForm, type FormErrors } from '@/core/ui/form'
import { ProductPicker, type Product } from '@/modules/inventory'
import { warehousesApi } from '@/modules/warehouses'
import { pickingApi } from '../api'
import type { PickListDetail } from '../types'

interface Row {
  key: number
  product: Product | null
  quantity: string
}

interface Values {
  warehouse_id: string
  note: string
  items: Row[]
}

let nextKey = 1
const emptyRow = (): Row => ({ key: nextKey++, product: null, quantity: '' })

interface Props {
  onClose: () => void
  onCreated: (list: PickListDetail) => void
}

/** Creates a pick list from ordered products; the server allocates locations (FEFO) and sorts them. */
export function NewPickListModal({ onClose, onCreated }: Props) {
  const warehouses = useAsync((signal) => warehousesApi.list(signal), [])
  const form = useForm<Values>(
    { warehouse_id: '', note: '', items: [emptyRow()] },
    {
      validate: (v) => {
        const filled = v.items.filter((row) => row.product || row.quantity.trim())
        return collectErrors([
          ['warehouse_id', rules.required(v.warehouse_id, 'Wybierz magazyn.')],
          ['items', filled.length === 0 && 'Dodaj co najmniej jeden produkt.'],
          ...v.items.flatMap((row, i): Array<[string, string | null | false]> =>
            // Completely empty rows are skipped (unless it is the only one).
            !row.product && !row.quantity.trim() && filled.length > 0
              ? []
              : [
                  [`items.${i}.product_id`, !row.product && 'Wybierz produkt.'],
                  [`items.${i}.quantity`, rules.required(row.quantity) ?? rules.positive(row.quantity)],
                ],
          ),
        ])
      },
      onSubmit: async (v) => {
        const rows = v.items.filter((row) => row.product)
        onCreated(
          await pickingApi.create({
            warehouse_id: Number(v.warehouse_id),
            note: v.note.trim() || null,
            items: rows.map((row) => ({ product_id: row.product!.id, quantity: toNumber(row.quantity) })),
          }),
        )
      },
    },
  )
  const { values, errors } = form

  const onlyWarehouse = warehouses.data?.length === 1 ? String(warehouses.data[0].id) : null
  useEffect(() => {
    if (onlyWarehouse) form.setValues({ warehouse_id: onlyWarehouse })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyWarehouse])

  const clearErrors = (prefix: string) => {
    const next: FormErrors = {}
    for (const [key, message] of Object.entries(errors)) if (!key.startsWith(prefix)) next[key] = message
    form.setErrors(next)
  }

  const updateRow = (index: number, patch: Partial<Row>) => {
    form.setValues({ items: values.items.map((row, i) => (i === index ? { ...row, ...patch } : row)) })
    for (const field of Object.keys(patch)) clearErrors(`items.${index}.${field === 'product' ? 'product_id' : field}`)
  }

  const addRow = () => {
    form.setValues({ items: [...values.items, emptyRow()] })
    clearErrors('items')
  }

  const removeRow = (index: number) => {
    form.setValues({ items: values.items.filter((_, i) => i !== index) })
    // Indexes shift, so per-row messages would point at the wrong rows.
    clearErrors('items.')
  }

  return (
    <FormModal title="Nowa lista kompletacyjna" form={form} onClose={onClose} submitLabel="Utwórz listę" size="lg">
      <SelectField
        form={form}
        name="warehouse_id"
        label="Magazyn"
        required
        placeholder={warehouses.data ? '— wybierz magazyn —' : 'Ładowanie…'}
        options={(warehouses.data ?? []).map((w) => ({ value: w.id, label: `${w.code} – ${w.name}` }))}
      />

      <div className="pick-items">
        <div className="field-label">Produkty do zebrania *</div>
        {errors.items && !form.formError && (
          <div className="alert alert-error" role="alert">
            {errors.items}
          </div>
        )}
        {values.items.map((row, index) => (
          <div key={row.key} className="pick-item-row">
            <div className="pick-item-product">
              <ProductPicker
                name={`items.${index}.product_id`}
                label={`Produkt ${index + 1}`}
                value={row.product}
                onChange={(product) => updateRow(index, { product })}
                error={errors[`items.${index}.product_id`]}
              />
              {row.product && errors[`items.${index}.product_id`] && (
                <p className="field-error">{errors[`items.${index}.product_id`]}</p>
              )}
            </div>
            <div className="pick-item-qty">
              <Field label={`Ilość${row.product ? ` (${row.product.unit})` : ''}`} required error={errors[`items.${index}.quantity`]}>
                {(id, describedBy) => (
                  <input
                    id={id}
                    name={`items.${index}.quantity`}
                    className="input"
                    inputMode="decimal"
                    aria-invalid={errors[`items.${index}.quantity`] ? true : undefined}
                    aria-describedby={describedBy}
                    value={row.quantity}
                    onChange={(e) => updateRow(index, { quantity: e.target.value })}
                  />
                )}
              </Field>
              {values.items.length > 1 && (
                <Button variant="ghost" icon="trash" title="Usuń produkt" aria-label={`Usuń produkt ${index + 1}`} onClick={() => removeRow(index)} />
              )}
            </div>
          </div>
        ))}
        <div>
          <Button size="sm" icon="plus" onClick={addRow}>
            Dodaj produkt
          </Button>
        </div>
      </div>

      <TextField form={form} name="note" label="Uwagi" maxLength={255} placeholder="np. zamówienie 1234, klient…" />
      <p className="muted">Lokalizacje zostaną dobrane automatycznie (najpierw najkrótszy termin ważności) i ułożone w kolejności przejścia.</p>
    </FormModal>
  )
}
