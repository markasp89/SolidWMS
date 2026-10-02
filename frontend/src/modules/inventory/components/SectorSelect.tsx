import { useEffect, useState } from 'react'
import { useAsync } from '@/core/hooks/useAsync'
import { Field } from '@/core/ui/form'
import { loadAllSectors, type Warehouse } from '@/modules/warehouses'

let cache: Promise<Warehouse[]> | null = null
let cacheTime = 0

/** Warehouses with sectors, cached briefly so modals open instantly. */
function loadCached(): Promise<Warehouse[]> {
  if (!cache || Date.now() - cacheTime > 30_000) {
    cacheTime = Date.now()
    cache = loadAllSectors().catch((e) => {
      cache = null
      throw e
    })
  }
  return cache
}

interface Props {
  name: string
  label: string
  value: number | ''
  onChange: (sectorId: number | '') => void
  error?: string
  required?: boolean
  excludeSectorId?: number
  defaultWarehouseId?: number
}

/** Two-step picker: warehouse → sector. */
export function SectorSelect({ name, label, value, onChange, error, required, excludeSectorId, defaultWarehouseId }: Props) {
  const { data: warehouses, error: loadError } = useAsync(() => loadCached(), [])
  const [warehouseId, setWarehouseId] = useState<number | ''>(defaultWarehouseId ?? '')

  // Pick the warehouse automatically when there is only one, or the selected sector's one.
  useEffect(() => {
    if (!warehouses || warehouseId !== '') return
    const owner = warehouses.find((w) => w.sectors?.some((s) => s.id === value))
    if (owner) setWarehouseId(owner.id)
    else if (warehouses.length === 1) setWarehouseId(warehouses[0].id)
  }, [warehouses, value, warehouseId])

  const sectors = warehouses?.find((w) => w.id === warehouseId)?.sectors?.filter((s) => s.id !== excludeSectorId) ?? []

  return (
    <Field label={label} required={required} error={error ?? loadError?.message}>
      {(id, describedBy) => (
        <div className="form-row form-row-tight">
          <select
            className="input"
            aria-label="Magazyn"
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value ? Number(e.target.value) : '')
              onChange('')
            }}
          >
            <option value="">{warehouses ? '— magazyn —' : 'Ładowanie…'}</option>
            {warehouses?.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} – {w.name}
              </option>
            ))}
          </select>
          <select
            id={id}
            name={name}
            className="input"
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            value={value}
            disabled={warehouseId === ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">— sektor —</option>
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} – {s.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </Field>
  )
}

