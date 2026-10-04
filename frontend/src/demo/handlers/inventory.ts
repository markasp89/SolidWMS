/**
 * Products, stock locations, movements, search and dashboard (module "inventory").
 */
import { db, nextId, nowIso } from '../db'
import { emit } from '../events'
import { invalid, json, MAX_QTY, MESSAGES, noContent, SLOT_MESSAGE, SLOT_REGEX, Validator } from '../http'
import { movementResource, productResource, stockItemResource } from '../present'
import {
  allowedWarehouseIds,
  byName,
  canAccess,
  clampPerPage,
  ensureWarehouse,
  findOr404,
  nullsFirst,
  paginate,
  productById,
  productMatches,
  sectorById,
} from '../repo'
import type { Ctx, Router } from '../router'
import * as stock from '../stock'
import type { MovementRow, ProductRow, StockRow, UserRow } from '../types'

/** Stock locations of a product visible to the user. */
export function visibleLocations(productId: number, user: UserRow): StockRow[] {
  const allowed = allowedWarehouseIds(user)
  return db().stock.filter((i) => i.product_id === productId && canAccess(allowed, sectorById(i.sector_id)?.warehouse_id))
}

const productDetail = (product: ProductRow, user: UserRow) => productResource(product, visibleLocations(product.id, user))

const stockResponse = (item: StockRow | null) => json(item ? stockItemResource(item) : { deleted: true })

