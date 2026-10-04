/**
 * Warehouses, sectors, floor plans and floors.
 */
import { db, nextId, nowIso } from '../db'
import { CODE_MESSAGE, CODE_REGEX, invalid, json, MESSAGES, noContent, Validator } from '../http'
import { readImage } from '../images'
import { floorResource, sectorResource, warehouseResource } from '../present'
import { allowedWarehouseIds, byName, canAccess, ensureWarehouse, findOr404 } from '../repo'
import type { Router } from '../router'
import type { FloorRow, Point, SectorRow, WarehouseRow } from '../types'

const PLAN_INVALID = 'Rzut magazynu musi być obrazem PNG, JPG, WEBP lub GIF.'

export function registerWarehouses(router: Router): void {
  const admin = router.with({ roles: ['admin'] })

  router.get('/warehouses', (ctx) => {
    const allowed = allowedWarehouseIds(ctx.user)
    return json(
      db()
        .warehouses.filter((w) => canAccess(allowed, w.id))
        .sort((a, b) => byName(a.name, b.name))
        .map((w) => warehouseResource(w, false)),
    )
  })

  router.get('/warehouses/:id', (ctx) => {
    const warehouse = findOr404(db().warehouses, ctx.id())
    ensureWarehouse(ctx.user, warehouse.id)
    return json(warehouseResource(warehouse, true))
  })

  admin.post('/warehouses', (ctx) => {
    const data = validateWarehouse(ctx.body, null)
    const time = nowIso()
    const warehouse: WarehouseRow = {
      id: nextId('warehouses'),
      code: data.code ?? '',
      name: data.name ?? '',
      address: data.address ?? null,
      description: data.description ?? null,
      floor_plan: null,
      created_at: time,
      updated_at: time,
    }
    db().warehouses.push(warehouse)
    return json(warehouseResource(warehouse, true), 201)
  })

  admin.add(['PUT', 'PATCH'], '/warehouses/:id', (ctx) => {
    const warehouse = findOr404(db().warehouses, ctx.id())
    Object.assign(warehouse, validateWarehouse(ctx.body, warehouse), { updated_at: nowIso() })
    return json(warehouseResource(warehouse, true))
  })

  admin.delete('/warehouses/:id', (ctx) => {
    const warehouse = findOr404(db().warehouses, ctx.id())
    const state = db()
    if (state.documents.some((d) => d.warehouse_id === warehouse.id) || state.pick_lists.some((l) => l.warehouse_id === warehouse.id)) {
      invalid('warehouse', 'Magazyn ma dokumenty lub listy kompletacji i nie może zostać usunięty.')
    }
    for (const sector of state.sectors.filter((s) => s.warehouse_id === warehouse.id)) deleteSector(sector)
    state.floors = state.floors.filter((f) => f.warehouse_id !== warehouse.id)
    state.user_warehouse = state.user_warehouse.filter((r) => r.warehouse_id !== warehouse.id)
    state.warehouses = state.warehouses.filter((w) => w.id !== warehouse.id)
    return noContent()
  })

  // Floor plan -----------------------------------------------------------------
  admin.post('/warehouses/:id/floor-plan', async (ctx) => {
    const warehouse = findOr404(db().warehouses, ctx.id())
    const image = await readImage(ctx.form, 'floor_plan', PLAN_INVALID)
    warehouse.floor_plan = image
    warehouse.updated_at = nowIso()
    return json(warehouseResource(warehouse, true))
  })

  admin.delete('/warehouses/:id/floor-plan', (ctx) => {
    const warehouse = findOr404(db().warehouses, ctx.id())
    warehouse.floor_plan = null
    warehouse.updated_at = nowIso()
    return json(warehouseResource(warehouse, true))
  })

  // Sectors --------------------------------------------------------------------
  router.get('/warehouses/:id/sectors', (ctx) => {
    const warehouse = findOr404(db().warehouses, ctx.id())
    ensureWarehouse(ctx.user, warehouse.id)
    return json(
      db()
        .sectors.filter((s) => s.warehouse_id === warehouse.id)
        .sort((a, b) => (a.code < b.code ? -1 : 1))
        .map((s) => sectorResource(s, false)),
    )
  })

  router.get('/sectors/:id', (ctx) => {
    const sector = findOr404(db().sectors, ctx.id())
    ensureWarehouse(ctx.user, sector.warehouse_id)
    return json(sectorResource(sector))
  })

  admin.post('/warehouses/:id/sectors', (ctx) => {
    const warehouse = findOr404(db().warehouses, ctx.id())
    const data = validateSector(ctx.body, warehouse.id, null)
    const time = nowIso()
    const sector: SectorRow = {
      id: nextId('sectors'),
      warehouse_id: warehouse.id,
      floor_id: data.floor_id ?? null,
      code: data.code ?? '',
      name: data.name ?? '',
      color: data.color ?? '#2563eb',
      description: data.description ?? null,
      shape: data.shape ?? null,
      created_at: time,
      updated_at: time,
    }
    db().sectors.push(sector)
    return json(sectorResource(sector), 201)
  })

  admin.add(['PUT', 'PATCH'], '/sectors/:id', (ctx) => {
    const sector = findOr404(db().sectors, ctx.id())
    Object.assign(sector, validateSector(ctx.body, sector.warehouse_id, sector), { updated_at: nowIso() })
    return json(sectorResource(sector))
  })

  admin.delete('/sectors/:id', (ctx) => {
    deleteSector(findOr404(db().sectors, ctx.id()))
    return noContent()
  })

  // Floors (module "floors") ---------------------------------------------------
  const floors = router.with({ module: 'floors' })
  const floorsAdmin = floors.with({ roles: ['admin'] })

  floors.get('/warehouses/:id/floors', (ctx) => {
    const warehouse = findOr404(db().warehouses, ctx.id())
    ensureWarehouse(ctx.user, warehouse.id)
    return json(
      db()
        .floors.filter((f) => f.warehouse_id === warehouse.id)
        .sort((a, b) => a.level - b.level || a.id - b.id)
        .map(floorResource),
    )
  })

  floorsAdmin.post('/warehouses/:id/floors', (ctx) => {
    const warehouse = findOr404(db().warehouses, ctx.id())
    const v = new Validator(ctx.body)
    const name = v.string('name', { required: true, max: 100 })
    const level = v.number('level', { integer: true, min: -10, max: 200 })
    v.validate()
    const levels = db()
      .floors.filter((f) => f.warehouse_id === warehouse.id)
      .map((f) => f.level)
    const time = nowIso()
    const floor: FloorRow = {
      id: nextId('floors'),
      warehouse_id: warehouse.id,
      name: name ?? '',
      level: level ?? (levels.length ? Math.max(...levels) : 0) + 1,
      floor_plan: null,
      created_at: time,
      updated_at: time,
    }
    db().floors.push(floor)
    return json(floorResource(floor), 201)
  })

  floorsAdmin.patch('/floors/:id', (ctx) => {
    const floor = findOr404(db().floors, ctx.id())
    const v = new Validator(ctx.body)
    const name = v.string('name', { max: 100 })
    const level = v.number('level', { integer: true, min: -10, max: 200 })
    if (v.has('name') && name === null) v.fail('name', MESSAGES.required('name'))
    if (v.has('level') && level === null) v.fail('level', MESSAGES.integer('level'))
    v.validate()
    if (name) floor.name = name
    if (typeof level === 'number') floor.level = level
    floor.updated_at = nowIso()
    return json(floorResource(floor))
  })

  floorsAdmin.delete('/floors/:id', (ctx) => {
    const floor = findOr404(db().floors, ctx.id())
    if (db().sectors.some((s) => s.floor_id === floor.id)) invalid('floor', 'Najpierw usuń sektory z tego piętra.')
    db().floors = db().floors.filter((f) => f.id !== floor.id)
    return noContent()
  })

  floorsAdmin.post('/floors/:id/plan', async (ctx) => {
    const floor = findOr404(db().floors, ctx.id())
    const image = await readImage(ctx.form, 'floor_plan', PLAN_INVALID)
    floor.floor_plan = image
    floor.updated_at = nowIso()
    return json(floorResource(floor))
  })

  floorsAdmin.delete('/floors/:id/plan', (ctx) => {
    const floor = findOr404(db().floors, ctx.id())
    floor.floor_plan = null
    floor.updated_at = nowIso()
    return json(floorResource(floor))
  })
}

