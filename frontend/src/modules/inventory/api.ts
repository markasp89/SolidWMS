import { api, type Paginated } from '@/core/api/client'
import type { Movement, Product, SectorStockSummary, StockItem } from './types'

export interface ProductInput {
  sku: string
  name: string
  barcode: string
  unit: string
  description: string
  initial_stock?: { sector_id: number; quantity: number; note?: string }
}

type Deleted = { deleted: true }

export const isDeleted = (r: StockItem | Deleted): r is Deleted => 'deleted' in r

export const inventoryApi = {
  search: (q: string, signal?: AbortSignal) => api.get<Product[]>('/search', { q }, signal),
  products: (query: { q?: string; page?: number; per_page?: number }, signal?: AbortSignal) =>
    api.get<Paginated<Product>>('/products', query, signal),
  product: (id: number | string, signal?: AbortSignal) => api.get<Product>(`/products/${id}`, undefined, signal),
  createProduct: (data: ProductInput) => api.post<Product>('/products', data),
  updateProduct: (id: number, data: Partial<ProductInput>) => api.patch<Product>(`/products/${id}`, data),
  deleteProduct: (id: number) => api.delete(`/products/${id}`),

  stock: (query: { sector_id?: number; warehouse_id?: number; product_id?: number; q?: string }, signal?: AbortSignal) =>
    api.get<StockItem[]>('/stock', query, signal),
  warehouseSummary: (warehouseId: number, signal?: AbortSignal) =>
    api.get<SectorStockSummary[]>(`/warehouses/${warehouseId}/stock-summary`, undefined, signal),
  receive: (data: { product_id: number; sector_id: number; quantity: number; note?: string }) =>
    api.post<StockItem>('/stock/receive', data),
  issue: (id: number, data: { quantity: number; note?: string }) => api.post<StockItem | Deleted>(`/stock/${id}/issue`, data),
  move: (id: number, data: { to_sector_id: number; quantity: number; note?: string }) =>
    api.post<StockItem>(`/stock/${id}/move`, data),
  adjust: (id: number, data: { quantity?: number; note?: string | null }) =>
    api.patch<StockItem | Deleted>(`/stock/${id}`, data),

  movements: (
    query: { product_id?: number; sector_id?: number; warehouse_id?: number; type?: string; page?: number },
    signal?: AbortSignal,
  ) => api.get<Paginated<Movement>>('/movements', query, signal),
}
