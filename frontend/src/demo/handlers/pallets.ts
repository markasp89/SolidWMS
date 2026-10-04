/**
 * Pallets (module "pallets"): items are stock locations with pallet_id.
 */
import { db, nextId, now, nowIso } from '../db'
import { emit } from '../events'
import { invalid, json, MESSAGES, noContent, notFound, Validator } from '../http'
import { palletResource, stockItemResource } from '../present'
import { allowedWarehouseIds, canAccess, clampPerPage, ensureWarehouse, findOr404, paginate, productById, productMatches, sectorById } from '../repo'
import type { Ctx, Router } from '../router'
import * as stock from '../stock'
import type { PalletRow } from '../types'

const PALLET_CODE = /^[A-Za-z0-9_.-]+$/

function nextCode(): string {
  let next = db().pallets.reduce((max, p) => Math.max(max, p.id), 0) + 1
  let code: string
  do {
    code = `P-${String(next++).padStart(5, '0')}`
  } while (db().pallets.some((p) => p.code === code))
  return code
}

function authorize(ctx: Ctx, pallet: PalletRow): void {
  if (pallet.sector_id !== null) ensureWarehouse(ctx.user, sectorById(pallet.sector_id)?.warehouse_id)
}

function sectorOf(pallet: PalletRow) {
  const sector = sectorById(pallet.sector_id)
  if (!sector) invalid('pallet', 'Paleta nie ma przypisanego miejsca.')
  return sector
}

