import { api, type Paginated } from '@/core/api/client'
import type { SectorSummary, StockItem } from '@/modules/inventory'

export interface Pallet {
  id: number
  code: string
  sector_id: number | null
  slot: string | null
  note: string | null
  sector?: SectorSummary | null
  items_count?: number
  items?: StockItem[]
  created_by?: { id: number; name: string } | null
  moved_by?: { id: number; name: string } | null
  moved_at: string | null
  created_at: string
}

export const palletsApi = {
  list: (query: { q?: string; sector_id?: number; warehouse_id?: number; page?: number }, signal?: AbortSignal) =>
    api.get<Paginated<Pallet>>('/pallets', query, signal),
  byCode: (code: string, signal?: AbortSignal) => api.get<Pallet>(`/pallets/code/${encodeURIComponent(code)}`, undefined, signal),
  create: (data: { sector_id: number; slot?: string | null; code?: string | null; note?: string | null }) =>
    api.post<Pallet>('/pallets', data),
  update: (id: number, data: { code?: string; note?: string | null }) => api.patch<Pallet>(`/pallets/${id}`, data),
  remove: (id: number) => api.delete(`/pallets/${id}`),
  addItem: (id: number, data: { product_id: number; quantity: number; batch?: string | null; expires_at?: string | null; note?: string }) =>
    api.post<StockItem>(`/pallets/${id}/items`, data),
  move: (id: number, data: { to_sector_id: number; to_slot?: string | null; note?: string }) =>
    api.post<Pallet>(`/pallets/${id}/move`, data),
}
