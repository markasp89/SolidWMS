/**
 * StockService: every stock change goes through here, is checked against
 * warehouse access and recorded in the movement history.
 *
 * A location = product + sector + slot + batch + expires_at + pallet_id.
 */
import { db, nextId, nowIso } from './db'
import { emit } from './events'
import { formatQuantity, invalid, round3, toDateString } from './http'
import { ensureWarehouse, sectorById } from './repo'
import type { MovementType, StockRow, UserRow } from './types'

const EPSILON = 0.0005

export interface Dimensions {
  slot: string | null
  batch: string | null
  expires_at: string | null
  pallet_id: number | null
}

export interface RawDimensions {
  slot?: string | null
  batch?: string | null
  expires_at?: string | null
  pallet_id?: number | null
}

/** Empty strings to null, upper-case slot, Y-m-d dates. */
export function normalize(dimensions: RawDimensions): Dimensions {
  const text = (value: string | null | undefined) => (value === null || value === undefined || value.trim() === '' ? null : value.trim())
  const slot = text(dimensions.slot)
  const expires = text(dimensions.expires_at)
  return {
    slot: slot ? slot.toUpperCase() : null,
    batch: text(dimensions.batch),
    expires_at: expires ? toDateString(expires) : null,
    pallet_id: dimensions.pallet_id ? dimensions.pallet_id : null,
  }
}

const dimensionsOf = (item: StockRow): Dimensions =>
  normalize({ slot: item.slot, batch: item.batch, expires_at: item.expires_at, pallet_id: item.pallet_id })

const sameDimensions = (a: Dimensions, b: Dimensions) =>
  a.slot === b.slot && a.batch === b.batch && a.expires_at === b.expires_at && a.pallet_id === b.pallet_id

function ensureAccess(item: StockRow, user: UserRow | null): void {
  if (user) ensureWarehouse(user, sectorById(item.sector_id)?.warehouse_id)
}

function ensureAvailable(item: StockRow, quantity: number): void {
  if (quantity - item.quantity > EPSILON) {
    invalid('quantity', `W tym miejscu dostępne jest tylko ${formatQuantity(item.quantity)}.`)
  }
}

function findLocation(productId: number, sectorId: number, d: Dimensions): StockRow | undefined {
  return db().stock.find(
    (i) =>
      i.product_id === productId &&
      i.sector_id === sectorId &&
      i.slot === d.slot &&
      i.batch === d.batch &&
      i.expires_at === d.expires_at &&
      i.pallet_id === d.pallet_id,
  )
}

function addTo(productId: number, sectorId: number, d: Dimensions, quantity: number, user: UserRow | null, note: string | null): StockRow {
  const existing = findLocation(productId, sectorId, d)
  const time = nowIso()
  if (!existing) {
    const item: StockRow = {
      id: nextId('stock'),
      product_id: productId,
      sector_id: sectorId,
      ...d,
      quantity: round3(quantity),
      note,
      updated_by: user?.id ?? null,
      created_at: time,
      updated_at: time,
    }
    db().stock.push(item)
    return item
  }
  existing.quantity = round3(existing.quantity + quantity)
  existing.updated_by = user?.id ?? null
  existing.updated_at = time
  if (note) existing.note = note
  return existing
}

/** Sets the quantity; removes the location when it reaches zero (returns null). */
function setQuantity(item: StockRow, quantity: number, user: UserRow | null): StockRow | null {
  if (quantity < EPSILON) {
    deleteStockItem(item.id)
    return null
  }
  item.quantity = round3(quantity)
  item.updated_by = user?.id ?? null
  item.updated_at = nowIso()
  return item
}

/** Deletes a location together with its photos. */
export function deleteStockItem(id: number): void {
  const state = db()
  state.stock = state.stock.filter((i) => i.id !== id)
  state.photos = state.photos.filter((p) => !(p.subject_type === 'stock_item' && p.subject_id === id))
}