export function registerPallets(root: Router): void {
  const router = root.with({ module: 'pallets' })

  router.get('/pallets', (ctx) => {
    const allowed = allowedWarehouseIds(ctx.user)
    const term = ctx.q('q') ?? ''
    const sectorId = ctx.qInt('sector_id')
    const warehouseId = ctx.qInt('warehouse_id')
    const rows = db()
      .pallets.filter((pallet) => {
        const warehouse = sectorById(pallet.sector_id)?.warehouse_id
        if (allowed !== null && !canAccess(allowed, warehouse)) return false
        if (sectorId !== null && pallet.sector_id !== sectorId) return false
        if (warehouseId !== null && warehouse !== warehouseId) return false
        if (term) {
          const byCode = pallet.code.includes(term.toUpperCase())
          const byProduct = db().stock.some((i) => {
            const product = i.pallet_id === pallet.id ? productById(i.product_id) : undefined
            return product !== undefined && productMatches(product, term)
          })
          if (!byCode && !byProduct) return false
        }
        return true
      })
      .sort((a, b) => (a.updated_at === b.updated_at ? b.id - a.id : a.updated_at < b.updated_at ? 1 : -1))
    return json(paginate(rows, ctx.qInt('page'), clampPerPage(ctx.qInt('per_page'), 30), (p) => palletResource(p, false)))
  })

  router.post('/pallets', (ctx) => {
    const v = new Validator(ctx.body)
    const sectorId = v.integer('sector_id', true)
    if (typeof sectorId === 'number' && !sectorById(sectorId)) v.fail('sector_id', MESSAGES.exists('sector_id'))
    const slot = v.string('slot', { max: 32 })
    const code = v.string('code', { max: 32, regex: PALLET_CODE })
    if (code && db().pallets.some((p) => p.code === code.toUpperCase())) v.fail('code', 'Paleta o tym numerze już istnieje.')
    const note = v.string('note', { max: 255 })
    v.validate()
    const sector = sectorById(sectorId ?? null)
    ensureWarehouse(ctx.user, sector?.warehouse_id)
    const time = nowIso()
    const pallet: PalletRow = {
      id: nextId('pallets'),
      code: code ? code.toUpperCase() : nextCode(),
      sector_id: sector?.id ?? null,
      slot: stock.normalize({ slot }).slot,
      note: note ?? null,
      created_by: ctx.user.id,
      moved_by: null,
      moved_at: null,
      created_at: time,
      updated_at: time,
    }
    db().pallets.push(pallet)
    return json(palletResource(pallet, true), 201)
  })

  router.get('/pallets/code/:code', (ctx) => {
    const code = (ctx.params.code ?? '').toUpperCase()
    const pallet = db().pallets.find((p) => p.code === code)
    if (!pallet) throw notFound()
    authorize(ctx, pallet)
    return json(palletResource(pallet, true))
  })

  router.get('/pallets/:id', (ctx) => {
    const pallet = findOr404(db().pallets, ctx.id())
    authorize(ctx, pallet)
    return json(palletResource(pallet, true))
  })

  router.patch('/pallets/:id', (ctx) => {
    const pallet = findOr404(db().pallets, ctx.id())
    authorize(ctx, pallet)
    const v = new Validator(ctx.body)
    const code = v.string('code', { max: 32, regex: PALLET_CODE })
    if (v.has('code') && !code) v.fail('code', MESSAGES.required('code'))
    if (code && db().pallets.some((p) => p.code === code && p.id !== pallet.id)) v.fail('code', 'Paleta o tym numerze już istnieje.')
    const note = v.string('note', { max: 255 })
    v.validate()
    if (code) pallet.code = code
    if (note !== undefined) pallet.note = note
    pallet.updated_at = nowIso()
    return json(palletResource(pallet, true))
  })

  router.delete('/pallets/:id', (ctx) => {
    const pallet = findOr404(db().pallets, ctx.id())
    authorize(ctx, pallet)
    if (db().stock.some((i) => i.pallet_id === pallet.id)) {
      invalid('pallet', 'Paleta nie jest pusta. Wydaj lub przenieś towar przed usunięciem.')
    }
    db().pallets = db().pallets.filter((p) => p.id !== pallet.id)
    db().photos = db().photos.filter((p) => !(p.subject_type === 'pallet' && p.subject_id === pallet.id))
    return noContent()
  })

  router.post('/pallets/:id/items', (ctx) => {
    const pallet = findOr404(db().pallets, ctx.id())
    const v = new Validator(ctx.body)
    const productId = v.integer('product_id', true)
    if (typeof productId === 'number' && !productById(productId)) v.fail('product_id', MESSAGES.exists('product_id'))
    const quantity = v.quantity()
    const note = v.string('note', { max: 255 })
    const dimensions = v.dimensions()
    v.validate()
    const sector = sectorOf(pallet)
    const item = stock.receive(
      productId ?? 0,
      sector.id,
      quantity ?? 0,
      ctx.user,
      note ?? null,
      { slot: pallet.slot, batch: dimensions.batch, expires_at: dimensions.expires_at, pallet_id: pallet.id },
      pallet.code,
    )
    pallet.updated_at = nowIso()
    return json(stockItemResource(item))
  })

  router.post('/pallets/:id/move', (ctx) => {
    const pallet = findOr404(db().pallets, ctx.id())
    const v = new Validator(ctx.body)
    const targetId = v.integer('to_sector_id', true)
    if (typeof targetId === 'number' && !sectorById(targetId)) v.fail('to_sector_id', MESSAGES.exists('to_sector_id'))
    const toSlot = v.string('to_slot', { max: 32 })
    const note = v.string('note', { max: 255 })
    v.validate()
    const target = sectorById(targetId ?? null)
    if (!target) throw notFound()
    ensureWarehouse(ctx.user, target.warehouse_id)
    if (pallet.sector_id !== null) ensureWarehouse(ctx.user, sectorOf(pallet).warehouse_id)
    const slot = stock.normalize({ slot: toSlot }).slot
    if (pallet.sector_id === target.id && pallet.slot === slot) invalid('to_sector_id', 'Paleta już stoi w tym miejscu.')

    for (const item of db().stock.filter((i) => i.pallet_id === pallet.id)) {
      stock.move(item, target.id, item.quantity, ctx.user, note ?? `Paleta ${pallet.code}`, { slot, pallet_id: pallet.id }, pallet.code)
    }
    pallet.sector_id = target.id
    pallet.slot = slot
    pallet.moved_by = ctx.user.id
    pallet.moved_at = now().toISOString()
    pallet.updated_at = pallet.moved_at
    emit('pallet.moved')
    return json(palletResource(pallet, true))
  })
}
