/**
 * Stocktaking (module "stocktaking"): count a sector, then apply corrections in one go.
 */
import { db, nextId, nowIso } from '../db'
import { emit } from '../events'
import { invalid, json, MAX_QTY, MESSAGES, notFound, round3, Validator } from '../http'
import { productRef, sectorSummary } from '../present'
import { allowedWarehouseIds, canAccess, ensureWarehouse, findOr404, productById, sectorById, stockById, userRef } from '../repo'
import type { Ctx, Router } from '../router'
import * as stock from '../stock'
import type { StocktakeRow } from '../types'

const reference = (s: StocktakeRow) => `INW/${String(s.id).padStart(5, '0')}`

const linesOf = (s: StocktakeRow) => db().stocktake_lines.filter((l) => l.stocktake_id === s.id)

function ensureOpen(s: StocktakeRow): void {
  if (s.status !== 'open') invalid('stocktake', 'Inwentaryzacja jest już zamknięta.')
}

function authorize(ctx: Ctx, s: StocktakeRow): void {
  ensureWarehouse(ctx.user, sectorById(s.sector_id)?.warehouse_id)
}

function summary(s: StocktakeRow) {
  return {
    id: s.id,
    reference: reference(s),
    status: s.status,
    note: s.note,
    sector: sectorSummary(s.sector_id),
    lines_count: linesOf(s).length,
    created_by: userRef(s.created_by),
    completed_by: userRef(s.completed_by),
    created_at: s.created_at,
    completed_at: s.completed_at,
  }
}

function detail(s: StocktakeRow) {
  const name = (productId: number) => productById(productId)?.name ?? ''
  const lines = [...linesOf(s)].sort((a, b) => (a.slot ?? '').localeCompare(b.slot ?? '') || name(a.product_id).localeCompare(name(b.product_id), 'pl'))
  return {
    ...summary(s),
    lines: lines.map((l) => ({
      id: l.id,
      product: productRef(l.product_id),
      slot: l.slot,
      batch: l.batch,
      expires_at: l.expires_at,
      pallet_id: l.pallet_id,
      expected: l.expected,
      counted: l.counted,
      difference: l.counted === null ? null : round3(l.counted - l.expected),
    })),
  }
}

