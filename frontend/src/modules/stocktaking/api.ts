import { api } from '@/core/api/client'
import type { CompleteResult, NewLineInput, Stocktake, StocktakeDetail, StocktakeStatus } from './types'

export const stocktakingApi = {
  list: (query: { status?: StocktakeStatus | ''; sector_id?: number } = {}, signal?: AbortSignal) =>
    api.get<Stocktake[]>('/stocktakes', query, signal),
  get: (id: number | string, signal?: AbortSignal) => api.get<StocktakeDetail>(`/stocktakes/${id}`, undefined, signal),
  create: (data: { sector_id: number; note?: string | null }) => api.post<StocktakeDetail>('/stocktakes', data),
  count: (id: number, lineId: number, counted: number | null) =>
    api.put<StocktakeDetail>(`/stocktakes/${id}/lines/${lineId}`, { counted }),
  addLine: (id: number, data: NewLineInput) => api.post<StocktakeDetail>(`/stocktakes/${id}/lines`, data),
  complete: (id: number) => api.post<StocktakeDetail & { result: CompleteResult }>(`/stocktakes/${id}/complete`),
  cancel: (id: number) => api.post<StocktakeDetail>(`/stocktakes/${id}/cancel`),
}
