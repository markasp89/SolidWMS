import {
  useCallback,
  useId,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { ApiError } from '@/core/api/client'
import { Button } from './Button'
import { Modal } from './Modal'

/* -------------------------------------------------------------------------- */
/*  useForm                                                                    */
/* -------------------------------------------------------------------------- */

export type FormErrors = Record<string, string>

interface UseFormOptions<T> {
  /** Client-side validation. Return a map of field name => message. */
  validate?: (values: T) => FormErrors
  onSubmit: (values: T) => Promise<unknown> | unknown
}

export interface FormApi<T> {
  values: T
  errors: FormErrors
  formError: string | null
  submitting: boolean
  set: <K extends keyof T>(name: K, value: T[K]) => void
  setValues: (patch: Partial<T>) => void
  setErrors: (errors: FormErrors) => void
  /** Runs validation and, if it passes, onSubmit. Server 422 errors are mapped onto fields. */
  handleSubmit: (event?: FormEvent) => Promise<void>
  formRef: React.RefObject<HTMLFormElement | null>
}

export function useForm<T extends object>(initial: T, options: UseFormOptions<T>): FormApi<T> {
  const [values, setAll] = useState<T>(initial)
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement | null>(null)
  const optionsRef = useRef(options)
  optionsRef.current = options
  const valuesRef = useRef(values)
  valuesRef.current = values

  const set = useCallback(<K extends keyof T>(name: K, value: T[K]) => {
    setAll((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => {
      if (!(name as string in prev)) return prev
      const next = { ...prev }
      delete next[name as string]
      return next
    })
  }, [])

  const setValues = useCallback((patch: Partial<T>) => setAll((prev) => ({ ...prev, ...patch })), [])

  const focusFirstError = (errs: FormErrors) => {
    const first = Object.keys(errs)[0]
    if (!first) return
    requestAnimationFrame(() => {
      const el = formRef.current?.querySelector<HTMLElement>(`[name="${CSS.escape(first)}"]`)
      el?.focus()
    })
  }

  const handleSubmit = useCallback(async (event?: FormEvent) => {
    event?.preventDefault()
    if (submitting) return
    setFormError(null)

    const current = valuesRef.current
    const clientErrors = optionsRef.current.validate?.(current) ?? {}
    setErrors(clientErrors)
    if (Object.keys(clientErrors).length > 0) {
      focusFirstError(clientErrors)
      return
    }

    setSubmitting(true)
    try {
      await optionsRef.current.onSubmit(current)
    } catch (error) {
      if (error instanceof ApiError && error.isValidation && Object.keys(error.fieldErrors).length > 0) {
        setErrors(error.fieldErrors)
        // Show errors that do not belong to a visible field at the top of the form.
        const known = Object.keys(error.fieldErrors).filter((name) =>
          formRef.current?.querySelector(`[name="${CSS.escape(name)}"]`),
        )
        if (known.length === 0) setFormError(error.message)
        focusFirstError(error.fieldErrors)
      } else {
        setFormError(error instanceof Error ? error.message : 'Wystąpił nieoczekiwany błąd.')
      }
    } finally {
      setSubmitting(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitting])

  return { values, errors, formError, submitting, set, setValues, setErrors, handleSubmit, formRef }
}

/** Small set of reusable validators. */
export const rules = {
  required: (value: unknown, message = 'To pole jest wymagane.') =>
    value === null || value === undefined || String(value).trim() === '' ? message : null,
  positive: (value: unknown, message = 'Podaj liczbę większą od zera.') => {
    const n = Number(String(value).replace(',', '.'))
    return !Number.isFinite(n) || n <= 0 ? message : null
  },
  nonNegative: (value: unknown, message = 'Podaj liczbę nieujemną.') => {
    const n = Number(String(value).replace(',', '.'))
    return String(value).trim() === '' || !Number.isFinite(n) || n < 0 ? message : null
  },
  email: (value: unknown, message = 'Podaj poprawny adres e-mail.') =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '')) ? null : message,
  code: (value: unknown, message = 'Dozwolone: litery, cyfry oraz _ . -') =>
    /^[A-Za-z0-9_.-]+$/.test(String(value ?? '')) ? null : message,
}

/** Builds an errors object from `[field, message | null]` pairs. */
export function collectErrors(checks: Array<[string, string | null | undefined | false]>): FormErrors {
  const errors: FormErrors = {}
  for (const [field, message] of checks) {
    if (message && !errors[field]) errors[field] = message
  }
  return errors
}

export const toNumber = (value: string | number) => Number(String(value).replace(',', '.'))

/* -------------------------------------------------------------------------- */
/*  <Form> and <FormModal>                                                     */
/* -------------------------------------------------------------------------- */

interface FormProps<T> {
  form: FormApi<T>
  children: ReactNode
  id?: string
  className?: string
  /**
   * Render the form's own submit button. Disable it when the form is placed inside a
   * container (e.g. a modal) that provides its own buttons: those buttons point at the
   * form with the `form` attribute, so they still go through validation.
   */
  showSubmit?: boolean
  submitLabel?: string
}

export function Form<T>({ form, children, id, className = '', showSubmit = true, submitLabel = 'Zapisz' }: FormProps<T>) {
  return (
    <form id={id} ref={form.formRef} className={`form ${className}`} noValidate onSubmit={form.handleSubmit}>
      {form.formError && (
        <div className="alert alert-error" role="alert">
          {form.formError}
        </div>
      )}
      {children}
      {showSubmit && (
        <div className="form-actions">
          <Button type="submit" variant="primary" loading={form.submitting}>
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  )
}

interface FormModalProps<T> {
  title: ReactNode
  form: FormApi<T>
  onClose: () => void
  children: ReactNode
  submitLabel?: string
  submitVariant?: 'primary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  extraFooter?: ReactNode
}

/**
 * A modal containing a form. The footer "save" button is a real submit button
 * (`form="<id>"`), so pressing it - or Enter inside a field - runs validation.
 */
export function FormModal<T>({
  title,
  form,
  onClose,
  children,
  submitLabel = 'Zapisz',
  submitVariant = 'primary',
  size = 'md',
  extraFooter,
}: FormModalProps<T>) {
  const formId = useId()

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      size={size}
      locked={form.submitting}
      footer={
        <>
          {extraFooter && <div className="modal-footer-start">{extraFooter}</div>}
          <Button onClick={onClose} disabled={form.submitting}>
            Anuluj
          </Button>
          <Button type="submit" form={formId} variant={submitVariant} loading={form.submitting}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <Form form={form} id={formId} showSubmit={false}>
        {children}
      </Form>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */
/*  Fields                                                                     */
/* -------------------------------------------------------------------------- */

interface FieldProps {
  label?: ReactNode
  error?: string
  hint?: ReactNode
  required?: boolean
  children: (id: string, describedBy: string | undefined) => ReactNode
  className?: string
}

export function Field({ label, error, hint, required, children, className = '' }: FieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className={`field ${error ? 'field-invalid' : ''} ${className}`}>
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
          {required && <span className="field-required"> *</span>}
        </label>
      )}
      {children(id, describedBy)}
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="field-hint">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

type Bound<T> = { form: FormApi<T>; name: keyof T & string; label?: ReactNode; hint?: ReactNode; required?: boolean }

export function TextField<T>({
  form,
  name,
  label,
  hint,
  required,
  className,
  ...input
}: Bound<T> & Omit<InputHTMLAttributes<HTMLInputElement>, 'form' | 'name' | 'value' | 'onChange'>) {
  return (
    <Field label={label} hint={hint} required={required} error={form.errors[name]} className={className}>
      {(id, describedBy) => (
        <input
          id={id}
          name={name}
          className="input"
          aria-invalid={form.errors[name] ? true : undefined}
          aria-describedby={describedBy}
          value={String(form.values[name] ?? '')}
          onChange={(e) => form.set(name, e.target.value as T[typeof name])}
          {...input}
        />
      )}
    </Field>
  )
}

export function TextAreaField<T>({
  form,
  name,
  label,
  hint,
  required,
  className,
  ...input
}: Bound<T> & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'form' | 'name' | 'value' | 'onChange'>) {
  return (
    <Field label={label} hint={hint} required={required} error={form.errors[name]} className={className}>
      {(id, describedBy) => (
        <textarea
          id={id}
          name={name}
          className="input"
          rows={3}
          aria-invalid={form.errors[name] ? true : undefined}
          aria-describedby={describedBy}
          value={String(form.values[name] ?? '')}
          onChange={(e) => form.set(name, e.target.value as T[typeof name])}
          {...input}
        />
      )}
    </Field>
  )
}

export function SelectField<T>({
  form,
  name,
  label,
  hint,
  required,
  options,
  placeholder,
  className,
  ...select
}: Bound<T> & {
  options: Array<{ value: string | number; label: string }>
  placeholder?: string
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'form' | 'name' | 'value' | 'onChange'>) {
  return (
    <Field label={label} hint={hint} required={required} error={form.errors[name]} className={className}>
      {(id, describedBy) => (
        <select
          id={id}
          name={name}
          className="input"
          aria-invalid={form.errors[name] ? true : undefined}
          aria-describedby={describedBy}
          value={String(form.values[name] ?? '')}
          onChange={(e) => form.set(name, e.target.value as T[typeof name])}
          {...select}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
}

export function CheckboxField<T>({ form, name, label, hint }: Bound<T>) {
  return (
    <div className="field field-checkbox">
      <label className="checkbox">
        <input
          type="checkbox"
          name={name}
          checked={Boolean(form.values[name])}
          onChange={(e) => form.set(name, e.target.checked as T[typeof name])}
        />
        <span>{label}</span>
      </label>
      {form.errors[name] ? <p className="field-error">{form.errors[name]}</p> : hint && <p className="field-hint">{hint}</p>}
    </div>
  )
}
