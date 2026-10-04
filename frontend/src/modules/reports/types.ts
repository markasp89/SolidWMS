export interface OccupancyRow {
  sector_id: number
  /** Warehouse code. */
  warehouse: string
  warehouse_name: string
  /** Sector code. */
  sector: string
  sector_name: string
  products_count: number
  locations_count: number
  total_quantity: number
  /** Database timestamp (UTC, "YYYY-MM-DD HH:MM:SS") or null for an empty sector. */
  last_change: string | null
}

export interface RotationRow {
  product_id: number
  sku: string
  name: string
  unit: string
  received: number
  issued: number
  moves: number
  operations: number
  stock: number
  last_movement: string | null
}

export interface ActivityRow {
  user_id: number | null
  name: string
  receipts: number
  issues: number
  moves: number
  adjustments: number
  operations: number
  last_activity: string | null
}

export interface PeriodReport<T> {
  from: string
  to: string
  rows: T[]
}

export interface Period {
  from: string
  to: string
}
