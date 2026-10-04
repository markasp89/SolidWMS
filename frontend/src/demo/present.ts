/**
 * JSON shapes of the Laravel API resources.
 */
import planUrl from './assets/demo-floor-plan.png'
import { db } from './db'
import { fefo, palletById, productById, sectorById, userById, userRef, warehouseById } from './repo'
import type { FloorRow, ImageRef, MovementRow, PalletRow, ProductRow, SectorRow, StockRow, UserRow, WarehouseRow } from './types'

export const DEMO_PLAN_ASSET = 'asset:demo-floor-plan'

const ROLE_LABELS: Record<UserRow['role'], string> = {
  admin: 'Administrator',
  manager: 'Kierownik zmiany',
  worker: 'Pracownik',
}

const MOVEMENT_LABELS: Record<MovementRow['type'], string> = {
  in: 'Przyjęcie',
  out: 'Wydanie',
  move: 'Przesunięcie',
  adjust: 'Korekta',
}

/** Image URL usable directly in <img>: data: URLs as they are, bundled assets as absolute URLs. */
export function imageUrl(url: string): string {
  const resolved = url === DEMO_PLAN_ASSET ? planUrl : url
  if (/^(data:|blob:|https?:)/.test(resolved)) return resolved
  try {
    return new URL(resolved, globalThis.location?.href).href
  } catch {
    return resolved
  }
}

const presentImage = (image: ImageRef | null) => (image ? { url: imageUrl(image.url), width: image.width, height: image.height } : null)

export function userResource(user: UserRow) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    role_label: ROLE_LABELS[user.role],
    is_active: user.is_active,
    created_at: user.created_at,
  }
}

const warehouseRef = (warehouse: WarehouseRow | undefined) =>
  warehouse ? { id: warehouse.id, code: warehouse.code, name: warehouse.name } : null

export function sectorResource(sector: SectorRow, withWarehouse = true) {
  return {
    id: sector.id,
    warehouse_id: sector.warehouse_id,
    floor_id: sector.floor_id,
    code: sector.code,
    name: sector.name,
    color: sector.color,
    description: sector.description,
    shape: sector.shape,
    ...(withWarehouse ? { warehouse: warehouseRef(warehouseById(sector.warehouse_id)) } : {}),
    updated_at: sector.updated_at,
  }
}

export const sectorsOf = (warehouseId: number): SectorRow[] =>
  db()
    .sectors.filter((s) => s.warehouse_id === warehouseId)
    .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))

/** WarehouseResource; `full` adds the sectors (show/store/update responses). */
export function warehouseResource(warehouse: WarehouseRow, full: boolean) {
  const sectors = sectorsOf(warehouse.id)
  return {
    id: warehouse.id,
    code: warehouse.code,
    name: warehouse.name,
    address: warehouse.address,
    description: warehouse.description,
    floor_plan: presentImage(warehouse.floor_plan),
    sectors_count: sectors.length,
    ...(full ? { sectors: sectors.map((s) => sectorResource(s, false)) } : {}),
    updated_at: warehouse.updated_at,
  }
}

export function floorResource(floor: FloorRow) {
  return {
    id: floor.id,
    warehouse_id: floor.warehouse_id,
    name: floor.name,
    level: floor.level,
    floor_plan: presentImage(floor.floor_plan),
    sectors_count: db().sectors.filter((s) => s.floor_id === floor.id).length,
  }
}

/** SectorSummary::from() - always with the warehouse loaded. */
export function sectorSummary(sectorOrId: SectorRow | number | null | undefined) {
  const sector = typeof sectorOrId === 'number' ? sectorById(sectorOrId) : (sectorOrId ?? undefined)
  if (!sector) return null
  return {
    id: sector.id,
    code: sector.code,
    name: sector.name,
    color: sector.color,
    warehouse: warehouseRef(warehouseById(sector.warehouse_id)),
  }
}

export const productRef = (id: number, withBarcode = true) => {
  const product = productById(id)
  if (!product) return null
  return withBarcode
    ? { id: product.id, sku: product.sku, name: product.name, unit: product.unit, barcode: product.barcode }
    : { id: product.id, sku: product.sku, name: product.name, unit: product.unit }
}

export function stockItemResource(item: StockRow) {
  const pallet = palletById(item.pallet_id)
  const user = userById(item.updated_by)
  return {
    id: item.id,
    product_id: item.product_id,
    sector_id: item.sector_id,
    slot: item.slot,
    batch: item.batch,
    expires_at: item.expires_at,
    pallet_id: item.pallet_id,
    pallet: pallet ? { id: pallet.id, code: pallet.code } : null,
    quantity: item.quantity,
    note: item.note,
    product: productRef(item.product_id),
    sector: sectorSummary(item.sector_id),
    updated_by: user ? { id: user.id, name: user.name } : null,
    updated_at: item.updated_at,
  }
}

export const productTotal = (productId: number, items: StockRow[] = db().stock): number =>
  Math.round(items.filter((i) => i.product_id === productId).reduce((sum, i) => sum + i.quantity, 0) * 1000) / 1000

/**
 * ProductResource with total_quantity and locations_count; `locations` (FEFO
 * ordered, limited to the allowed warehouses) for detail and search responses.
 */
export function productResource(product: ProductRow, locations?: StockRow[] | null) {
  const all = db().stock.filter((i) => i.product_id === product.id)
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    barcode: product.barcode,
    unit: product.unit,
    description: product.description,
    total_quantity: productTotal(product.id, all),
    locations_count: all.length,
    ...(locations ? { locations: [...locations].sort(fefo).map(stockItemResource) } : {}),
    updated_at: product.updated_at,
  }
}

export function movementResource(movement: MovementRow) {
  return {
    id: movement.id,
    type: movement.type,
    type_label: MOVEMENT_LABELS[movement.type],
    quantity: movement.quantity,
    note: movement.note,
    reference: movement.reference,
    slot: movement.slot,
    batch: movement.batch,
    pallet_id: movement.pallet_id,
    product: productRef(movement.product_id, false),
    from_sector: sectorSummary(movement.from_sector_id),
    to_sector: sectorSummary(movement.to_sector_id),
    user: userRef(movement.user_id),
    created_at: movement.created_at,
  }
}

/** PalletResource; `full` adds items and users (single pallet responses). */
export function palletResource(pallet: PalletRow, full: boolean) {
  const items = db().stock.filter((i) => i.pallet_id === pallet.id)
  return {
    id: pallet.id,
    code: pallet.code,
    sector_id: pallet.sector_id,
    slot: pallet.slot,
    note: pallet.note,
    sector: sectorSummary(pallet.sector_id),
    items_count: items.length,
    ...(full
      ? {
          items: [...items].sort(fefo).map(stockItemResource),
          created_by: userRef(pallet.created_by),
          moved_by: userRef(pallet.moved_by),
        }
      : {}),
    moved_at: pallet.moved_at,
    created_at: pallet.created_at,
  }
}