function log(
  productId: number,
  type: MovementType,
  quantity: number,
  from: number | null,
  to: number | null,
  d: Dimensions,
  user: UserRow | null,
  note: string | null,
  reference: string | null,
): void {
  db().movements.push({
    id: nextId('movements'),
    product_id: productId,
    type,
    quantity: round3(quantity),
    from_sector_id: from,
    to_sector_id: to,
    slot: d.slot,
    batch: d.batch,
    pallet_id: d.pallet_id,
    user_id: user?.id ?? null,
    note,
    reference,
    created_at: nowIso(),
  })
  const delta = type === 'in' ? quantity : type === 'out' ? -quantity : type === 'adjust' ? quantity : 0
  emit('stock.movement', { product_id: productId, total_delta: round3(delta) })
}

/** Puts goods into a sector (adds to an identical location if present). */
export function receive(
  productId: number,
  sectorId: number,
  quantity: number,
  user: UserRow | null,
  note: string | null = null,
  dimensions: RawDimensions = {},
  reference: string | null = null,
): StockRow {
  if (user) ensureWarehouse(user, sectorById(sectorId)?.warehouse_id)
  const d = normalize(dimensions)
  const item = addTo(productId, sectorId, d, quantity, user, note)
  log(productId, 'in', quantity, null, sectorId, d, user, note, reference)
  return item
}

/** Takes goods out of a location. Returns null if the location became empty. */
export function issue(item: StockRow, quantity: number, user: UserRow | null, note: string | null = null, reference: string | null = null): StockRow | null {
  ensureAccess(item, user)
  ensureAvailable(item, quantity)
  const d = dimensionsOf(item)
  const { product_id: productId, sector_id: sectorId } = item
  const remaining = setQuantity(item, item.quantity - quantity, user)
  log(productId, 'out', quantity, sectorId, null, d, user, note, reference)
  return remaining
}

/**
 * Moves (part of) a location to another sector/slot. Batch and expiry travel with
 * the goods; the pallet is left unless `target.pallet_id` says otherwise.
 */
export function move(
  item: StockRow,
  sectorId: number,
  quantity: number,
  user: UserRow | null,
  note: string | null = null,
  target: { slot?: string | null; pallet_id?: number | null } = {},
  reference: string | null = null,
): StockRow {
  ensureAccess(item, user)
  if (user) ensureWarehouse(user, sectorById(sectorId)?.warehouse_id)
  ensureAvailable(item, quantity)
  const source = dimensionsOf(item)
  const d = normalize({ slot: target.slot ?? null, batch: source.batch, expires_at: source.expires_at, pallet_id: target.pallet_id ?? null })
  if (item.sector_id === sectorId && sameDimensions(source, d)) {
    invalid('to_sector_id', 'Miejsce docelowe musi być inne niż obecne.')
  }
  const { product_id: productId, sector_id: fromSectorId } = item
  setQuantity(item, item.quantity - quantity, user)
  const targetItem = addTo(productId, sectorId, d, quantity, user, null)
  log(productId, 'move', quantity, fromSectorId, sectorId, { ...d, pallet_id: d.pallet_id ?? source.pallet_id }, user, note, reference)
  return targetItem
}

/** Sets the counted quantity (correction) and/or the note. */
export function adjust(
  item: StockRow,
  quantity: number | null,
  user: UserRow | null,
  note: string | null = null,
  updateNote = false,
  reference: string | null = null,
): StockRow | null {
  ensureAccess(item, user)
  const d = dimensionsOf(item)
  const { product_id: productId, sector_id: sectorId } = item
  if (updateNote) item.note = note
  if (quantity === null || Math.abs(quantity - item.quantity) < EPSILON) {
    item.updated_by = user?.id ?? null
    item.updated_at = nowIso()
    return item
  }
  const delta = quantity - item.quantity
  const result = setQuantity(item, quantity, user)
  log(productId, 'adjust', delta, sectorId, sectorId, d, user, note, reference)
  return result
}
