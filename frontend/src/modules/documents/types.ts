import type { SectorSummary } from '@/modules/inventory'

export type DocumentType = 'PZ' | 'WZ'
export type DocumentStatus = 'draft' | 'posted'

interface UserRef {
  id: number
  name: string
}

export interface DocumentSummary {
  id: number
  type: DocumentType
  type_label: string
  number: string
  status: DocumentStatus
  warehouse: { id: number; code: string; name: string } | null
  counterparty: string | null
  note: string | null
  lines_count: number
  created_by: UserRef | null
  posted_by: UserRef | null
  created_at: string
  posted_at: string | null
}

export interface DocumentLine {
  id: number
  position: number
  product: { id: number; sku: string; name: string; unit: string } | null
  quantity: number
  sector: SectorSummary | null
  stock_item_id: number | null
  slot: string | null
  batch: string | null
  expires_at: string | null
  note: string | null
  /** Where the goods were put / taken from; filled when the document is posted. */
  posted_locations: Array<{ label: string; quantity: number }> | null
}

export interface DocumentDetail extends DocumentSummary {
  lines: DocumentLine[]
}

export interface DocumentLineInput {
  product_id: number
  quantity: number
  sector_id?: number | null
  stock_item_id?: number | null
  slot?: string | null
  batch?: string | null
  expires_at?: string | null
  note?: string | null
}

export interface DocumentInput {
  type?: DocumentType
  warehouse_id: number
  counterparty?: string | null
  note?: string | null
  lines: DocumentLineInput[]
}

export interface DocumentFilters {
  type?: string
  status?: string
  q?: string
  page?: number
}
