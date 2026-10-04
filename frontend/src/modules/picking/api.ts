import { api } from '@/core/api/client'
import type { PickListDetail, PickListInput, PickListStatus, PickListSummary } from './types'

export const pickingApi = {
  list: (status?: PickListStatus, signal?: AbortSignal) => api.get<PickListSummary[]>('/picking', { status }, signal),
  get: (id: number, signal?: AbortSignal) => api.get<PickListDetail>(`/picking/${id}`, undefined, signal),
  create: (input: PickListInput) => api.post<PickListDetail>('/picking', input),
  /** Issues the goods of one line; without `quantity` the whole remaining quantity. */
  pick: (id: number, lineId: number, quantity?: number) =>
    api.post<PickListDetail>(`/picking/${id}/lines/${lineId}/pick`, quantity === undefined ? {} : { quantity }),
  complete: (id: number) => api.post<PickListDetail>(`/picking/${id}/complete`),
  cancel: (id: number) => api.post<PickListDetail>(`/picking/${id}/cancel`),
}
