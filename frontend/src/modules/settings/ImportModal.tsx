import { useMemo, useState, type ChangeEvent, type DragEvent } from 'react'
import { ApiError } from '@/core/api/client'
import { Field, FormModal, useForm } from '@/core/ui/form'
import { parseExport, settingsApi, type ImportSummary } from './api'

interface Props {
  onClose: () => void
  onDone: (summary: ImportSummary) => void
}

export function ImportModal({ onClose, onDone }: Props) {
  const [dragging, setDragging] = useState(false)
  const [serverErrors, setServerErrors] = useState<string[]>([])

  const form = useForm(
    {
      source: 'file' as 'file' | 'paste',
      text: '',
      fileName: '',
      mode: 'merge' as 'merge' | 'replace',
      confirmReplace: false,
    },
    {
      validate: (v) => {
        const errors: Record<string, string> = {}
        const parsed = parseExport(v.text)
        if (parsed.error) errors[v.source === 'file' ? 'file' : 'text'] = parsed.error
        if (v.mode === 'replace' && !v.confirmReplace) {
          errors.confirmReplace = 'Potwierdź, że obecne dane zostaną zastąpione.'
        }
        return errors
      },
      onSubmit: async (v) => {
        setServerErrors([])
        try {
          const { summary } = await settingsApi.import(v.mode, parseExport(v.text).data!)
          onDone(summary)
        } catch (error) {
          if (error instanceof ApiError && error.isValidation) {
            setServerErrors(Object.entries(error.fieldErrors).map(([field, msg]) => `${field}: ${msg}`))
          }
          throw error
        }
      },
    },
  )

  const preview = useMemo(() => {
    const { data } = parseExport(form.values.text)
    if (!data) return null
    return {
      warehouses: data.warehouses.length,
      sectors: data.warehouses.reduce((sum, w) => sum + (w.sectors?.length ?? 0), 0),
      floorPlans: data.warehouses.filter((w) => w.floor_plan?.data).length,
      products: data.products.length,
      stock: data.stock.length,
      exportedAt: data.exported_at,
    }
  }, [form.values.text])

  const readFile = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      form.setValues({ text: String(reader.result ?? ''), fileName: file.name })
      form.setErrors({})
    }
    reader.readAsText(file)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    readFile(e.dataTransfer.files[0])
  }

  return (
    <FormModal
      title="Import danych"
      form={form}
      onClose={onClose}
      size="lg"
      submitLabel={form.values.mode === 'replace' ? 'Zastąp dane' : 'Importuj'}
      submitVariant={form.values.mode === 'replace' ? 'danger' : 'primary'}
    >
      <div className="tabs" role="tablist">
        {(
          [
            ['file', 'Prześlij plik'],
            ['paste', 'Wklej JSON'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={form.values.source === value}
            className={form.values.source === value ? 'is-active' : ''}
            onClick={() => {
              form.setValues({ source: value, text: '', fileName: '' })
              form.setErrors({})
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {form.values.source === 'file' ? (
        <Field label="Plik eksportu (.json)" error={form.errors.file}>
          {(id, describedBy) => (
            <label
              className={`dropzone ${dragging ? 'is-dragging' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <input
                id={id}
                name="file"
                type="file"
                accept="application/json,.json"
                aria-describedby={describedBy}
                onChange={(e: ChangeEvent<HTMLInputElement>) => readFile(e.target.files?.[0])}
              />
              <span>{form.values.fileName || 'Upuść plik tutaj lub kliknij, aby wybrać'}</span>
            </label>
          )}
        </Field>
      ) : (
        <Field label="Zawartość pliku JSON" error={form.errors.text}>
          {(id, describedBy) => (
            <textarea
              id={id}
              name="text"
              className="input input-code"
              rows={10}
              spellCheck={false}
              placeholder='{"format": "solidwms", "version": 1, "warehouses": [], "products": [], "stock": []}'
              aria-describedby={describedBy}
              value={form.values.text}
              onChange={(e) => form.set('text', e.target.value)}
            />
          )}
        </Field>
      )}

      {preview && (
        <div className="import-preview">
          <strong>Zawartość pliku:</strong> {preview.warehouses} magazynów, {preview.sectors} sektorów
          {preview.floorPlans > 0 && `, ${preview.floorPlans} rzutów`}, {preview.products} produktów, {preview.stock}{' '}
          lokalizacji
          {preview.exportedAt && <span className="muted"> · eksport z {new Date(preview.exportedAt).toLocaleString('pl-PL')}</span>}
        </div>
      )}

      <fieldset className="fieldset">
        <legend>Tryb importu</legend>
        <label className="radio">
          <input
            type="radio"
            name="mode"
            checked={form.values.mode === 'merge'}
            onChange={() => form.setValues({ mode: 'merge', confirmReplace: false })}
          />
          <span>
            <strong>Scal</strong> – dodaj nowe i zaktualizuj istniejące rekordy (po kodzie magazynu, kodzie sektora i SKU).
          </span>
        </label>
        <label className="radio">
          <input type="radio" name="mode" checked={form.values.mode === 'replace'} onChange={() => form.set('mode', 'replace')} />
          <span>
            <strong>Zastąp</strong> – usuń wszystkie magazyny, sektory, produkty, stany i historię, a potem wczytaj plik.
          </span>
        </label>
        {form.values.mode === 'replace' && (
          <div className={`field ${form.errors.confirmReplace ? 'field-invalid' : ''}`}>
            <label className="checkbox checkbox-danger">
              <input
                type="checkbox"
                name="confirmReplace"
                checked={form.values.confirmReplace}
                onChange={(e) => form.set('confirmReplace', e.target.checked)}
              />
              <span>Rozumiem, że obecne dane zostaną bezpowrotnie usunięte.</span>
            </label>
            {form.errors.confirmReplace && <p className="field-error">{form.errors.confirmReplace}</p>}
          </div>
        )}
      </fieldset>

      {serverErrors.length > 1 && (
        <ul className="error-list">
          {serverErrors.slice(0, 8).map((e) => (
            <li key={e}>{e}</li>
          ))}
          {serverErrors.length > 8 && <li>…i {serverErrors.length - 8} więcej</li>}
        </ul>
      )}
    </FormModal>
  )
}