export function registerInventory(router: Router): void {
  router.get('/dashboard', () => {
    const state = db()
    return json({
      stats: {
        warehouses: state.warehouses.length,
        sectors: state.sectors.length,
        products: state.products.length,
        locations: state.stock.length,
        products_without_location: state.products.filter((p) => !state.stock.some((i) => i.product_id === p.id)).length,
      },
      recent_movements: newestFirst(state.movements).slice(0, 10).map(movementResource),
    })
  })

  router.get('/search', (ctx) => {
    const q = ctx.q('q')
    if (q === null) invalid('q', MESSAGES.required('q'))
    if (q.length > 100) invalid('q', MESSAGES.max('q', 100))
    return json(
      db()
        .products.filter((p) => productMatches(p, q))
        .sort((a, b) => byName(a.name, b.name))
        .slice(0, 25)
        .map((p) => productDetail(p, ctx.user)),
    )
  })

  // Products -----------------------------------------------------------------
  router.get('/products', (ctx) => {
    const q = ctx.q('q') ?? ''
    const rows = db()
      .products.filter((p) => productMatches(p, q))
      .sort((a, b) => byName(a.name, b.name))
    return json(paginate(rows, ctx.qInt('page'), clampPerPage(ctx.qInt('per_page'), 25), (p) => productResource(p)))
  })

  router.post('/products', (ctx) => {
    const data = validateProduct(ctx, null)
    const time = nowIso()
    const product: ProductRow = {
      id: nextId('products'),
      sku: data.sku ?? '',
      name: data.name ?? '',
      barcode: data.barcode ?? null,
      unit: data.unit ?? 'szt',
      description: data.description ?? null,
      min_quantity: null,
      created_at: time,
      updated_at: time,
    }
    db().products.push(product)
    emit('product.saved')
    if (data.initial) {
      const { sector_id, quantity, note, ...dimensions } = data.initial
      stock.receive(product.id, sector_id, quantity, ctx.user, note, dimensions)
    }
    return json(productDetail(product, ctx.user), 201)
  })

  router.get('/products/:id', (ctx) => json(productDetail(findOr404(db().products, ctx.id()), ctx.user)))

  router.add(['PUT', 'PATCH'], '/products/:id', (ctx) => {
    const product = findOr404(db().products, ctx.id())
    const { initial: _initial, ...data } = validateProduct(ctx, product)
    Object.assign(product, data, { updated_at: nowIso() })
    emit('product.saved')
    return json(productDetail(product, ctx.user))
  })

  router.delete(
    '/products/:id',
    (ctx) => {
      const product = findOr404(db().products, ctx.id())
      deleteProduct(product)
      emit('product.deleted')
      return noContent()
    },
    { roles: ['admin', 'manager'] },
  )

  // Stock ------------------------------------------------------------------------
  router.get('/stock', (ctx) => {
    const allowed = allowedWarehouseIds(ctx.user)
    const sectorId = ctx.qInt('sector_id')
    const productId = ctx.qInt('product_id')
    const palletId = ctx.qInt('pallet_id')
    const warehouseId = ctx.qInt('warehouse_id')
    const q = ctx.q('q')
    const rows = db().stock.filter((item) => {
      const warehouse = sectorById(item.sector_id)?.warehouse_id
      if (!canAccess(allowed, warehouse)) return false
      if (sectorId !== null && item.sector_id !== sectorId) return false
      if (productId !== null && item.product_id !== productId) return false
      if (palletId !== null && item.pallet_id !== palletId) return false
      if (warehouseId !== null && warehouse !== warehouseId) return false
      if (q !== null) {
        const product = productById(item.product_id)
        if (!product || !productMatches(product, q)) return false
      }
      return true
    })
    rows.sort((a, b) => byName(productById(a.product_id)?.name ?? '', productById(b.product_id)?.name ?? '') || nullsFirst(a.slot, b.slot))
    return json(rows.slice(0, 1000).map(stockItemResource))
  })

  router.get('/warehouses/:id/stock-summary', (ctx) => {
    const warehouse = findOr404(db().warehouses, ctx.id())
    ensureWarehouse(ctx.user, warehouse.id)
    const summary = new Map<number, { sector_id: number; products: Set<number>; total_quantity: number }>()
    for (const item of db().stock) {
      if (sectorById(item.sector_id)?.warehouse_id !== warehouse.id) continue
      const row = summary.get(item.sector_id) ?? { sector_id: item.sector_id, products: new Set<number>(), total_quantity: 0 }
      row.products.add(item.product_id)
      row.total_quantity += item.quantity
      summary.set(item.sector_id, row)
    }
    return json(
      [...summary.values()].map((row) => ({
        sector_id: row.sector_id,
        products_count: row.products.size,
        total_quantity: Math.round(row.total_quantity * 1000) / 1000,
      })),
    )
  })

  router.post('/stock/receive', (ctx) => {
    const v = new Validator(ctx.body)
    const productId = v.integer('product_id', true)
    const sectorId = v.integer('sector_id', true)
    if (typeof productId === 'number' && !productById(productId)) v.fail('product_id', MESSAGES.exists('product_id'))
    if (typeof sectorId === 'number' && !sectorById(sectorId)) v.fail('sector_id', MESSAGES.exists('sector_id'))
    const quantity = v.quantity()
    const note = v.string('note', { max: 255 })
    const dimensions = v.dimensions()
    v.validate()
    const item = stock.receive(productId ?? 0, sectorId ?? 0, quantity ?? 0, ctx.user, note ?? null, dimensions)
    return json(stockItemResource(item))
  })

  router.post('/stock/:id/issue', (ctx) => {
    const item = findOr404(db().stock, ctx.id())
    const v = new Validator(ctx.body)
    const quantity = v.quantity()
    const note = v.string('note', { max: 255 })
    v.validate()
    return stockResponse(stock.issue(item, quantity ?? 0, ctx.user, note ?? null))
  })

  router.post('/stock/:id/move', (ctx) => {
    const item = findOr404(db().stock, ctx.id())
    const v = new Validator(ctx.body)
    const toSectorId = v.integer('to_sector_id', true)
    if (typeof toSectorId === 'number' && !sectorById(toSectorId)) v.fail('to_sector_id', MESSAGES.exists('to_sector_id'))
    const toSlot = v.string('to_slot', { max: 32, regex: SLOT_REGEX, regexMessage: SLOT_MESSAGE })
    const quantity = v.quantity()
    const note = v.string('note', { max: 255 })
    v.validate()
    return json(stockItemResource(stock.move(item, toSectorId ?? 0, quantity ?? 0, ctx.user, note ?? null, { slot: toSlot ?? null })))
  })

  router.add(['PUT', 'PATCH'], '/stock/:id', (ctx) => {
    const item = findOr404(db().stock, ctx.id())
    const v = new Validator(ctx.body)
    const quantity = v.number('quantity', { gte0: true, max: MAX_QTY })
    if (v.has('quantity') && quantity === null) v.fail('quantity', MESSAGES.numeric('quantity'))
    const note = v.string('note', { max: 255 })
    v.validate()
    return stockResponse(stock.adjust(item, typeof quantity === 'number' ? quantity : null, ctx.user, note ?? null, v.has('note')))
  })

  // Movements ---------------------------------------------------------------------
  router.get('/movements', (ctx) => {
    const allowed = allowedWarehouseIds(ctx.user)
    const sectorsIn = (warehouseIds: number[]) =>
      new Set(
        db()
          .sectors.filter((s) => warehouseIds.includes(s.warehouse_id))
          .map((s) => s.id),
      )
    const touches = (m: MovementRow, sectorIds: Set<number>) =>
      (m.from_sector_id !== null && sectorIds.has(m.from_sector_id)) || (m.to_sector_id !== null && sectorIds.has(m.to_sector_id))

    const allowedSectors = allowed === null ? null : sectorsIn(allowed)
    const productId = ctx.qInt('product_id')
    const sectorId = ctx.qInt('sector_id')
    const warehouseId = ctx.qInt('warehouse_id')
    const warehouseSectors = warehouseId === null ? null : sectorsIn([warehouseId])
    const palletId = ctx.qInt('pallet_id')
    const userId = ctx.qInt('user_id')
    const reference = ctx.q('reference')
    const type = ctx.q('type')

    const rows = newestFirst(db().movements).filter(
      (m) =>
        (allowedSectors === null || touches(m, allowedSectors)) &&
        (productId === null || m.product_id === productId) &&
        (sectorId === null || touches(m, new Set([sectorId]))) &&
        (warehouseSectors === null || touches(m, warehouseSectors)) &&
        (palletId === null || m.pallet_id === palletId) &&
        (userId === null || m.user_id === userId) &&
        (reference === null || m.reference === reference) &&
        (type === null || m.type === type),
    )
    return json(paginate(rows, ctx.qInt('page'), clampPerPage(ctx.qInt('per_page'), 30), movementResource))
  })
}

