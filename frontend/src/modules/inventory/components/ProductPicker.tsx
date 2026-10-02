import { useState } from 'react'
import { useAsync } from '@/core/hooks/useAsync'
import { useDebounced } from '@/core/hooks/useDebounced'
import { formatNumber } from '@/core/format'
import { Field } from '@/core/ui/form'
import { inventoryApi } from '../api'
import type { Product } from '../types'

interface Props {
  name: string
  value: Product | null
  onChange: (product: Product | null) => void
  error?: string
}

export function ProductPicker({ name, value, onChange, error }: Props) {
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query)
  const { data, loading } = useAsync(
    (signal) =>
      debounced.trim()
        ? inventoryApi.products({ q: debounced, per_page: 8 }, signal).then((r) => r.data)
        : Promise.resolve([] as Product[]),
    [debounced],
  )

  if (value) {
    return (
      <Field label="Produkt" required>
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
    <Field label="Produkt" required error={error}>
      {(id, describedBy) => (
        <div className="picker">
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
          {debounced.trim() && (
            <ul className="picker-results">
              {loading && <li className="muted">Szukam…</li>}
              {!loading && data?.length === 0 && <li className="muted">Brak wyników. Dodaj nowy produkt w zakładce obok.</li>}
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
