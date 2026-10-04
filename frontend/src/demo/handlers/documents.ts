/**
 * PZ / WZ documents (module "documents").
 */
import { db, nextId, now, nowIso } from '../db'
import { emit } from '../events'
import { HttpError, invalid, json, MESSAGES, noContent, round3, Validator } from '../http'
import { productRef, sectorSummary } from '../present'
import {
  allowedWarehouseIds,
  canAccess,
  ensureWarehouse,
  fefo,
  findOr404,
  locationLabel,
  paginate,
  productById,
  sectorById,
  stockById,
  userRef,
  warehouseById,
} from '../repo'
import type { Ctx, Router } from '../router'
import * as stock from '../stock'
import type { DocumentLineRow, DocumentRow, DocumentType } from '../types'

const TYPES: Record<DocumentType, string> = { PZ: 'Przyjęcie zewnętrzne', WZ: 'Wydanie zewnętrzne' }

function nextNumber(type: DocumentType): string {
  const date = now()
  const prefix = `${type}/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/`
  const last = db()
    .documents.filter((d) => d.number.startsWith(prefix))
    .reduce((max, d) => Math.max(max, Number.parseInt(d.number.slice(prefix.length), 10) || 0), 0)
  return prefix + String(last + 1).padStart(4, '0')
}

const linesOf = (d: DocumentRow) =>
  db()
    .document_lines.filter((l) => l.document_id === d.id)
    .sort((a, b) => a.position - b.position)

function ensureDraft(d: DocumentRow): void {
  if (d.status !== 'draft') invalid('document', 'Zatwierdzonego dokumentu nie można zmieniać.')
}

function summary(d: DocumentRow) {
  const warehouse = warehouseById(d.warehouse_id)
  return {
    id: d.id,
    type: d.type,
    type_label: TYPES[d.type],
    number: d.number,
    status: d.status,
    warehouse: warehouse ? { id: warehouse.id, code: warehouse.code, name: warehouse.name } : null,
    counterparty: d.counterparty,
    note: d.note,
    lines_count: linesOf(d).length,
    created_by: userRef(d.created_by),
    posted_by: userRef(d.posted_by),
    created_at: d.created_at,
    posted_at: d.posted_at,
  }
}

function detail(d: DocumentRow) {
  return {
    ...summary(d),
    lines: linesOf(d).map((l) => ({
      id: l.id,
      position: l.position,
      product: productRef(l.product_id, false),
      quantity: l.quantity,
      sector: sectorSummary(l.sector_id),
      stock_item_id: l.stock_item_id,
      slot: l.slot,
      batch: l.batch,
      expires_at: l.expires_at,
      note: l.note,
      posted_locations: l.posted_locations,
    })),
  }
}

interface DocumentInput {
  type: DocumentType
  warehouse_id: number
  counterparty: string | null
  note: string | null
  lines: Array<Omit<DocumentLineRow, 'id' | 'document_id' | 'position' | 'posted_locations'>>
}

function validate(ctx: Ctx, existing: DocumentRow | null): DocumentInput {
  const v = new Validator(ctx.body)
  let type: DocumentType | null | undefined = existing?.type
  if (existing) {
    if (v.filled('type')) v.fail('type', MESSAGES.prohibited('type'))
  } else {
    type = v.oneOf('type', ['PZ', 'WZ'] as const, true)
  }
  const warehouseId = v.integer('warehouse_id', true)
  if (typeof warehouseId === 'number' && !warehouseById(warehouseId)) v.fail('warehouse_id', MESSAGES.exists('warehouse_id'))
  const counterparty = v.string('counterparty', { max: 255 })
  const note = v.string('note', { max: 2000 })
  const rawLines = v.array('lines', true, 'Dodaj co najmniej jedną pozycję.') ?? []
  if (rawLines.length > 500) v.fail('lines', 'Dokument może mieć maksymalnie 500 pozycji.')
  const lines: DocumentInput['lines'] = []
  rawLines.forEach((raw, index) => {
    const l = v.nested(`lines.${index}`, raw)
    const productId = l.integer('product_id', true)
    if (typeof productId === 'number' && !productById(productId)) l.fail('product_id', MESSAGES.exists('product_id'))
    const quantity = l.quantity()
    const sectorId = l.integer('sector_id')
    if (typeof sectorId === 'number' && !sectorById(sectorId)) l.fail('sector_id', MESSAGES.exists('sector_id'))
    const stockItemId = l.integer('stock_item_id')
    if (typeof stockItemId === 'number' && !stockById(stockItemId)) l.fail('stock_item_id', MESSAGES.exists('stock_item_id'))
    const lineNote = l.string('note', { max: 255 })
    const d = stock.normalize(l.dimensions())
    lines.push({
      product_id: productId ?? 0,
      quantity: quantity ?? 0,
      sector_id: sectorId ?? null,
      stock_item_id: stockItemId ?? null,
      slot: d.slot,
      batch: d.batch,
      expires_at: d.expires_at,
      note: lineNote ?? null,
    })
  })
  v.validate()
  return {
    type: type ?? 'PZ',
    warehouse_id: warehouseId ?? 0,
    counterparty: counterparty ?? null,
    note: note ?? null,
    lines,
  }
}

function saveLines(document: DocumentRow, lines: DocumentInput['lines']): void {
  const state = db()
  state.document_lines = state.document_lines.filter((l) => l.document_id !== document.id)
  lines.forEach((line, index) => {
    state.document_lines.push({ id: nextId('document_lines'), document_id: document.id, position: index + 1, posted_locations: null, ...line })
  })
}

