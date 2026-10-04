/**
 * In-memory state of the demo "server", persisted to localStorage when possible.
 */
import type { Db, Table } from './types'

export const STORAGE_KEY = 'solidwms.demo.db'
export const SCHEMA_VERSION = 1

let state: Db = emptyDb()

export function emptyDb(): Db {
  return {
    version: SCHEMA_VERSION,
    seq: {},
    modules: {},
    users: [],
    tokens: [],
    warehouses: [],
    floors: [],
    sectors: [],
    products: [],
    stock: [],
    movements: [],
    pallets: [],
    notifications: [],
    photos: [],
    stocktakes: [],
    stocktake_lines: [],
    documents: [],
    document_lines: [],
    pick_lists: [],
    pick_lines: [],
    api_keys: [],
    webhooks: [],
    webhook_deliveries: [],
    user_warehouse: [],
  }
}

/** The current database. */
export const db = (): Db => state

export function setDb(next: Db): void {
  state = next
}

export function nextId(table: Table): number {
  const rows: Array<{ id: number }> = state[table]
  const max = rows.reduce((m, row) => Math.max(m, row.id), 0)
  const next = Math.max((state.seq[table] ?? 0) + 1, max + 1)
  state.seq[table] = next
  return next
}

// Clock ----------------------------------------------------------------------

let frozenNow: Date | null = null

/** Current time; the seed freezes it to generate history in the past. */
export const now = (): Date => (frozenNow ? new Date(frozenNow.getTime()) : new Date())

export const nowIso = (): string => now().toISOString()

export function setClock(date: Date | null): void {
  frozenNow = date
}

// Persistence ----------------------------------------------------------------

/** Writes the state to localStorage; silently keeps it in memory only when storage is unavailable or full. */
export function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage unavailable or quota exceeded - the demo keeps working in memory.
  }
}

/** Reads a previously stored state (null when missing, unreadable or of another schema version). */
export function restore(): Db | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Db> | null
    if (!parsed || parsed.version !== SCHEMA_VERSION) return null
    // Fill tables added later so old snapshots keep working.
    return { ...emptyDb(), ...parsed } as Db
  } catch {
    return null
  }
}

export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/** Serialises the state (used to roll back a failed request). */
export const snapshot = (): string => JSON.stringify(state)

export function rollback(saved: string): void {
  state = JSON.parse(saved) as Db
}
