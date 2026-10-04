import { collectErrors, FormModal, rules, TextField, useForm } from '@/core/ui/form'
import { SectorSelect } from '@/modules/inventory'
import { stocktakingApi } from '../api'
import type { StocktakeDetail } from '../types'

interface Props {
  onClose: () => void
  onCreated: (stocktake: StocktakeDetail) => void
}

export function NewStocktakeModal({ onClose, onCreated }: Props) {
  const form = useForm(
    { sector_id: '' as number | '', note: '' },
    {
      validate: (v) => collectErrors([['sector_id', rules.required(v.sector_id, 'Wybierz sektor.')]]),
      onSubmit: async (v) => onCreated(await stocktakingApi.create({ sector_id: Number(v.sector_id), note: v.note.trim() || null })),
    },
  )

  return (
    <FormModal title="Nowa inwentaryzacja" form={form} onClose={onClose} submitLabel="Rozpocznij">
      <SectorSelect
        name="sector_id"
        label="Sektor"
        required
        value={form.values.sector_id}
        onChange={(v) => form.set('sector_id', v)}
        error={form.errors.sector_id}
      />
      <TextField form={form} name="note" label="Uwagi" maxLength={255} placeholder="np. inwentaryzacja kwartalna" />
      <p className="muted">
        Lista do przeliczenia zostanie utworzona z aktualnych stanów sektora. Do czasu zatwierdzenia stany magazynowe się nie zmieniają.
      </p>
    </FormModal>
  )
}
