/**
 * Order picking (module "picking"): FEFO allocation, walking order, pick = issue.
 */
import { db, nextId, now, nowIso } from '../db'
import { emit } from '../events'
import { invalid, json, MESSAGES, notFound, round3, Validator } from '../http'
import { productRef, sectorSummary } from '../present'
import { allowedWarehouseIds, canAccess, ensureWarehouse, fefo, findOr404, natural, productById, sectorById, stockById, userRef, warehouseById } from '../repo'
import type { Router } from '../router'
import * as stock from '../stock'
import type { PickLineRow, PickListRow } from '../types'

function nextNumber(): string {
  const date = now()
  const prefix = `KOM/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/`
  const last = db()
    .pick_lists.filter((l) => l.number.startsWith(prefix))
    .reduce((max, l) => Math.max(max, Number.parseInt(l.number.slice(prefix.length), 10) || 0), 0)
  return prefix + String(last + 1).padStart(4, '0')
}

const linesOf = (list: PickListRow) =>
  db()
    .pick_lines.filter((l) => l.pick_list_id === list.id)
    .sort((a, b) => a.sequence - b.sequence)

function ensureOpen(list: PickListRow): void {
  if (list.status !== 'open') invalid('pick_list', 'Ta lista jest już zamknięta.')
}

function summary(list: PickListRow) {
  const lines = linesOf(list)
  const warehouse = warehouseById(list.warehouse_id)
  return {
    id: list.id,
    number: list.number,
    status: list.status,
    note: list.note,
    warehouse: warehouse ? { id: warehouse.id, code: warehouse.code, name: warehouse.name } : null,
    lines_count: lines.length,
    pending_count: lines.filter((l) => l.status === 'pending').length,
    created_by: userRef(list.created_by),
    created_at: list.created_at,
    completed_at: list.completed_at,
  }
}

function detail(list: PickListRow) {
  return {
    ...summary(list),
    lines: linesOf(list).map((l) => ({
      id: l.id,
      sequence: l.sequence,
      product: productRef(l.product_id),
      sector: sectorSummary(l.sector_id),
      slot: l.slot,
      batch: l.batch,
      expires_at: l.expires_at,
      quantity: l.quantity,
      picked: l.picked,
      status: l.status,
      picked_by: userRef(l.picked_by),
      picked_at: l.picked_at,
    })),
  }
}

function complete(list: PickListRow): void {
  ensureOpen(list)
  const time = nowIso()
  list.status = 'completed'
  list.completed_at = time
  list.updated_at = time
  emit('picking.completed')
}