export function registerStocktaking(root: Router): void {
  const router = root.with({ module: 'stocktaking' })
  const managers = router.with({ roles: ['admin', 'manager'] })

  router.get('/stocktakes', (ctx) => {
    const allowed = allowedWarehouseIds(ctx.user)
    const status = ctx.q('status')
    const sectorId = ctx.qInt('sector_id')
    return json(
      db()
        .stocktakes.filter(
          (s) =>
            canAccess(allowed, sectorById(s.sector_id)?.warehouse_id) &&
            (status === null || s.status === status) &&
            (sectorId === null || s.sector_id === sectorId),
        )
        .sort((a, b) => (a.created_at === b.created_at ? b.id - a.id : a.created_at < b.created_at ? 1 : -1))
        .slice(0, 100)
        .map(summary),
    )
  })

  router.post('/stocktakes', (ctx) => {
    const v = new Validator(ctx.body)
    const sectorId = v.integer('sector_id', true)
    if (typeof sectorId === 'number' && !sectorById(sectorId)) v.fail('sector_id', MESSAGES.exists('sector_id'))
    const note = v.string('note', { max: 255 })
    v.validate()
    const sector = sectorById(sectorId ?? null)
    ensureWarehouse(ctx.user, sector?.warehouse_id)
    if (db().stocktakes.some((s) => s.sector_id === sectorId && s.status === 'open')) {
      invalid('sector_id', 'W tym sektorze trwa już inwentaryzacja.')
    }
    const time = nowIso()
    const stocktake: StocktakeRow = {
      id: nextId('stocktakes'),
      sector_id: sectorId ?? 0,
      status: 'open',
      note: note ?? null,
      created_by: ctx.user.id,
      completed_by: null,
      completed_at: null,
      created_at: time,
      updated_at: time,
    }
    db().stocktakes.push(stocktake)
    for (const item of db().stock.filter((i) => i.sector_id === sectorId)) {
      db().stocktake_lines.push({
        id: nextId('stocktake_lines'),
        stocktake_id: stocktake.id,
        stock_item_id: item.id,
        product_id: item.product_id,
        slot: item.slot,
        batch: item.batch,
        expires_at: item.expires_at,
        pallet_id: item.pallet_id,
        expected: item.quantity,
        counted: null,
        counted_by: null,
      })
    }
    return json(detail(stocktake), 201)
  })

  router.get('/stocktakes/:id', (ctx) => {
    const stocktake = findOr404(db().stocktakes, ctx.id())
    authorize(ctx, stocktake)
    return json(detail(stocktake))
  })

  router.put('/stocktakes/:id/lines/:line', (ctx) => {
    const stocktake = findOr404(db().stocktakes, ctx.id())
    const line = findOr404(db().stocktake_lines, ctx.id('line'))
    if (line.stocktake_id !== stocktake.id) throw notFound()
    authorize(ctx, stocktake)
    ensureOpen(stocktake)
    const v = new Validator(ctx.body)
    if (!v.has('counted')) v.fail('counted', MESSAGES.required('counted'))
    const counted = v.number('counted', { gte0: true, max: MAX_QTY })
    v.validate()
    line.counted = typeof counted === 'number' ? counted : null
    line.counted_by = ctx.user.id
    stocktake.updated_at = nowIso()
    return json(detail(stocktake))
  })

  router.post('/stocktakes/:id/lines', (ctx) => {
    const stocktake = findOr404(db().stocktakes, ctx.id())
    authorize(ctx, stocktake)
    ensureOpen(stocktake)
    const v = new Validator(ctx.body)
    const productId = v.integer('product_id', true)
    if (typeof productId === 'number' && !productById(productId)) v.fail('product_id', MESSAGES.exists('product_id'))
    const counted = v.quantity('counted')
    const dimensions = v.dimensions()
    v.validate()
    const d = stock.normalize(dimensions)
    db().stocktake_lines.push({
      id: nextId('stocktake_lines'),
      stocktake_id: stocktake.id,
      stock_item_id: null,
      product_id: productId ?? 0,
      slot: d.slot,
      batch: d.batch,
      expires_at: d.expires_at,
      pallet_id: null,
      expected: 0,
      counted: counted ?? 0,
      counted_by: ctx.user.id,
    })
    return json(detail(stocktake), 201)
  })

  managers.post('/stocktakes/:id/complete', (ctx) => {
    const stocktake = findOr404(db().stocktakes, ctx.id())
    authorize(ctx, stocktake)
    ensureOpen(stocktake)
    const ref = reference(stocktake)
    const note = `Inwentaryzacja ${ref}`
    const result = { changed: 0, unchanged: 0, skipped: 0 }
    for (const line of linesOf(stocktake)) {
      if (line.counted === null) {
        result.skipped++
        continue
      }
      const item = stockById(line.stock_item_id)
      const current = item?.quantity ?? 0
      if (Math.abs(current - line.counted) < 0.0005) {
        result.unchanged++
        continue
      }
      if (item) {
        stock.adjust(item, line.counted, ctx.user, note, false, ref)
      } else if (line.counted > 0) {
        stock.receive(
          line.product_id,
          stocktake.sector_id,
          line.counted,
          ctx.user,
          note,
          { slot: line.slot, batch: line.batch, expires_at: line.expires_at, pallet_id: line.pallet_id },
          ref,
        )
      }
      result.changed++
    }
    const time = nowIso()
    Object.assign(stocktake, { status: 'completed', completed_by: ctx.user.id, completed_at: time, updated_at: time })
    emit('stocktake.completed')
    return json({ result, ...detail(stocktake) })
  })

  managers.post('/stocktakes/:id/cancel', (ctx) => {
    const stocktake = findOr404(db().stocktakes, ctx.id())
    authorize(ctx, stocktake)
    ensureOpen(stocktake)
    const time = nowIso()
    Object.assign(stocktake, { status: 'cancelled', completed_by: ctx.user.id, completed_at: time, updated_at: time })
    return json(detail(stocktake))
  })
}
