import { api, type Paginated } from '@/core/api/client'
import type { Queued } from '@/core/api/client'
import type { LocationDimensions, Movement, Product, SectorStockSummary, StockItem } from './types'

export interface ProductInput {
  sku: string
  name: string
  barcode: string
  unit: string
  description: string
  initial_stock?: { sector_id: number; quantity: number; note?: string } & LocationDimensions
}

type Deleted = { deleted: true }

export const isDeleted = (r: object): r is Deleted => 'deleted' in r

export const inventoryApi = {
  search: (q: string, signal?: AbortSignal) => api.get<Product[]>('/search', { q }, signal),
  products: (query: { q?: string; page?: number; per_page?: number }, signal?: AbortSignal) =>
    api.get<Paginated<Product>>('/products', query, signal),
  product: (id: number | string, signal?: AbortSignal) => api.get<Product>(`/products/${id}`, undefined, signal),
  createProduct: (data: ProductInput) => api.post<Product>('/products', data),
  updateProduct: (id: number, data: Partial<ProductInput>) => api.patch<Product>(`/products/${id}`, data),
  deleteProduct: (id: number) => api.delete(`/products/${id}`),

  stock: (
    query: { sector_id?: number; warehouse_id?: number; product_id?: number; pallet_id?: number; q?: string },
    signal?: AbortSignal,
  ) =>
    api.get<StockItem[]>('/stock', query, signal),
  warehouseSummary: (warehouseId: number, signal?: AbortSignal) =>
    api.get<SectorStockSummary[]>(`/warehouses/${warehouseId}/stock-summary`, undefined, signal),
  // Stock operations may be queued when the phone has no connection (module "offline").
  receive: (data: { product_id: number; sector_id: number; quantity: number; note?: string } & LocationDimensions) =>
    api.post<StockItem | Queued>('/stock/receive', data, { queueable: true }),
  issue: (id: number, data: { quantity: number; note?: string }) =>
    api.post<StockItem | Deleted | Queued>(`/stock/${id}/issue`, data, { queueable: true }),
  move: (id: number, data: { to_sector_id: number; to_slot?: string | null; quantity: number; note?: string }) =>
    api.post<StockItem | Queued>(`/stock/${id}/move`, data, { queueable: true }),
  adjust: (id: number, data: { quantity?: number; note?: string | null }) =>
    api.patch<StockItem | Deleted | Queued>(`/stock/${id}`, data, { queueable: true }),

  movements: (
    query: {
      product_id?: number
      sector_id?: number
      warehouse_id?: number
      pallet_id?: number
      user_id?: number
      reference?: string
      type?: string
      page?: number
    },
    signal?: AbortSignal,
  ) => api.get<Paginated<Movement>>('/movements', query, signal),
}