export function registerPicking(root: Router): void {
  const router = root.with({ module: 'picking' })

  router.get('/picking', (ctx) => {
    const allowed = allowedWarehouseIds(ctx.user)
    const status = ctx.q('status')
    return json(
      db()
        .pick_lists.filter((l) => canAccess(allowed, l.warehouse_id) && (status === null || l.status === status))
        .sort((a, b) => b.id - a.id)
        .slice(0, 100)
        .map(summary),
    )
  })

  router.post('/picking', (ctx) => {
    const v = new Validator(ctx.body)
    const warehouseId = v.integer('warehouse_id', true)
    if (typeof warehouseId === 'number' && !warehouseById(warehouseId)) v.fail('warehouse_id', MESSAGES.exists('warehouse_id'))
    const note = v.string('note', { max: 255 })
    const rawItems = v.array('items', true, 'Dodaj co najmniej jeden produkt.') ?? []
    if (rawItems.length > 300) v.fail('items', 'Lista może mieć maksymalnie 300 pozycji.')
    const items: Array<{ product_id: number; quantity: number }> = []
    rawItems.forEach((raw, index) => {
      const n = v.nested(`items.${index}`, raw)
      const productId = n.integer('product_id', true)
      if (typeof productId === 'number' && !productById(productId)) n.fail('product_id', MESSAGES.exists('product_id'))
      const quantity = n.quantity()
      if (typeof productId === 'number' && quantity !== undefined) items.push({ product_id: productId, quantity })
    })
    v.validate()
    const warehouse = findOr404(db().warehouses, warehouseId ?? 0)
    ensureWarehouse(ctx.user, warehouse.id)

    const time = nowIso()
    const list: PickListRow = {
      id: nextId('pick_lists'),
      number: nextNumber(),
      warehouse_id: warehouse.id,
      status: 'open',
      note: note ?? null,
      created_by: ctx.user.id,
      completed_at: null,
      created_at: time,
      updated_at: time,
    }
    db().pick_lists.push(list)

    type Draft = Omit<PickLineRow, 'id' | 'pick_list_id' | 'sequence'> & { sector_code: string }
    const drafts: Draft[] = []
    for (const wanted of items) {
      let remaining = wanted.quantity
      const locations = db()
        .stock.filter((i) => i.product_id === wanted.product_id && sectorById(i.sector_id)?.warehouse_id === warehouse.id)
        .sort(fefo)
      for (const item of locations) {
        if (remaining <= 0.0005) break
        const take = Math.min(remaining, item.quantity)
        drafts.push({
          product_id: item.product_id,
          stock_item_id: item.id,
          sector_id: item.sector_id,
          sector_code: sectorById(item.sector_id)?.code ?? '',
          slot: item.slot,
          batch: item.batch,
          expires_at: item.expires_at,
          quantity: round3(take),
          picked: 0,
          status: 'pending',
          picked_by: null,
          picked_at: null,
        })
        remaining -= take
      }
      if (remaining > 0.0005) {
        // Not enough stock: keep the shortage visible on the list.
        drafts.push({
          product_id: wanted.product_id,
          stock_item_id: null,
          sector_id: null,
          sector_code: '￿',
          slot: null,
          batch: null,
          expires_at: null,
          quantity: round3(remaining),
          picked: 0,
          status: 'short',
          picked_by: null,
          picked_at: null,
        })
      }
    }
    drafts.sort((a, b) => {
      if (a.sector_code !== b.sector_code) {
        if (a.sector_code === '￿') return 1
        if (b.sector_code === '￿') return -1
        const bySector = natural(a.sector_code, b.sector_code)
        if (bySector !== 0) return bySector
      }
      return natural(a.slot ?? '', b.slot ?? '')
    })
    drafts.forEach(({ sector_code: _code, ...line }, index) => {
      db().pick_lines.push({ id: nextId('pick_lines'), pick_list_id: list.id, sequence: index + 1, ...line })
    })
    return json(detail(list), 201)
  })

  router.get('/picking/:id', (ctx) => {
    const list = findOr404(db().pick_lists, ctx.id())
    ensureWarehouse(ctx.user, list.warehouse_id)
    return json(detail(list))
  })

  router.post('/picking/:id/lines/:line/pick', (ctx) => {
    const list = findOr404(db().pick_lists, ctx.id())
    const line = findOr404(db().pick_lines, ctx.id('line'))
    if (line.pick_list_id !== list.id) throw notFound()
    const v = new Validator(ctx.body)
    const requested = v.number('quantity', { gt0: true, max: 999999999 })
    v.validate()
    ensureOpen(list)
    ensureWarehouse(ctx.user, list.warehouse_id)
    if (line.status !== 'pending') invalid('line', 'Ta pozycja jest już zebrana.')
    const quantity = typeof requested === 'number' ? requested : line.quantity - line.picked
    const item = stockById(line.stock_item_id)
    if (!item) invalid('line', 'Towaru nie ma już w tym miejscu. Sprawdź wyszukiwarką, gdzie teraz leży.')
    stock.issue(item, quantity, ctx.user, `Kompletacja ${list.number}`, list.number)
    const picked = round3(line.picked + quantity)
    line.picked = picked
    line.status = picked + 0.0005 >= line.quantity ? 'picked' : 'pending'
    line.picked_by = ctx.user.id
    line.picked_at = nowIso()
    if (!linesOf(list).some((l) => l.status === 'pending')) complete(list)
    return json(detail(list))
  })

  router.post('/picking/:id/complete', (ctx) => {
    const list = findOr404(db().pick_lists, ctx.id())
    ensureWarehouse(ctx.user, list.warehouse_id)
    complete(list)
    return json(detail(list))
  })

  router.post('/picking/:id/cancel', (ctx) => {
    const list = findOr404(db().pick_lists, ctx.id())
    ensureWarehouse(ctx.user, list.warehouse_id)
    ensureOpen(list)
    const time = nowIso()
    list.status = 'cancelled'
    list.completed_at = time
    list.updated_at = time
    return json(detail(list))
  })
}
