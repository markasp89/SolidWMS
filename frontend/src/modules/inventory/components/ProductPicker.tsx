import { useState } from 'react'
import { parseCode } from '@/core/codes'
import { formatNumber } from '@/core/format'
import { useAsync } from '@/core/hooks/useAsync'
import { useDebounced } from '@/core/hooks/useDebounced'
import { useModuleEnabled } from '@/core/modules/registry'
import { Field } from '@/core/ui/form'
import { ScanButton } from '@/core/ui/Scanner'
import { inventoryApi } from '../api'
import type { Product } from '../types'

interface Props {
  name: string
  value: Product | null
  onChange: (product: Product | null) => void
  error?: string
  label?: string
}

export function ProductPicker({ name, value, onChange, error, label = 'Produkt' }: Props) {
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query)
  const scanning = useModuleEnabled('scanning')
  const { data, loading } = useAsync(
    (signal) =>
      debounced.trim()
        ? inventoryApi.products({ q: debounced, per_page: 8 }, signal).then((r) => r.data)
        : Promise.resolve([] as Product[]),
    [debounced],
  )

  const onScan = async (text: string) => {
    const target = parseCode(text)
    const code = target.kind === 'product' ? target.sku : target.kind === 'text' ? target.value : ''
    if (!code) return
    const found = (await inventoryApi.products({ q: code, per_page: 2 })).data
    const exact = found.find((p) => p.sku === code.toUpperCase() || p.barcode === code)
    if (exact || found.length === 1) onChange(exact ?? found[0])
    else setQuery(code)
  }

  if (value) {
    return (
      <Field label={label} required>
        {() => (
          <div className="picked">
            <div>
              <strong>{value.name}</strong>
              <div className="muted">
                {value.sku} · {value.unit}
              </div>
            </div>
            <button type="button" className="link" onClick={() => onChange(null)}>
              Zmień
            </button>
          </div>
        )}
      </Field>
    )
  }

  return (
    <Field label={label} required error={error}>
      {(id, describedBy) => (
        <div className="picker">
          <div className="form-row form-row-tight">
            <input
              id={id}
              name={name}
              className="input"
              type="search"
              autoComplete="off"
              placeholder="Wpisz nazwę, SKU lub kod kreskowy…"
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {scanning && <ScanButton onScan={onScan} title="Zeskanuj kod produktu" />}
          </div>
          {debounced.trim() && (
            <ul className="picker-results">
              {loading && <li className="muted">Szukam…</li>}
              {!loading && data?.length === 0 && <li className="muted">Brak wyników.</li>}
              {data?.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => onChange(p)}>
                    <strong>{p.name}</strong>
                    <span className="muted">
                      {p.sku} · łącznie {formatNumber(p.total_quantity)} {p.unit}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Field>
  )
}
