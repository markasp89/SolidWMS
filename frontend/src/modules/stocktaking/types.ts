import type { SectorSummary } from '@/modules/inventory'

export type StocktakeStatus = 'open' | 'completed' | 'cancelled'

interface UserRef {
  id: number
  name: string
}

export interface Stocktake {
  id: number
  /** e.g. INW/00001 */
  reference: string
  status: StocktakeStatus
  note: string | null
  sector: SectorSummary
  lines_count: number
  created_by: UserRef | null
  completed_by: UserRef | null
  created_at: string
  completed_at: string | null
}

export interface StocktakeLine {
  id: number
  product: { id: number; sku: string; name: string; unit: string; barcode: string | null } | null
  slot: string | null
  batch: string | null
  expires_at: string | null
  pallet_id: number | null
  /** Quantity in the system when the stocktake was started. */
  expected: number
  /** null = not counted yet. */
  counted: number | null
  difference: number | null
}

export interface StocktakeDetail extends Stocktake {
  lines: StocktakeLine[]
}

export interface CompleteResult {
  changed: number
  unchanged: number
  skipped: number
}

export interface NewLineInput {
  product_id: number
  counted: number
  slot?: string | null
  batch?: string | null
  expires_at?: string | null
}
