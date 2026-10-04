import { useState, type ReactNode } from 'react'
import { Button } from '@/core/ui/Button'
import { useFeedback } from '@/core/ui/feedback'
import { Modal } from '@/core/ui/Modal'
import { copyToClipboard } from './clipboard'

export function CopyButton({ text, label = 'Kopiuj', size = 'sm' }: { text: string; label?: string; size?: 'sm' | 'md' }) {
  const { toast } = useFeedback()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (await copyToClipboard(text)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } else {
      toast('Nie udało się skopiować. Zaznacz tekst i skopiuj ręcznie.', 'error')
    }
  }

  return (
    <Button size={size} icon={copied ? 'check' : 'clipboard'} onClick={copy}>
      {copied ? 'Skopiowano' : label}
    </Button>
  )
}

/** Shows a secret value (API key, webhook secret) with a copy button. */
export function SecretModal({
  title,
  value,
  onClose,
  warning,
  children,
}: {
  title: string
  value: string
  onClose: () => void
  warning?: ReactNode
  children?: ReactNode
}) {
  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          Zamknij
        </Button>
      }
    >
      {warning && (
        <div className="alert alert-warn" role="alert">
          {warning}
        </div>
      )}
      {children}
      <div className="secret-box">
        <code className="secret-value">{value}</code>
        <CopyButton text={value} />
      </div>
    </Modal>
  )
}

export function CodeBlock({ code, title }: { code: string; title?: string }) {
  return (
    <div className="code-block">
      <div className="code-block-header">
        <span>{title}</span>
        <CopyButton text={code} />
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}

/** A list of checkboxes bound to an array value (e.g. API key abilities, webhook events). */
export function CheckboxGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  error,
  disabled,
  hint,
}: {
  legend: ReactNode
  name: string
  options: Array<{ value: T; label: ReactNode }>
  value: T[]
  onChange: (value: T[]) => void
  error?: string
  disabled?: boolean
  hint?: ReactNode
}) {
  const toggle = (option: T, checked: boolean) =>
    onChange(checked ? [...value.filter((v) => v !== option), option] : value.filter((v) => v !== option))

  return (
    <fieldset className={`field integrations-fieldset ${error ? 'field-invalid' : ''}`}>
      <legend className="field-label">{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className="checkbox">
          <input
            type="checkbox"
            name={name}
            value={option.value}
            checked={value.includes(option.value)}
            disabled={disabled}
            onChange={(e) => toggle(option.value, e.target.checked)}
          />
          <span>{option.label}</span>
        </label>
      ))}
      {error ? <p className="field-error">{error}</p> : hint && <p className="field-hint">{hint}</p>}
    </fieldset>
  )
}