/** Deletes a sector (refused while it holds goods) with everything that cascades. */
export function deleteSector(sector: SectorRow): void {
  const state = db()
  const count = state.stock.filter((i) => i.sector_id === sector.id).length
  if (count > 0) {
    invalid('sector', `Sektor ${sector.code} zawiera ${count} pozycji. Przenieś lub wydaj towar przed usunięciem.`)
  }
  const stocktakes = new Set(state.stocktakes.filter((s) => s.sector_id === sector.id).map((s) => s.id))
  state.stocktakes = state.stocktakes.filter((s) => !stocktakes.has(s.id))
  state.stocktake_lines = state.stocktake_lines.filter((l) => !stocktakes.has(l.stocktake_id))
  for (const m of state.movements) {
    if (m.from_sector_id === sector.id) m.from_sector_id = null
    if (m.to_sector_id === sector.id) m.to_sector_id = null
  }
  for (const p of state.pallets) if (p.sector_id === sector.id) p.sector_id = null
  for (const l of state.pick_lines) if (l.sector_id === sector.id) l.sector_id = null
  for (const l of state.document_lines) if (l.sector_id === sector.id) l.sector_id = null
  state.sectors = state.sectors.filter((s) => s.id !== sector.id)
}

interface WarehouseInput {
  code?: string
  name?: string
  address?: string | null
  description?: string | null
}

