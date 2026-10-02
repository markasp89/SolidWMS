import { collectErrors, FormModal, rules, TextAreaField, TextField, useForm } from '@/core/ui/form'
import { warehousesApi } from '../api'
import type { Warehouse } from '../types'

interface Props {
  warehouse?: Warehouse
  onClose: () => void
  onSaved: (warehouse: Warehouse) => void
}

export function WarehouseFormModal({ warehouse, onClose, onSaved }: Props) {
  const form = useForm(
    {
      code: warehouse?.code ?? '',
      name: warehouse?.name ?? '',
      address: warehouse?.address ?? '',
      description: warehouse?.description ?? '',
    },
    {
      validate: (v) =>
        collectErrors([
          ['code', rules.required(v.code) ?? rules.code(v.code)],
          ['name', rules.required(v.name)],
        ]),
      onSubmit: async (v) => {
        const saved = warehouse ? await warehousesApi.update(warehouse.id, v) : await warehousesApi.create(v)
        onSaved(saved)
      },
    },
  )

  return (
    <FormModal
      title={warehouse ? `Edycja magazynu ${warehouse.code}` : 'Nowy magazyn'}
      form={form}
      onClose={onClose}
      submitLabel={warehouse ? 'Zapisz zmiany' : 'Utwórz magazyn'}
    >
      <div className="form-row">
        <TextField form={form} name="code" label="Kod" required maxLength={32} placeholder="np. MAG1" className="w-sm" />
        <TextField form={form} name="name" label="Nazwa" required maxLength={255} placeholder="np. Magazyn główny" />
      </div>
      <TextField form={form} name="address" label="Adres" maxLength={255} />
      <TextAreaField form={form} name="description" label="Opis" />
    </FormModal>
  )
}
