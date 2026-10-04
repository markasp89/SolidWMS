import type { SectorSummary } from '@/modules/inventory'

export type PickListStatus = 'open' | 'completed' | 'cancelled'
export type PickLineStatus = 'pending' | 'picked' | 'short'

export interface PickListSummary {
  id: number
  number: string
  status: PickListStatus
  note: string | null
  warehouse: { id: number; code: string; name: string } | null
  lines_count: number
  pending_count: number
  created_by: { id: number; name: string } | null
  created_at: string
  completed_at: string | null
}

export interface PickLine {
  id: number
  sequence: number
  product: { id: number; sku: string; name: string; unit: string; barcode: string | null } | null
  /** Null for `short` lines (not enough stock). */
  sector: SectorSummary | null
  slot: string | null
  batch: string | null
  expires_at: string | null
  quantity: number
  picked: number
  status: PickLineStatus
  picked_by: { id: number; name: string } | null
  picked_at: string | null
}

export interface PickListDetail extends PickListSummary {
  lines: PickLine[]
}

export interface PickListInput {
  warehouse_id: number
  note?: string | null
  items: Array<{ product_id: number; quantity: number }>
}