function validateWarehouse(body: unknown, warehouse: WarehouseRow | null): WarehouseInput {
  const creating = warehouse === null
  const v = new Validator(body)
  const rawCode = v.string('code', { required: creating, max: 32 })
  const code = rawCode ? rawCode.toUpperCase() : rawCode
  if (code) {
    if (!CODE_REGEX.test(code)) v.fail('code', CODE_MESSAGE)
    else if (db().warehouses.some((w) => w.code === code && w.id !== warehouse?.id)) v.fail('code', 'Magazyn o tym kodzie już istnieje.')
  } else if (!creating && v.has('code')) v.fail('code', MESSAGES.required('code'))
  const name = v.string('name', { required: creating, max: 255 })
  if (!creating && v.has('name') && name === null) v.fail('name', MESSAGES.required('name'))
  const address = v.string('address', { max: 255 })
  const description = v.string('description', { max: 5000 })
  v.validate()
  return {
    ...(code ? { code } : {}),
    ...(name ? { name } : {}),
    ...(address !== undefined ? { address } : {}),
    ...(description !== undefined ? { description } : {}),
  }
}

interface SectorInput {
  code?: string
  name?: string
  color?: string
  description?: string | null
  floor_id?: number | null
  shape?: Point[] | null
}

function validateSector(body: unknown, warehouseId: number, sector: SectorRow | null): SectorInput {
  const creating = sector === null
  const v = new Validator(body)
  const rawCode = v.string('code', { required: creating, max: 32 })
  const code = rawCode ? rawCode.toUpperCase() : rawCode
  if (code) {
    if (!CODE_REGEX.test(code)) v.fail('code', CODE_MESSAGE)
    else if (db().sectors.some((s) => s.warehouse_id === warehouseId && s.code === code && s.id !== sector?.id)) {
      v.fail('code', 'Sektor o tym kodzie już istnieje w tym magazynie.')
    }
  } else if (!creating && v.has('code')) v.fail('code', MESSAGES.required('code'))
  const name = v.string('name', { required: creating, max: 255 })
  if (!creating && v.has('name') && name === null) v.fail('name', MESSAGES.required('name'))
  const color = v.string('color', { regex: /^#[0-9a-fA-F]{6}$/ })
  const description = v.string('description', { max: 5000 })
  const floorId = v.integer('floor_id')
  if (typeof floorId === 'number' && !db().floors.some((f) => f.id === floorId && f.warehouse_id === warehouseId)) {
    v.fail('floor_id', MESSAGES.exists('floor_id'))
  }
  const shape = validateShape(v)
  v.validate()
  return {
    ...(code ? { code } : {}),
    ...(name ? { name } : {}),
    ...(color ? { color } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(floorId !== undefined ? { floor_id: floorId } : {}),
    ...(shape !== undefined ? { shape } : {}),
  }
}

function validateShape(v: Validator): Point[] | null | undefined {
  const raw = v.array('shape')
  if (raw === undefined || raw === null) return raw
  if (raw.length < 3) {
    v.fail('shape', 'Obszar sektora musi mieć co najmniej 3 punkty.')
    return undefined
  }
  if (raw.length > 500) {
    v.fail('shape', 'Obszar sektora może mieć maksymalnie 500 punktów.')
    return undefined
  }
  const points: Point[] = []
  raw.forEach((point, index) => {
    const pair = Array.isArray(point) ? point.map(Number) : []
    if (pair.length !== 2 || pair.some((n) => !Number.isFinite(n) || n < 0 || n > 1)) {
      v.fail(`shape.${index}`, 'Punkty obszaru muszą mieć współrzędne od 0 do 1.')
    } else {
      points.push([pair[0] ?? 0, pair[1] ?? 0])
    }
  })
  return points
}
