import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAsync } from '@/core/hooks/useAsync'
import { useModuleEnabled } from '@/core/modules/registry'
import { Button } from '@/core/ui/Button'
import { useFeedback } from '@/core/ui/feedback'
import { collectErrors, Field, Form, rules, TextAreaField, TextField, toNumber, useForm, type FormErrors } from '@/core/ui/form'
import { ColorDot, EmptyState, ErrorMessage, PageHeader, Spinner } from '@/core/ui/misc'
import { ExpiryBadge, loadSectorsCached, type Product } from '@/modules/inventory'
import { warehousesApi } from '@/modules/warehouses'
import { documentsApi } from '../api'
import { counterpartyLabel, TYPE_LABELS } from '../labels'
import { LineModal } from '../components/LineModal'
import { newLineKey, type EditorLine } from '../lines'
import type { DocumentDetail, DocumentInput, DocumentType } from '../types'

interface EditorValues {
  warehouse_id: number | ''
  counterparty: string
  note: string
  lines: EditorLine[]
}

const toEditorValues = (doc: DocumentDetail): EditorValues => ({
  warehouse_id: doc.warehouse?.id ?? '',
  counterparty: doc.counterparty ?? '',
  note: doc.note ?? '',
  lines: doc.lines.map((l) => ({
    key: newLineKey(),
    product: l.product ? ({ ...l.product, barcode: null, description: null } satisfies Product) : null,
    quantity: String(l.quantity),
    sector_id: l.sector?.id ?? '',
    stock_item_id: l.stock_item_id,
    slot: l.slot ?? '',
    batch: l.batch ?? '',
    expires_at: l.expires_at ?? '',
    note: l.note ?? '',
  })),
})

/** /documents/new?type=PZ|WZ and /documents/:id/edit */
export function DocumentEditorPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const documentId = id ? Number(id) : null
  const { data, error, loading, reload } = useAsync(
    (signal) => (documentId ? documentsApi.get(documentId, signal) : Promise.resolve(null)),
    [documentId],
  )

  if (error) return <ErrorMessage error={error} onRetry={reload} />
  if (loading || data === undefined) return <Spinner />

  if (data && data.status !== 'draft') {
    return (
      <>
        <PageHeader title={data.number} />
        <div className="alert alert-warn">
          Zatwierdzonego dokumentu nie można zmieniać. <Link to={`/documents/${data.id}`}>Wróć do dokumentu</Link>
        </div>
      </>
    )
  }

  const type: DocumentType = data?.type ?? (params.get('type') === 'WZ' ? 'WZ' : 'PZ')
  return <DocumentEditor key={`${type}-${data?.id ?? 'new'}`} type={type} document={data} />
}

