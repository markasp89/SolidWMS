/**
 * Lookups shared by the handlers, plus the warehouse access scope (module "warehouse_access").
 */
import { db } from './db'
import { HttpError, notFound } from './http'
import { moduleEnabled } from './modules'
import type { PalletRow, ProductRow, SectorRow, StockRow, UserRow, WarehouseRow } from './types'

export function findOr404<T extends { id: number }>(rows: T[], id: number): T {
  const row = rows.find((r) => r.id === id)
  if (!row) throw notFound()
  return row
}

export const userById = (id: number | null): UserRow | undefined => (id === null ? undefined : db().users.find((u) => u.id === id))
export const warehouseById = (id: number | null): WarehouseRow | undefined =>
  id === null ? undefined : db().warehouses.find((w) => w.id === id)
export const sectorById = (id: number | null): SectorRow | undefined => (id === null ? undefined : db().sectors.find((s) => s.id === id))
export const productById = (id: number | null): ProductRow | undefined =>
  id === null ? undefined : db().products.find((p) => p.id === id)
export const palletById = (id: number | null): PalletRow | undefined => (id === null ? undefined : db().pallets.find((p) => p.id === id))
export const stockById = (id: number | null): StockRow | undefined => (id === null ? undefined : db().stock.find((s) => s.id === id))

export const userRef = (id: number | null): { id: number; name: string } | null => {
  const user = userById(id)
  return user ? { id: user.id, name: user.name } : null
}

export const warehouseOfSector = (sectorId: number): number | undefined => sectorById(sectorId)?.warehouse_id

/** Polish, case-insensitive name ordering (like the database collation). */
export const byName = (a: string, b: string): number => a.localeCompare(b, 'pl', { sensitivity: 'base' })

/** strnatcasecmp */
export const natural = (a: string, b: string): number => a.localeCompare(b, 'pl', { numeric: true, sensitivity: 'base' })

/** Ascending string order with nulls first (as SQL sorts them). */
export const nullsFirst = (a: string | null, b: string | null): number => {
  if (a === b) return 0
  if (a === null) return -1
  if (b === null) return 1
  return a < b ? -1 : a > b ? 1 : 0
}

// Warehouse access -------------------------------------------------------------

/** Warehouses the user may work in; null = no restriction. */
export function allowedWarehouseIds(user: UserRow): number[] | null {
  if (user.role === 'admin' || !moduleEnabled('warehouse_access')) return null
  const ids = db()
    .user_warehouse.filter((row) => row.user_id === user.id)
    .map((row) => row.warehouse_id)
  return ids.length ? ids : null
}

export const canAccess = (allowed: number[] | null, warehouseId: number | undefined): boolean =>
  allowed === null || (warehouseId !== undefined && allowed.includes(warehouseId))

export function ensureWarehouse(user: UserRow, warehouseId: number | undefined): void {
  if (!canAccess(allowedWarehouseIds(user), warehouseId)) {
    throw new HttpError(403, 'Nie masz dostępu do tego magazynu.')
  }
}

/** Matches name, SKU or barcode (case-insensitive "contains"). */
export function productMatches(product: ProductRow, term: string): boolean {
  const needle = term.trim().toLowerCase()
  if (!needle) return true
  return [product.name, product.sku, product.barcode ?? ''].some((value) => value.toLowerCase().includes(needle))
}

/** FEFO: earliest expiry first, no expiry last, then the biggest quantity. */
export function fefo(a: StockRow, b: StockRow): number {
  if (a.expires_at !== b.expires_at) {
    if (a.expires_at === null) return 1
    if (b.expires_at === null) return -1
    return a.expires_at < b.expires_at ? -1 : 1
  }
  return b.quantity - a.quantity
}

/** "MAG1/A1-03-2" */
export function locationLabel(item: Pick<StockRow, 'sector_id' | 'slot'>): string {
  const sector = sectorById(item.sector_id)
  const warehouse = warehouseById(sector?.warehouse_id ?? null)
  const label = (warehouse?.code ? `${warehouse.code}/` : '') + (sector?.code ?? '?')
  return item.slot ? `${label}-${item.slot}` : label
}

export interface Page<T> {
  data: T[]
  meta: { current_page: number; last_page: number; per_page: number; total: number; from: number | null; to: number | null }
  links: { first: string | null; last: string | null; prev: string | null; next: string | null }
}

/** Laravel-like paginated resource collection. */
export function paginate<T, R>(rows: T[], page: number | null, perPage: number, map: (row: T) => R): Page<R> {
  const total = rows.length
  const lastPage = Math.max(1, Math.ceil(total / perPage))
  const current = Math.max(1, page ?? 1)
  const start = (current - 1) * perPage
  const slice = rows.slice(start, start + perPage)
  return {
    data: slice.map(map),
    meta: {
      current_page: current,
      last_page: lastPage,
      per_page: perPage,
      total,
      from: slice.length ? start + 1 : null,
      to: slice.length ? start + slice.length : null,
    },
    links: { first: null, last: null, prev: null, next: null },
  }
}

export const clampPerPage = (value: number | null, fallback: number): number => Math.min(Math.max(value ?? fallback, 1), 100)