/** Newest first (created_at, then id). */
export const newestFirst = (rows: MovementRow[]): MovementRow[] =>
  [...rows].sort((a, b) => (a.created_at === b.created_at ? b.id - a.id : a.created_at < b.created_at ? 1 : -1))

interface ProductInput {
  sku?: string
  name?: string
  barcode?: string | null
  unit?: string
  description?: string | null
  initial?: {
    sector_id: number
    quantity: number
    note: string | null
    slot?: string | null
    batch?: string | null
    expires_at?: string | null
  }
}

function validateProduct(ctx: Ctx, product: ProductRow | null): ProductInput {
  const creating = product === null
  const v = new Validator(ctx.body)
  const rawSku = v.string('sku', { required: creating, max: 64 })
  const sku = rawSku ? rawSku.toUpperCase() : rawSku
  if (sku && db().products.some((p) => p.sku === sku && p.id !== product?.id)) v.fail('sku', 'Produkt o tym kodzie SKU już istnieje.')
  if (!creating && v.has('sku') && !sku) v.fail('sku', MESSAGES.required('sku'))
  const name = v.string('name', { required: creating, max: 255 })
  if (!creating && v.has('name') && !name) v.fail('name', MESSAGES.required('name'))
  const barcode = v.string('barcode', { max: 64 })
  const unit = v.string('unit', { max: 16 })
  if (v.has('unit') && !unit) v.fail('unit', MESSAGES.required('unit'))
  const description = v.string('description', { max: 5000 })

  let initial: ProductInput['initial']
  if (v.filled('initial_stock')) {
    if (!creating) v.fail('initial_stock', MESSAGES.prohibited('initial_stock'))
    const raw = v.raw('initial_stock')
    const n = v.nested('initial_stock', raw)
    const sectorId = n.integer('sector_id', true)
    if (typeof sectorId === 'number' && !sectorById(sectorId)) n.fail('sector_id', MESSAGES.exists('sector_id'))
    const quantity = n.quantity()
    const note = n.string('note', { max: 255 })
    const dimensions = n.dimensions()
    if (typeof sectorId === 'number' && quantity !== undefined) {
      initial = { sector_id: sectorId, quantity, note: note ?? null, ...dimensions }
    }
  }
  v.validate()
  return {
    ...(sku ? { sku } : {}),
    ...(name ? { name } : {}),
    ...(barcode !== undefined ? { barcode } : {}),
    ...(unit ? { unit } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(initial ? { initial } : {}),
  }
}

function deleteProduct(product: ProductRow): void {
  const state = db()
  if (state.document_lines.some((l) => l.product_id === product.id) || state.pick_lines.some((l) => l.product_id === product.id)) {
    invalid('product', 'Produkt występuje w dokumentach lub listach kompletacji i nie może zostać usunięty.')
  }
  for (const item of state.stock.filter((i) => i.product_id === product.id)) stock.deleteStockItem(item.id)
  state.movements = state.movements.filter((m) => m.product_id !== product.id)
  state.stocktake_lines = state.stocktake_lines.filter((l) => l.product_id !== product.id)
  state.photos = state.photos.filter((p) => !(p.subject_type === 'product' && p.subject_id === product.id))
  state.products = state.products.filter((p) => p.id !== product.id)
}
