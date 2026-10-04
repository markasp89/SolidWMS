export interface SectorSummary {
  id: number
  code: string
  name: string
  color: string
  warehouse: { id: number; code: string; name: string } | null
}

export interface StockItem {
  id: number
  product_id: number
  sector_id: number
  /** Shelf / level / bin within the sector (module "slots"). */
  slot: string | null
  /** Batch number and expiry date (module "batches"). */
  batch: string | null
  expires_at: string | null
  pallet_id: number | null
  pallet?: { id: number; code: string } | null
  quantity: number
  note: string | null
  product?: { id: number; sku: string; name: string; unit: string; barcode: string | null }
  sector?: SectorSummary
  updated_by?: { id: number; name: string } | null
  updated_at: string
}

export interface Product {
  id: number
  sku: string
  name: string
  barcode: string | null
  unit: string
  description: string | null
  total_quantity?: number
  locations_count?: number
  locations?: StockItem[]
  updated_at?: string
}

export type MovementType = 'in' | 'out' | 'move' | 'adjust'

export interface Movement {
  id: number
  type: MovementType
  type_label: string
  quantity: number
  note: string | null
  reference: string | null
  slot: string | null
  batch: string | null
  pallet_id: number | null
  product?: { id: number; sku: string; name: string; unit: string }
  from_sector: SectorSummary | null
  to_sector: SectorSummary | null
  user: { id: number; name: string } | null
  created_at: string
}

export interface SectorStockSummary {
  sector_id: number
  products_count: number
  total_quantity: number
}

/** Optional location dimensions sent with stock operations. */
export interface LocationDimensions {
  slot?: string | null
  batch?: string | null
  expires_at?: string | null
}
