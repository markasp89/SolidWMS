import { useState } from 'react'
import { api } from '@/core/api/client'
import { useAuth } from '@/core/auth/AuthContext'
import { formatNumber } from '@/core/format'
import { useAsync } from '@/core/hooks/useAsync'
import { Button } from '@/core/ui/Button'
import { useFeedback } from '@/core/ui/feedback'
import { FormModal, TextField, collectErrors, rules, toNumber, useForm } from '@/core/ui/form'
import { Card } from '@/core/ui/misc'
import type { Product } from '@/modules/inventory'

interface Minimum {
  min_quantity: number | null
  total_quantity: number
}

/** Extension "product.sidebar": minimum quantity of the product. */
export function MinimumStockCard({ product }: { product: Product }) {
  const { isManager } = useAuth()
  const { toast } = useFeedback()
  const [editing, setEditing] = useState(false)
  const { data, setData } = useAsync(
    (signal) => api.get<Minimum>(`/products/${product.id}/min-quantity`, undefined, signal),
    [product.id, product.total_quantity],
  )

  if (!data) return null
  const low = data.min_quantity !== null && data.total_quantity < data.min_quantity

  return (
    <Card
      title="Stan minimalny"
      actions={
        isManager && (
          <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditing(true)} aria-label="Zmień stan minimalny" />
        )
      }
    >
      {data.min_quantity === null ? (
        <p className="muted">Nie ustawiono – brak powiadomień o niskim stanie.</p>
      ) : (
        <p className={low ? 'alert alert-warn' : 'muted'}>
          {low ? 'Za mało towaru! ' : ''}Minimum: <strong>{formatNumber(data.min_quantity)} {product.unit}</strong>, jest{' '}
          {formatNumber(data.total_quantity)} {product.unit}.
        </p>
      )}
      {editing && (
        <MinimumModal
          product={product}
          current={data.min_quantity}
          onClose={() => setEditing(false)}
          onSaved={(m) => {
            setData(m)
            setEditing(false)
            toast('Zapisano stan minimalny.')
          }}
        />
      )}
    </Card>
  )
}

function MinimumModal({ product, current, onClose, onSaved }: { product: Product; current: number | null; onClose: () => void; onSaved: (m: Minimum) => void }) {
  const form = useForm(
    { min_quantity: current === null ? '' : String(current) },
    {
      validate: (v) => collectErrors([['min_quantity', v.min_quantity.trim() !== '' && rules.nonNegative(v.min_quantity)]]),
      onSubmit: async (v) =>
        onSaved(
          await api.put<Minimum>(`/products/${product.id}/min-quantity`, {
            min_quantity: v.min_quantity.trim() === '' ? null : toNumber(v.min_quantity),
          }),
        ),
    },
  )

  return (
    <FormModal title={`Stan minimalny: ${product.name}`} form={form} onClose={onClose} size="sm">
      <TextField
        form={form}
        name="min_quantity"
        label={`Minimum (${product.unit})`}
        inputMode="decimal"
        hint="Gdy stan spadnie poniżej, administratorzy i kierownicy dostaną powiadomienie. Puste = bez powiadomień."
      />
    </FormModal>
  )
}
