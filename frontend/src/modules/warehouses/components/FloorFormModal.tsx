import { collectErrors, FormModal, rules, TextField, useForm } from '@/core/ui/form'
import { warehousesApi } from '../api'
import type { Floor } from '../types'

interface Props {
  warehouseId: number
  floor?: Floor
  onClose: () => void
  onSaved: (floor: Floor) => void
}

export function FloorFormModal({ warehouseId, floor, onClose, onSaved }: Props) {
  const form = useForm(
    { name: floor?.name ?? '', level: floor ? String(floor.level) : '' },
    {
      validate: (v) =>
        collectErrors([
          ['name', rules.required(v.name)],
          ['level', v.level.trim() !== '' && !/^-?\d+$/.test(v.level.trim()) && 'Podaj liczbę całkowitą.'],
        ]),
      onSubmit: async (v) => {
        const data = { name: v.name, level: v.level.trim() === '' ? undefined : Number(v.level) }
        onSaved(floor ? await warehousesApi.updateFloor(floor.id, data) : await warehousesApi.createFloor(warehouseId, data))
      },
    },
  )

  return (
    <FormModal title={floor ? `Piętro: ${floor.name}` : 'Nowe piętro / hala'} form={form} onClose={onClose} size="sm">
      <TextField form={form} name="name" label="Nazwa" required maxLength={100} placeholder="np. Antresola, Hala B" />
      <TextField form={form} name="level" label="Poziom" inputMode="numeric" hint="Kolejność na liście, np. 1, 2 (puste = następny)" className="w-sm" />
    </FormModal>
  )
}
