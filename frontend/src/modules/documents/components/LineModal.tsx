import { useModuleEnabled } from '@/core/modules/registry'
import { collectErrors, FormModal, rules, TextField, useForm } from '@/core/ui/form'
import { ProductPicker, SectorSelect } from '@/modules/inventory'
import { emptyLine, type EditorLine } from '../lines'
import type { DocumentType } from '../types'

const SLOT_PATTERN = /^[A-Za-z0-9_.\-/ ]*$/

interface Props {
  type: DocumentType
  warehouseId: number
  line: EditorLine | null
  onSave: (line: EditorLine) => void
  onClose: () => void
}

/** Adds or edits one line of a PZ / WZ document. */
export function LineModal({ type, warehouseId, line, onSave, onClose }: Props) {
  const slots = useModuleEnabled('slots')
  const batches = useModuleEnabled('batches')
  const form = useForm<EditorLine>(line ?? emptyLine(), {
    validate: (v) =>
      collectErrors([
        ['product', !v.product && 'Wybierz produkt.'],
        ['quantity', rules.required(v.quantity) ?? rules.positive(v.quantity)],
        ['sector_id', type === 'PZ' && rules.required(v.sector_id, 'Wybierz sektor docelowy.')],
        ['slot', !SLOT_PATTERN.test(v.slot) && 'Dozwolone: litery, cyfry oraz - _ . /'],
      ]),
    onSubmit: (v) => {
      // A source location chosen for another product (WZ) no longer applies.
      const keepSource = line !== null && v.product?.id === line.product?.id
      onSave({ ...v, quantity: v.quantity.trim().replace(',', '.'), stock_item_id: keepSource ? v.stock_item_id : null })
      onClose()
    },
  })
  const unit = form.values.product?.unit

  return (
    <FormModal title={line ? 'Edytuj pozycję' : 'Dodaj pozycję'} form={form} onClose={onClose} submitLabel={line ? 'Zapisz' : 'Dodaj'} size="lg">
      <ProductPicker
        name="product"
        value={form.values.product}
        onChange={(p) => form.set('product', p)}
        error={form.errors.product}
      />

      <TextField form={form} name="quantity" label={`Ilość${unit ? ` (${unit})` : ''}`} required inputMode="decimal" className="w-sm" />

      {type === 'PZ' ? (
        <>
          <SectorSelect
            name="sector_id"
            label="Sektor docelowy"
            required
            warehouseId={warehouseId}
            value={form.values.sector_id}
            onChange={(id) => form.set('sector_id', id)}
            error={form.errors.sector_id}
          />
          {(slots || batches) && (
            <div className="form-row">
              {slots && <TextField form={form} name="slot" label="Miejsce w sektorze" maxLength={32} placeholder="np. 03-2" className="w-sm" hint="półka-poziom" />}
              {batches && (
                <>
                  <TextField form={form} name="batch" label="Partia" maxLength={64} />
                  <TextField form={form} name="expires_at" label="Ważne do" type="date" />
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {batches && (
            <TextField form={form} name="batch" label="Partia" maxLength={64} hint="Opcjonalnie – wydaj tylko z tej partii." />
          )}
          <p className="alert alert-info">
            Lokalizacje zostaną wybrane automatycznie przy zatwierdzaniu – najpierw towar z najkrótszym terminem ważności (FEFO).
          </p>
        </>
      )}

      <TextField form={form} name="note" label="Uwagi do pozycji" maxLength={255} />
    </FormModal>
  )
}