function DocumentEditor({ type, document }: { type: DocumentType; document: DocumentDetail | null }) {
  const navigate = useNavigate()
  const { toast } = useFeedback()
  const batches = useModuleEnabled('batches')
  const slots = useModuleEnabled('slots')
  const [editing, setEditing] = useState<EditorLine | 'new' | null>(null)

  const warehouses = useAsync((signal) => warehousesApi.list(signal), [])
  const sectorWarehouses = useAsync(() => loadSectorsCached(), [])
  const sectors = useMemo(
    () => new Map((sectorWarehouses.data ?? []).flatMap((w) => (w.sectors ?? []).map((s) => [s.id, s] as const))),
    [sectorWarehouses.data],
  )

  const form = useForm<EditorValues>(
    document ? toEditorValues(document) : { warehouse_id: '', counterparty: '', note: '', lines: [] },
    {
      validate: (v) =>
        collectErrors([
          ['warehouse_id', rules.required(v.warehouse_id, 'Wybierz magazyn.')],
          ['lines', v.lines.length === 0 && 'Dodaj co najmniej jedną pozycję.'],
          ...v.lines.flatMap((l, i): Array<[string, string | null | false]> => [
            [`lines.${i}.quantity`, rules.required(l.quantity) ?? rules.positive(l.quantity)],
            [`lines.${i}.sector_id`, type === 'PZ' && !l.sector_id && 'Wybierz sektor docelowy.'],
          ]),
        ]),
      onSubmit: async (v) => {
        const input: DocumentInput = {
          warehouse_id: Number(v.warehouse_id),
          counterparty: v.counterparty.trim() || null,
          note: v.note.trim() || null,
          lines: v.lines.map((l) => ({
            product_id: l.product!.id,
            quantity: toNumber(l.quantity),
            sector_id: type === 'PZ' ? Number(l.sector_id) : null,
            stock_item_id: type === 'WZ' ? l.stock_item_id : null,
            slot: type === 'PZ' ? l.slot || null : null,
            batch: l.batch || null,
            expires_at: type === 'PZ' ? l.expires_at || null : null,
            note: l.note || null,
          })),
        }
        const saved = document ? await documentsApi.update(document.id, input) : await documentsApi.create({ ...input, type })
        toast(document ? 'Zapisano zmiany w dokumencie.' : `Utworzono szkic ${saved.number}.`)
        navigate(`/documents/${saved.id}`, { replace: true })
      },
    },
  )
  const { values, errors } = form

  // Pick the warehouse automatically when there is only one.
  const onlyWarehouse = warehouses.data?.length === 1 ? warehouses.data[0].id : null
  useEffect(() => {
    if (onlyWarehouse !== null && !document) form.setValues({ warehouse_id: onlyWarehouse })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyWarehouse])

  const clearErrors = (prefix: string) => {
    const next: FormErrors = {}
    for (const [key, message] of Object.entries(errors)) if (!key.startsWith(prefix)) next[key] = message
    form.setErrors(next)
  }

  const changeWarehouse = (warehouseId: number | '') => {
    // Sectors and exact source locations belong to the previous warehouse.
    form.setValues({ warehouse_id: warehouseId, lines: values.lines.map((l) => ({ ...l, sector_id: '', stock_item_id: null })) })
    clearErrors('warehouse_id')
  }

  const saveLine = (line: EditorLine) => {
    const exists = values.lines.some((l) => l.key === line.key)
    form.setValues({ lines: exists ? values.lines.map((l) => (l.key === line.key ? line : l)) : [...values.lines, line] })
    const index = exists ? values.lines.findIndex((l) => l.key === line.key) : -1
    clearErrors(index >= 0 ? `lines.${index}.` : 'lines')
  }

  const removeLine = (index: number) => {
    form.setValues({ lines: values.lines.filter((_, i) => i !== index) })
    // Line indexes shift, so per-line messages would point at the wrong rows.
    clearErrors('lines.')
  }

  const setQuantity = (index: number, quantity: string) => {
    form.setValues({ lines: values.lines.map((l, i) => (i === index ? { ...l, quantity } : l)) })
    if (errors[`lines.${index}.quantity`]) clearErrors(`lines.${index}.quantity`)
  }

  const openAdd = () => {
    if (values.warehouse_id === '') {
      form.setErrors({ ...errors, warehouse_id: 'Najpierw wybierz magazyn.' })
      return
    }
    setEditing('new')
  }

  const describeSector = (line: EditorLine) => {
    if (type === 'WZ') return <span className="muted">{line.stock_item_id ? 'wskazana lokalizacja' : 'automatycznie (FEFO)'}</span>
    const sector = line.sector_id ? sectors.get(line.sector_id) : undefined
    if (!sector) return <span className="muted">—</span>
    return (
      <span className="doc-sector">
        <ColorDot color={sector.color} />
        {sector.code}
        {line.slot && `-${line.slot}`}
      </span>
    )
  }

  const title = document ? `Edycja ${document.number}` : `Nowe ${type}`
  const showBatchColumn = batches || values.lines.some((l) => l.batch || l.expires_at)

  return (
    <>
      <PageHeader
        back={
          <Link to={document ? `/documents/${document.id}` : '/documents'} className="link-muted">
            ← {document ? document.number : 'Dokumenty'}
          </Link>
        }
        title={title}
        subtitle={`${TYPE_LABELS[type]} – zapisany dokument jest szkicem; stan magazynu zmienia się po zatwierdzeniu.`}
      />

      <Form form={form} showSubmit={false} className="doc-editor">
        <section className="card">
          <div className="card-body">
            <div className="form-row">
              <Field label="Magazyn" required error={errors.warehouse_id ?? warehouses.error?.message}>
                {(fieldId, describedBy) => (
                  <select
                    id={fieldId}
                    name="warehouse_id"
                    className="input"
                    aria-describedby={describedBy}
                    aria-invalid={errors.warehouse_id ? true : undefined}
                    value={values.warehouse_id}
                    onChange={(e) => changeWarehouse(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">{warehouses.data ? '— wybierz magazyn —' : 'Ładowanie…'}</option>
                    {warehouses.data?.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} – {w.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <TextField form={form} name="counterparty" label={counterpartyLabel(type)} maxLength={255} />
            </div>
            <TextAreaField form={form} name="note" label="Uwagi" maxLength={2000} rows={2} />
          </div>
        </section>

        <section className="card">
          <header className="card-header">
            <h2>Pozycje ({values.lines.length})</h2>
            <div className="card-actions">
              <Button size="sm" icon="plus" onClick={openAdd}>
                Dodaj pozycję
              </Button>
            </div>
          </header>
          <div className="card-body">
            {type === 'WZ' && (
              <p className="muted doc-hint">
                Lokalizacje, z których zostanie wydany towar, system wybierze automatycznie przy zatwierdzaniu (najpierw najkrótszy termin
                ważności – FEFO).
              </p>
            )}
            {errors.lines && (
              <div className="alert alert-error" role="alert">
                {errors.lines}
              </div>
            )}
            {values.lines.length === 0 ? (
              <EmptyState icon="list" title="Brak pozycji">
                <Button icon="plus" onClick={openAdd}>
                  Dodaj pierwszą pozycję
                </Button>
              </EmptyState>
            ) : (
              <div className="table-wrap">
                <table className="table doc-lines">
                  <thead>
                    <tr>
                      <th className="num">Lp.</th>
                      <th>Produkt</th>
                      <th>Ilość</th>
                      <th>{type === 'PZ' ? (slots ? 'Sektor / miejsce' : 'Sektor') : 'Lokalizacja'}</th>
                      {showBatchColumn && <th>Partia / ważność</th>}
                      <th className="actions" aria-label="Akcje" />
                    </tr>
                  </thead>
                  <tbody>
                    {values.lines.map((line, index) => {
                      const prefix = `lines.${index}.`
                      const rowErrors = Object.entries(errors)
                        .filter(([key]) => key.startsWith(prefix) && key !== `${prefix}quantity`)
                        .map(([, message]) => message)
                      const quantityError = errors[`${prefix}quantity`]
                      return (
                        <tr key={line.key} className={rowErrors.length || quantityError ? 'doc-line-invalid' : undefined}>
                          <td className="num">{index + 1}</td>
                          <td>
                            <strong>{line.product?.name}</strong>
                            <div className="muted">{line.product?.sku}</div>
                            {line.note && <div className="muted">{line.note}</div>}
                            {rowErrors.map((message) => (
                              <div key={message} className="field-error">
                                {message}
                              </div>
                            ))}
                          </td>
                          <td>
                            <div className="doc-qty">
                              <input
                                name={`${prefix}quantity`}
                                className="input"
                                inputMode="decimal"
                                aria-label={`Ilość – pozycja ${index + 1}`}
                                aria-invalid={quantityError ? true : undefined}
                                value={line.quantity}
                                onChange={(e) => setQuantity(index, e.target.value)}
                              />
                              <span className="muted">{line.product?.unit}</span>
                            </div>
                            {quantityError && <div className="field-error">{quantityError}</div>}
                          </td>
                          <td className="nowrap">{describeSector(line)}</td>
                          {showBatchColumn && (
                            <td>
                              {line.batch || <span className="muted">{type === 'WZ' ? 'dowolna' : '—'}</span>}
                              {line.expires_at && (
                                <div>
                                  <ExpiryBadge date={line.expires_at} />
                                </div>
                              )}
                            </td>
                          )}
                          <td className="actions nowrap">
                            <Button size="sm" variant="ghost" icon="edit" title="Edytuj pozycję" aria-label="Edytuj pozycję" onClick={() => setEditing(line)} />
                            <Button size="sm" variant="ghost" icon="trash" title="Usuń pozycję" aria-label="Usuń pozycję" onClick={() => removeLine(index)} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <div className="form-actions">
          <Button onClick={() => navigate(document ? `/documents/${document.id}` : '/documents')} disabled={form.submitting}>
            Anuluj
          </Button>
          <Button type="submit" variant="primary" icon="check" loading={form.submitting}>
            {document ? 'Zapisz zmiany' : 'Zapisz szkic'}
          </Button>
        </div>
      </Form>

      {editing && values.warehouse_id !== '' && (
        <LineModal
          type={type}
          warehouseId={values.warehouse_id}
          line={editing === 'new' ? null : editing}
          onSave={saveLine}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
