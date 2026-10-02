import { collectErrors, Field, FormModal, rules, TextAreaField, TextField, useForm } from '@/core/ui/form'
import { warehousesApi } from '../api'
import { SECTOR_COLORS } from '../geometry'
import type { Point, Sector } from '../types'

interface Props {
  warehouseId: number
  sector?: Sector
  /** Shape for a new sector (drawn on the plan). */
  shape?: Point[] | null
  suggestedCode?: string
  onClose: () => void
  onSaved: (sector: Sector) => void
}

export function SectorFormModal({ warehouseId, sector, shape, suggestedCode = '', onClose, onSaved }: Props) {
  const form = useForm(
    {
      code: sector?.code ?? suggestedCode,
      name: sector?.name ?? '',
      color: sector?.color ?? SECTOR_COLORS[0],
      description: sector?.description ?? '',
    },
    {
      validate: (v) =>
        collectErrors([
          ['code', rules.required(v.code) ?? rules.code(v.code)],
          ['name', rules.required(v.name)],
          ['color', /^#[0-9a-f]{6}$/i.test(v.color) ? null : 'Wybierz kolor.'],
        ]),
      onSubmit: async (v) => {
        const saved = sector
          ? await warehousesApi.updateSector(sector.id, v)
          : await warehousesApi.createSector(warehouseId, { ...v, shape: shape ?? null })
        onSaved(saved)
      },
    },
  )

  return (
    <FormModal
      title={sector ? `Edycja sektora ${sector.code}` : 'Nowy sektor'}
      form={form}
      onClose={onClose}
      submitLabel={sector ? 'Zapisz zmiany' : 'Dodaj sektor'}
    >
      <div className="form-row">
        <TextField form={form} name="code" label="Kod" required maxLength={32} placeholder="np. A1" className="w-sm" />
        <TextField form={form} name="name" label="Nazwa" required maxLength={255} placeholder="np. Regał A – dół" />
      </div>
      <Field label="Kolor na mapie" error={form.errors.color}>
        {(id) => (
          <div className="color-picker" id={id}>
            {SECTOR_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`color-swatch ${form.values.color.toLowerCase() === color ? 'is-active' : ''}`}
                style={{ background: color }}
                onClick={() => form.set('color', color)}
                aria-label={`Kolor ${color}`}
              />
            ))}
            <input
              type="color"
              name="color"
              value={form.values.color}
              onChange={(e) => form.set('color', e.target.value)}
              aria-label="Własny kolor"
            />
          </div>
        )}
      </Field>
      <TextAreaField form={form} name="description" label="Opis" placeholder="np. towary wielkogabarytowe" />
      {!sector && !shape && (
        <p className="field-hint">Sektor zostanie dodany bez obszaru – możesz go narysować później na rzucie.</p>
      )}
    </FormModal>
  )
}