export function registerDocuments(root: Router): void {
  const router = root.with({ module: 'documents' })

  router.get('/documents', (ctx) => {
    const allowed = allowedWarehouseIds(ctx.user)
    const type = ctx.q('type')
    const status = ctx.q('status')
    const q = ctx.q('q')?.toLowerCase() ?? null
    const rows = db()
      .documents.filter(
        (d) =>
          canAccess(allowed, d.warehouse_id) &&
          (type === null || d.type === type) &&
          (status === null || d.status === status) &&
          (q === null || d.number.toLowerCase().includes(q) || (d.counterparty ?? '').toLowerCase().includes(q)),
      )
      .sort((a, b) => b.id - a.id)
    const page = paginate(rows, ctx.qInt('page'), 30, summary)
    return json({ data: page.data, meta: { current_page: page.meta.current_page, last_page: page.meta.last_page, total: page.meta.total, per_page: 30 } })
  })

  router.post('/documents', (ctx) => {
    const data = validate(ctx, null)
    ensureWarehouse(ctx.user, data.warehouse_id)
    const time = nowIso()
    const document: DocumentRow = {
      id: nextId('documents'),
      type: data.type,
      number: nextNumber(data.type),
      status: 'draft',
      warehouse_id: data.warehouse_id,
      counterparty: data.counterparty,
      note: data.note,
      created_by: ctx.user.id,
      posted_by: null,
      posted_at: null,
      created_at: time,
      updated_at: time,
    }
    db().documents.push(document)
    saveLines(document, data.lines)
    return json(detail(document), 201)
  })

  router.get('/documents/:id', (ctx) => {
    const document = findOr404(db().documents, ctx.id())
    ensureWarehouse(ctx.user, document.warehouse_id)
    return json(detail(document))
  })

  router.put('/documents/:id', (ctx) => {
    const document = findOr404(db().documents, ctx.id())
    const data = validate(ctx, document)
    ensureWarehouse(ctx.user, data.warehouse_id)
    ensureDraft(document)
    Object.assign(document, { warehouse_id: data.warehouse_id, counterparty: data.counterparty, note: data.note, updated_at: nowIso() })
    saveLines(document, data.lines)
    return json(detail(document))
  })

  router.delete('/documents/:id', (ctx) => {
    const document = findOr404(db().documents, ctx.id())
    ensureWarehouse(ctx.user, document.warehouse_id)
    ensureDraft(document)
    db().documents = db().documents.filter((d) => d.id !== document.id)
    db().document_lines = db().document_lines.filter((l) => l.document_id !== document.id)
    return noContent()
  })

  router.post('/documents/:id/post', (ctx) => {
    const document = findOr404(db().documents, ctx.id())
    ensureDraft(document)
    ensureWarehouse(ctx.user, document.warehouse_id)
    const lines = linesOf(document)
    if (!lines.length) invalid('lines', 'Dokument nie ma pozycji.')
    for (const line of lines) {
      line.posted_locations = document.type === 'PZ' ? receiveLine(document, line, ctx) : issueLine(document, line, ctx)
    }
    const time = nowIso()
    Object.assign(document, { status: 'posted', posted_by: ctx.user.id, posted_at: time, updated_at: time })
    emit('document.posted')
    return json(detail(document))
  })

  router.get('/documents/:id/pdf', (ctx) => {
    const document = findOr404(db().documents, ctx.id())
    ensureWarehouse(ctx.user, document.warehouse_id)
    throw new HttpError(422, 'PDF jest dostępny w pełnej wersji SolidWMS.')
  })
}

function receiveLine(document: DocumentRow, line: DocumentLineRow, ctx: Ctx) {
  const sector = sectorById(line.sector_id)
  if (!sector || sector.warehouse_id !== document.warehouse_id) {
    invalid(`lines.${line.position}`, `Pozycja ${line.position}: wybierz sektor w magazynie dokumentu.`)
  }
  const item = stock.receive(
    line.product_id,
    sector.id,
    line.quantity,
    ctx.user,
    line.note,
    { slot: line.slot, batch: line.batch, expires_at: line.expires_at },
    document.number,
  )
  return [{ label: locationLabel(item), quantity: line.quantity }]
}

/** Issues from the chosen location or, if none, from the oldest-expiring ones (FEFO). */
function issueLine(document: DocumentRow, line: DocumentLineRow, ctx: Ctx) {
  let remaining = line.quantity
  const locations: Array<{ label: string; quantity: number }> = []
  const chosen = stockById(line.stock_item_id)
  const candidates =
    line.stock_item_id !== null
      ? chosen
        ? [chosen]
        : []
      : db()
          .stock.filter(
            (i) =>
              i.product_id === line.product_id &&
              sectorById(i.sector_id)?.warehouse_id === document.warehouse_id &&
              (!line.batch || i.batch === line.batch),
          )
          .sort(fefo)
  for (const item of candidates) {
    if (remaining <= 0.0005) break
    const take = Math.min(remaining, item.quantity)
    const label = locationLabel(item)
    stock.issue(item, take, ctx.user, line.note, document.number)
    locations.push({ label, quantity: round3(take) })
    remaining -= take
  }
  if (remaining > 0.0005) {
    const product = productById(line.product_id)
    const missing = remaining.toFixed(3).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',')
    invalid(`lines.${line.position}`, `Pozycja ${line.position} (${product?.name ?? '?'}): brakuje ${missing} ${product?.unit ?? ''} w magazynie.`)
  }
  return locations
}
