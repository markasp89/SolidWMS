import { formatNumber } from '@/core/format'
import { collectErrors, FormModal, rules, TextField, toNumber, useForm } from '@/core/ui/form'
import type { PickLine } from '../types'

interface Props {
  line: PickLine
  onPick: (quantity: number) => Promise<unknown>
  onClose: () => void
}

/** Picks a different (usually smaller) quantity than the remaining one. */
export function PickQuantityModal({ line, onPick, onClose }: Props) {
  const remaining = Math.round((line.quantity - line.picked) * 1000) / 1000
  const unit = line.product?.unit ?? ''
  const form = useForm(
    { quantity: '' },
    {
      validate: (v) =>
        collectErrors([
          [
            'quantity',
            rules.required(v.quantity) ??
              rules.positive(v.quantity) ??
              (toNumber(v.quantity) > remaining + 0.0005 ? `Do zebrania zostało ${formatNumber(remaining)} ${unit}.` : null),
          ],
        ]),
      onSubmit: async (v) => {
        await onPick(toNumber(v.quantity))
        onClose()
      },
    },
  )

  return (
    <FormModal title={`Zebrano: ${line.product?.name ?? 'produkt'}`} form={form} onClose={onClose} submitLabel="Zapisz" size="sm">
      <p className="muted">
        Do zebrania z tego miejsca:{' '}
        <strong>
          {formatNumber(remaining)} {unit}
        </strong>
        . Pozostała ilość zostanie na liście do zebrania.
      </p>
      <TextField form={form} name="quantity" label={`Zebrana ilość (${unit})`} required inputMode="decimal" autoFocus className="w-sm" />
    </FormModal>
  )
}
